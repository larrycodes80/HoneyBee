import os
import pytest
from fastapi.testclient import TestClient

from app.models.workflow import Workflow, WorkflowVersion
from app.services.ai_provider import (
    FakeGemmaProvider,
    DigitalOceanGemmaProvider,
    AITimeoutError,
    AIAuthenticationError,
    AIRateLimitError,
)
from app.core.config import get_settings


@pytest.fixture(autouse=True)
def reset_fake_provider():
    FakeGemmaProvider.clear_simulated_error()
    yield
    FakeGemmaProvider.clear_simulated_error()


# 1. Test creating workflow draft from natural-language intent
def test_create_workflow_draft(client: TestClient, test_db):
    res = client.post(
        "/api/workflows",
        json={
            "title": "Autonomous Refund Workflow",
            "intent_description": (
                "Verify customer identity and check fraud database before disbursing refund. "
                "If fraud check fails or returns risk >= 0.7, abort and route to manual review."
            ),
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["id"].startswith("wf_")
    assert data["title"] == "Autonomous Refund Workflow"
    assert data["status"] == "draft"
    assert data["questions"] == []
    assert data["answers"] == []
    assert data["draft_spec"] is None


# 2. Test generating clarification questions using AI
def test_generate_clarification_questions(client: TestClient):
    create_res = client.post(
        "/api/workflows",
        json={
            "title": "Refund Flow",
            "intent_description": "Check fraud before issuing refund.",
        },
    )
    wf_id = create_res.json()["id"]

    q_res = client.post(f"/api/workflows/{wf_id}/questions")
    assert q_res.status_code == 200
    data = q_res.json()
    assert len(data["questions"]) >= 2
    for q in data["questions"]:
        assert "id" in q
        assert "question" in q
        assert "category" in q
        assert "rationale" in q


# 3. Test submitting developer answers to interview questions
def test_submit_interview_answers(client: TestClient):
    create_res = client.post(
        "/api/workflows",
        json={"title": "Test Flow", "intent_description": "Process payments safely."},
    )
    wf_id = create_res.json()["id"]

    # Submit answers
    ans_res = client.post(
        f"/api/workflows/{wf_id}/answers",
        json={
            "answers": [
                {
                    "question_id": "q_safety_invariants",
                    "question": "What halts execution?",
                    "answer": "Any fraud score above 0.7 halts execution immediately.",
                },
                {
                    "question_id": "q_failure_handling",
                    "question": "How to handle timeouts?",
                    "answer": "Escalate to human review dashboard.",
                },
            ]
        },
    )
    assert ans_res.status_code == 200
    data = ans_res.json()
    assert data["status"] == "in_review"
    assert len(data["answers"]) == 2
    assert data["answers"][0]["answer"] == "Any fraud score above 0.7 halts execution immediately."


# 4. Test synthesizing structured workflow specification draft
def test_generate_workflow_specification(client: TestClient):
    create_res = client.post(
        "/api/workflows",
        json={
            "title": "Safe Payouts",
            "intent_description": "Check fraud before issuing refund. Halt on risk.",
        },
    )
    wf_id = create_res.json()["id"]

    spec_res = client.post(f"/api/workflows/{wf_id}/generate-spec")
    assert spec_res.status_code == 200
    data = spec_res.json()
    assert data["draft_spec"] is not None

    spec = data["draft_spec"]
    assert "goal" in spec
    assert len(spec["forbidden_actions"]) >= 1
    assert len(spec["safety_invariants"]) >= 1
    assert len(spec["hard_requirements"]) >= 1
    assert len(spec["preferences"]) >= 1
    assert len(spec["failure_handling_requirements"]) >= 1


# 5. Test manual editing of draft specification prior to approval
def test_manual_edit_draft_before_approval(client: TestClient):
    create_res = client.post(
        "/api/workflows",
        json={"title": "Draft Flow", "intent_description": "Initial text."},
    )
    wf_id = create_res.json()["id"]

    client.post(f"/api/workflows/{wf_id}/generate-spec")

    # Manually update specification
    put_res = client.put(
        f"/api/workflows/{wf_id}",
        json={
            "title": "Updated Custom Title",
            "spec": {
                "goal": "Custom edited developer goal",
                "required_outcomes": ["Disburse customer funds"],
                "required_conditions": ["Order verified"],
                "forbidden_actions": ["Never pay without approval"],
                "safety_invariants": ["Invariance rule 1"],
                "acceptable_alternatives": [],
                "failure_handling_requirements": ["Manual review queue"],
                "success_criteria": ["Complete with zero errors"],
                "external_side_effects": ["Stripe payout"],
                "unresolved_assumptions": [],
                "hard_requirements": ["Hard requirement 1"],
                "preferences": ["Fast execution"],
            },
        },
    )
    assert put_res.status_code == 200
    data = put_res.json()
    assert data["title"] == "Updated Custom Title"
    assert data["draft_spec"]["goal"] == "Custom edited developer goal"
    assert "Never pay without approval" in data["draft_spec"]["forbidden_actions"]


# 6. Test explicit approval creates immutable version and increments version numbers
def test_explicit_approval_creates_immutable_version(client: TestClient):
    create_res = client.post(
        "/api/workflows",
        json={"title": "Approval Test", "intent_description": "Check fraud before refund."},
    )
    wf_id = create_res.json()["id"]

    client.post(f"/api/workflows/{wf_id}/generate-spec")

    approve_res = client.post(
        f"/api/workflows/{wf_id}/approve",
        json={"approved_by": "lead_engineer", "approval_notes": "Reviewed and safe for execution."},
    )
    assert approve_res.status_code == 201
    version_data = approve_res.json()

    assert version_data["workflow_id"] == wf_id
    assert version_data["version_num"] == 1
    assert version_data["approved_by"] == "lead_engineer"
    assert version_data["approval_notes"] == "Reviewed and safe for execution."
    assert version_data["spec"] is not None

    # Verify workflow reflects approved status
    get_res = client.get(f"/api/workflows/{wf_id}")
    assert get_res.json()["status"] == "approved"
    assert get_res.json()["active_version_num"] == 1


# 7. Test historical versions remain unchanged when workflow is edited and approved again
def test_historical_versions_remain_unchanged(client: TestClient):
    create_res = client.post(
        "/api/workflows",
        json={"title": "Versioned Flow", "intent_description": "Version 1 Intent."},
    )
    wf_id = create_res.json()["id"]

    # Generate and approve Version 1
    client.post(f"/api/workflows/{wf_id}/generate-spec")
    v1_res = client.post(f"/api/workflows/{wf_id}/approve", json={"approved_by": "dev_v1"})
    v1_id = v1_res.json()["id"]
    v1_spec = v1_res.json()["spec"]

    # Now edit draft with new intent
    client.put(
        f"/api/workflows/{wf_id}",
        json={
            "spec": {
                **v1_spec,
                "goal": "Brand new Version 2 Goal",
                "forbidden_actions": ["Extra forbidden action in V2"],
            }
        },
    )

    # Approve Version 2
    v2_res = client.post(f"/api/workflows/{wf_id}/approve", json={"approved_by": "dev_v2"})
    assert v2_res.status_code == 201
    assert v2_res.json()["version_num"] == 2
    assert v2_res.json()["spec"]["goal"] == "Brand new Version 2 Goal"

    # Fetch Version 1 historical record directly
    v1_historical = client.get(f"/api/workflows/{wf_id}/versions/1")
    assert v1_historical.status_code == 200
    assert v1_historical.json()["id"] == v1_id
    assert v1_historical.json()["version_num"] == 1
    # Version 1 must NOT have the V2 changes!
    assert v1_historical.json()["spec"]["goal"] != "Brand new Version 2 Goal"
    assert "Extra forbidden action in V2" not in v1_historical.json()["spec"]["forbidden_actions"]

    # List all versions
    all_versions = client.get(f"/api/workflows/{wf_id}/versions")
    assert all_versions.status_code == 200
    assert len(all_versions.json()) == 2


# 8. Test provider failure does not auto-approve or fabricate success
def test_provider_failure_does_not_fabricate_success_or_auto_approve(client: TestClient):
    create_res = client.post(
        "/api/workflows",
        json={"title": "Fault Flow", "intent_description": "Some workflow intent."},
    )
    wf_id = create_res.json()["id"]

    # Simulate timeout failure from AI provider
    FakeGemmaProvider.set_simulated_error(AITimeoutError("Model inference timed out after 60s"))

    # Attempt to generate questions
    q_res = client.post(f"/api/workflows/{wf_id}/questions")
    assert q_res.status_code == 504
    assert q_res.json()["error"]["code"] == "AI_TIMEOUT_ERROR"

    # Verify workflow state is preserved and NOT auto-approved
    wf_state = client.get(f"/api/workflows/{wf_id}").json()
    assert wf_state["status"] == "draft"
    assert wf_state["ai_status"] == "unavailable"
    assert wf_state["active_version_num"] is None


# 9. Test rate limit and authentication error handling
def test_provider_auth_and_rate_limit_errors(client: TestClient):
    create_res = client.post(
        "/api/workflows",
        json={"title": "Error Test", "intent_description": "Some intent."},
    )
    wf_id = create_res.json()["id"]

    # Simulate 401 Auth error
    FakeGemmaProvider.set_simulated_error(AIAuthenticationError("Invalid API token"))
    res_auth = client.post(f"/api/workflows/{wf_id}/generate-spec")
    assert res_auth.status_code == 502
    assert res_auth.json()["error"]["code"] == "AI_AUTHENTICATION_ERROR"

    # Simulate 429 Rate limit
    FakeGemmaProvider.set_simulated_error(AIRateLimitError("Rate limit exceeded"))
    res_rate = client.post(f"/api/workflows/{wf_id}/generate-spec")
    assert res_rate.status_code == 429
    assert res_rate.json()["error"]["code"] == "AI_RATE_LIMIT_ERROR"


# 10. Optional Real DigitalOcean Inference Integration Test
def test_real_digitalocean_provider_integration():
    settings = get_settings()
    key = settings.effective_digitalocean_key

    if not key or key == "your_digitalocean_token_here":
        pytest.skip("No real DIGITALOCEAN_INFERENCE_API_KEY configured in environment.")

    provider = DigitalOceanGemmaProvider(api_key=key)
    questions = provider.generate_clarification_questions("Check customer fraud before refund.")
    assert len(questions.questions) > 0
