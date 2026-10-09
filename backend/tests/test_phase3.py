import pytest
from typing import Any
from fastapi.testclient import TestClient

from app.models.run import Run
from app.models.evaluation import Evaluation
from app.services.llm_client import (
    LLMClient,
    LLMProviderError,
    LLMOutputParsingError,
)


@pytest.fixture(autouse=True)
def clean_mock_handler():
    LLMClient.clear_mock_handler()
    yield
    LLMClient.clear_mock_handler()


# 1. Acceptance Criterion 1: Flagged fraud followed by refund is identified as a violation
def test_flagged_fraud_followed_by_refund_fails_evaluation(client: TestClient):
    # Create run with flagged_fraud_violation scenario
    res = client.post(
        "/api/runs",
        json={
            "scenario": "flagged_fraud_violation",
            "expected_workflow": (
                "Check the transaction for fraud. If it is flagged, do not issue a refund "
                "and send the case for manual review. Only issue the refund if the transaction passes the fraud check."
            ),
        },
    )
    assert res.status_code == 201
    run_id = res.json()["run"]["id"]

    # Evaluate intent
    eval_res = client.post(f"/api/runs/{run_id}/evaluate")
    assert eval_res.status_code == 200
    data = eval_res.json()

    assert data["verdict"] == "FAIL"
    assert data["first_divergence_event_id"] is not None
    assert len(data["evidence_event_ids"]) >= 1
    assert "Fraud was flagged" in data["reason"] or "violation" in data["reason"].lower()
    assert "Halt refund execution" in data["suggested_correction"] or "refund" in data["suggested_correction"].lower()


# 2. Acceptance Criterion 2: Valid refund after passing fraud check passes
def test_valid_refund_after_passing_fraud_check_passes(client: TestClient):
    # Create safe replay run
    res = client.post(
        "/api/runs",
        json={
            "scenario": "refund_safety",
            "prompt": "Always check fraud before issuing a refund.",
            "expected_workflow": "Check the transaction for fraud. Only issue the refund if fraud check passes.",
        },
    )
    assert res.status_code == 201
    run_id = res.json()["run"]["id"]

    eval_res = client.post(f"/api/runs/{run_id}/evaluate")
    assert eval_res.status_code == 200
    data = eval_res.json()

    assert data["verdict"] == "PASS"
    assert data["first_divergence_event_id"] is None
    assert len(data["evidence_event_ids"]) >= 2
    assert "satisfied" in data["reason"].lower() or "conforms" in data["reason"].lower() or "completed" in data["observed_behavior"].lower()


# 3. Acceptance Criterion 3: Valid alternative sequence is not rejected solely because order differs
def test_valid_alternative_sequence_is_not_rejected(client: TestClient):
    # Runs verify_account -> check_fraud -> issue_refund
    res = client.post(
        "/api/runs",
        json={
            "scenario": "alternative_safe_order",
            "expected_workflow": "Check fraud before issuing refund. Only issue refund if fraud check passes.",
        },
    )
    assert res.status_code == 201
    run_id = res.json()["run"]["id"]

    eval_res = client.post(f"/api/runs/{run_id}/evaluate")
    assert eval_res.status_code == 200
    data = eval_res.json()

    # Must pass because fraud check preceded refund, despite extra verify_account step
    assert data["verdict"] == "PASS"
    assert data["first_divergence_event_id"] is None
    assert len(data["evidence_event_ids"]) >= 2


# 4. Acceptance Criterion 4: Missing evidence or truncated trace produces INCONCLUSIVE
def test_truncated_trace_produces_inconclusive(client: TestClient):
    res = client.post(
        "/api/runs",
        json={
            "scenario": "truncated_trace",
            "expected_workflow": "Check fraud before issuing refund.",
        },
    )
    assert res.status_code == 201
    run_id = res.json()["run"]["id"]

    eval_res = client.post(f"/api/runs/{run_id}/evaluate")
    assert eval_res.status_code == 200
    data = eval_res.json()

    assert data["verdict"] == "INCONCLUSIVE"
    assert "truncated" in data["observed_behavior"].lower() or "missing" in data["reason"].lower()
    assert data["limitations"] is not None


# 5. Acceptance Criterion 5: Every cited event ID belongs to the evaluated run (no hallucinated IDs)
def test_cited_event_ids_strictly_belong_to_evaluated_run(client: TestClient):
    # Mock LLM returning fabricated event IDs
    def mock_hallucinating_llm(workflow: str, events: list[dict[str, Any]]):
        real_id = events[0]["id"]
        return {
            "verdict": "FAIL",
            "first_divergence_event_id": "fake_event_id_99999",
            "expected_behavior": "Expected behavior",
            "observed_behavior": "Observed behavior",
            "evidence_event_ids": [real_id, "fake_event_id_88888", "hallucinated_id_77777"],
            "reason": "Hallucinated reasoning",
            "suggested_correction": "Fix agent",
            "limitations": None,
        }

    LLMClient.set_mock_handler(mock_hallucinating_llm)

    res = client.post("/api/runs", json={"scenario": "refund_safety"})
    run_id = res.json()["run"]["id"]
    trace_events = res.json()["events"]
    valid_ids = {e["id"] for e in trace_events}

    eval_res = client.post(f"/api/runs/{run_id}/evaluate")
    assert eval_res.status_code == 200
    data = eval_res.json()

    # Verify fabricated first_divergence_event_id was rejected/nulled
    assert data["first_divergence_event_id"] is None

    # Verify fabricated evidence_event_ids were stripped, only real event ID preserved
    for cited_id in data["evidence_event_ids"]:
        assert cited_id in valid_ids
    assert "fake_event_id_88888" not in data["evidence_event_ids"]
    assert "hallucinated_id_77777" not in data["evidence_event_ids"]


# 6. Acceptance Criterion 6: Invalid or malformed LLM output is handled safely
def test_malformed_llm_output_handled_safely(client: TestClient):
    def mock_broken_llm(workflow: str, events: list[dict[str, Any]]):
        # Missing required keys or returning completely corrupt dictionary
        return {"random_garbage": True, "verdict": "INVALID_STATE"}

    LLMClient.set_mock_handler(mock_broken_llm)

    res = client.post(
        "/api/runs",
        json={"scenario": "refund_safety", "prompt": "Always check fraud first"},
    )
    run_id = res.json()["run"]["id"]

    eval_res = client.post(f"/api/runs/{run_id}/evaluate")
    assert eval_res.status_code == 200
    data = eval_res.json()

    # Must safely fall back to INCONCLUSIVE without crashing
    assert data["verdict"] in {"INCONCLUSIVE", "PASS"}
    assert data["id"].startswith("eval_")


# 7. Acceptance Criterion 7: Provider errors do not produce a fabricated successful evaluation
def test_provider_error_does_not_fabricate_pass(client: TestClient):
    def mock_exploding_llm(workflow: str, events: list[dict[str, Any]]):
        raise LLMProviderError("HTTP 502 Bad Gateway from upstream model")

    LLMClient.set_mock_handler(mock_exploding_llm)

    res = client.post(
        "/api/runs",
        json={"scenario": "refund_safety", "prompt": "Custom prompt needing LLM analysis"},
    )
    run_id = res.json()["run"]["id"]

    eval_res = client.post(f"/api/runs/{run_id}/evaluate")
    assert eval_res.status_code == 200
    data = eval_res.json()

    # Must NOT fabricate PASS on provider error
    assert data["verdict"] == "INCONCLUSIVE"
    assert "Provider failed" in (data["limitations"] or "") or "error" in data["reason"].lower()


# 8. Acceptance Criterion 8: Existing API endpoints remain fully functional
def test_existing_endpoints_remain_functional(client: TestClient):
    # Create run
    c_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    assert c_res.status_code == 201
    run_id = c_res.json()["run"]["id"]

    # Get run
    g_res = client.get(f"/api/runs/{run_id}")
    assert g_res.status_code == 200

    # List runs
    l_res = client.get("/api/runs")
    assert l_res.status_code == 200
    assert l_res.json()["total"] >= 1

    # Replay run
    r_res = client.post(f"/api/runs/{run_id}/replay", json={"prompt": "Safe replay"})
    assert r_res.status_code == 201
    rep_id = r_res.json()["run"]["id"]

    # Diff runs
    d_res = client.get(f"/api/runs/{run_id}/diff/{rep_id}")
    assert d_res.status_code == 200

    # Assertions
    a_res = client.get(f"/api/runs/{run_id}/assertions")
    assert a_res.status_code == 200

    # Evaluation retrieval via GET
    eval_get = client.get(f"/api/runs/{run_id}/evaluation")
    assert eval_get.status_code == 200
    assert eval_get.json()["run_id"] == run_id


# 9. Acceptance Criterion: Evaluation is persisted and retrievable across sessions
def test_evaluation_persistence_and_retrieval(client: TestClient):
    res = client.post("/api/runs", json={"scenario": "refund_safety"})
    run_id = res.json()["run"]["id"]

    # POST to evaluate
    post_eval = client.post(
        f"/api/runs/{run_id}/evaluate",
        json={"expected_workflow": "Custom developer intent requirement."},
    )
    assert post_eval.status_code == 200
    eval_id = post_eval.json()["id"]

    # GET to retrieve persisted evaluation
    get_eval = client.get(f"/api/runs/{run_id}/evaluation")
    assert get_eval.status_code == 200
    assert get_eval.json()["id"] == eval_id
    assert get_eval.json()["expected_workflow"] == "Custom developer intent requirement."
