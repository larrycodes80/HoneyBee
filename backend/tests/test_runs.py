from app.models.run import Run
from app.models.trace_event import TraceEvent


def test_create_default_run_returns_201_and_persists_in_sqlite(client, test_db):
    response = client.post("/api/runs", json={"scenario": "refund_safety"})
    assert response.status_code == 201

    data = response.json()
    assert "run" in data
    assert "events" in data

    run_info = data["run"]
    assert run_info["status"] == "completed"
    assert run_info["baseline_run_id"] is None
    assert run_info["config"]["scenario"] == "refund_safety"

    # Verify run is persisted in SQLite
    run_id = run_info["id"]
    db_run = test_db.query(Run).filter(Run.id == run_id).first()
    assert db_run is not None
    assert db_run.status == "completed"

    # Verify events persisted in SQLite
    db_events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == run_id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )
    assert len(db_events) == len(data["events"])
    assert len(db_events) == 6


def test_default_scenario_records_issue_refund_before_check_fraud(client):
    response = client.post("/api/runs", json={"scenario": "refund_safety"})
    assert response.status_code == 201

    events = response.json()["events"]
    tool_calls = [e for e in events if e["type"] == "tool_call"]
    assert len(tool_calls) == 2

    # In unsafe baseline: issue_refund is call 1, check_fraud is call 2
    assert tool_calls[0]["name"] == "issue_refund"
    assert tool_calls[1]["name"] == "check_fraud"

    # Sequences must be ordered
    assert tool_calls[0]["sequence"] < tool_calls[1]["sequence"]


def test_corrected_policy_records_check_fraud_before_issue_refund(client):
    response = client.post(
        "/api/runs",
        json={
            "scenario": "refund_safety",
            "prompt": "Check fraud status before issuing a refund.",
        },
    )
    assert response.status_code == 201

    events = response.json()["events"]
    tool_calls = [e for e in events if e["type"] == "tool_call"]
    assert len(tool_calls) == 2

    # In corrected policy: check_fraud is call 1, issue_refund is call 2
    assert tool_calls[0]["name"] == "check_fraud"
    assert tool_calls[1]["name"] == "issue_refund"
    assert tool_calls[0]["sequence"] < tool_calls[1]["sequence"]


def test_corrected_policy_records_fraud_check_result_before_issuing_refund(client):
    response = client.post(
        "/api/runs",
        json={
            "scenario": "refund_safety",
            "prompt": "safe: fraud_check_before_refund",
        },
    )
    assert response.status_code == 201

    events = response.json()["events"]
    fraud_result = next(
        e for e in events if e["type"] == "tool_result" and e["name"] == "check_fraud"
    )
    refund_call = next(
        e for e in events if e["type"] == "tool_call" and e["name"] == "issue_refund"
    )

    # Fraud check result must appear strictly before the issue_refund tool call
    assert fraud_result["sequence"] < refund_call["sequence"]
    assert fraud_result["output"]["status"] == "approved"
    assert fraud_result["output"]["is_fraud"] is False


def test_fetching_run_returns_persisted_events_in_sequence_order(client):
    create_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    run_id = create_res.json()["run"]["id"]

    get_res = client.get(f"/api/runs/{run_id}")
    assert get_res.status_code == 200

    data = get_res.json()
    events = data["events"]
    assert len(events) == 6

    sequences = [e["sequence"] for e in events]
    assert sequences == sorted(sequences)
    assert sequences == [1, 2, 3, 4, 5, 6]


def test_run_listing_returns_correct_pagination_fields(client):
    # Create two runs
    client.post("/api/runs", json={"scenario": "refund_safety"})
    client.post("/api/runs", json={"scenario": "refund_safety", "prompt": "safe"})

    response = client.get("/api/runs?limit=10&offset=0")
    assert response.status_code == 200

    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data

    assert data["limit"] == 10
    assert data["offset"] == 0
    assert data["total"] >= 2
    assert len(data["items"]) >= 2

    # Newest runs first
    created_ats = [item["created_at"] for item in data["items"]]
    assert created_ats == sorted(created_ats, reverse=True)


def test_unknown_run_id_returns_404_with_expected_error_shape(client):
    response = client.get("/api/runs/non_existent_run_999")
    assert response.status_code == 404

    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "RUN_NOT_FOUND"
    assert "Run 'non_existent_run_999' was not found." in data["error"]["message"]


def test_unsupported_scenario_returns_clear_client_error(client):
    response = client.post("/api/runs", json={"scenario": "unsupported_scenario_abc"})
    assert response.status_code == 400

    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_SCENARIO"
    assert "unsupported_scenario_abc" in data["error"]["message"]


def test_run_summary_counts_match_recorded_events(client):
    response = client.post("/api/runs", json={"scenario": "refund_safety"})
    assert response.status_code == 201

    data = response.json()
    summary = data["run"]["summary"]
    events = data["events"]

    total_events = len(events)
    tool_calls = len([e for e in events if e["type"] == "tool_call"])
    errors = len([e for e in events if e["type"] == "error"])

    assert summary["event_count"] == total_events
    assert summary["tool_call_count"] == tool_calls
    assert summary["error_count"] == errors
