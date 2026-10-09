from unittest.mock import patch
from app.models.run import Run
from app.models.trace_event import TraceEvent
from app.services.agent_executor import AgentExecutor


def test_replay_creates_new_run_linked_to_baseline(client, test_db):
    """
    Proves:
    1. A replay receives a new run ID.
    2. replay.baseline_run_id equals the original run ID.
    4. The replay inherits the baseline scenario.
    5. The prompt override appears in the replay configuration.
    """
    # 1. Create baseline
    base_res = client.post(
        "/api/runs",
        json={"scenario": "refund_safety", "prompt": "Process standard refund"},
    )
    assert base_res.status_code == 201
    baseline_data = base_res.json()["run"]
    baseline_id = baseline_data["id"]

    # 2. Trigger replay
    replay_res = client.post(
        f"/api/runs/{baseline_id}/replay",
        json={"prompt": "Always check fraud before issuing a refund."},
    )
    assert replay_res.status_code == 201
    replay_data = replay_res.json()["run"]
    replay_id = replay_data["id"]

    # Prove 1: A replay receives a new run ID
    assert replay_id != baseline_id
    assert replay_id.startswith("run_")

    # Prove 2: replay.baseline_run_id equals the original run ID
    assert replay_data["baseline_run_id"] == baseline_id

    # Prove 4: The replay inherits the baseline scenario
    assert replay_data["config"]["scenario"] == baseline_data["config"]["scenario"]

    # Prove 5: The prompt override appears in the replay configuration
    assert replay_data["config"]["prompt"] == "Always check fraud before issuing a refund."

    # Check persistence in database
    db_replay = test_db.query(Run).filter(Run.id == replay_id).first()
    assert db_replay is not None
    assert db_replay.baseline_run_id == baseline_id
    assert db_replay.status == "completed"


def test_baseline_immutability_before_and_after_replay(client, test_db):
    """
    Proves:
    3. The serialized baseline is unchanged after replay (compared via persisted values).
    5. The prompt override appears only in the replay, baseline prompt is unchanged.
    7. No replay events are added to the baseline.
    """
    # 1. Create baseline
    base_res = client.post(
        "/api/runs",
        json={"scenario": "refund_safety", "prompt": "Default unsafe refund process"},
    )
    assert base_res.status_code == 201
    baseline_id = base_res.json()["run"]["id"]

    # Query and serialize baseline state before replay
    base_run_before = test_db.query(Run).filter(Run.id == baseline_id).first()
    assert base_run_before is not None
    base_serialized_before = {
        "id": base_run_before.id,
        "status": base_run_before.status,
        "baseline_run_id": base_run_before.baseline_run_id,
        "config": dict(base_run_before.config),
        "summary": dict(base_run_before.summary),
    }
    base_events_before = [
        (e.id, e.sequence, e.type, e.name, e.run_id)
        for e in (
            test_db.query(TraceEvent)
            .filter(TraceEvent.run_id == baseline_id)
            .order_by(TraceEvent.sequence.asc())
            .all()
        )
    ]

    # 2. Execute replay with prompt override
    replay_res = client.post(
        f"/api/runs/{baseline_id}/replay",
        json={"prompt": "Safe policy: verify fraud prior to refunding"},
    )
    assert replay_res.status_code == 201

    # Query and serialize baseline state after replay
    test_db.expire_all()
    base_run_after = test_db.query(Run).filter(Run.id == baseline_id).first()
    base_serialized_after = {
        "id": base_run_after.id,
        "status": base_run_after.status,
        "baseline_run_id": base_run_after.baseline_run_id,
        "config": dict(base_run_after.config),
        "summary": dict(base_run_after.summary),
    }
    base_events_after = [
        (e.id, e.sequence, e.type, e.name, e.run_id)
        for e in (
            test_db.query(TraceEvent)
            .filter(TraceEvent.run_id == baseline_id)
            .order_by(TraceEvent.sequence.asc())
            .all()
        )
    ]

    # Prove 3: The serialized baseline is unchanged after replay
    assert base_serialized_after == base_serialized_before

    # Prove 7: No replay events are added to the baseline
    assert base_events_after == base_events_before

    # Prove 5 (continued): Baseline prompt was not mutated by prompt override
    assert base_serialized_after["config"]["prompt"] == "Default unsafe refund process"


def test_replay_events_isolation_and_corrected_policy_ordering(client, test_db):
    """
    Proves:
    6. Replay events use the replay run ID.
    8. The corrected policy produces check_fraud before issue_refund when supported.
    """
    # 1. Create baseline
    base_res = client.post(
        "/api/runs",
        json={"scenario": "refund_safety", "prompt": "Default unsafe refund"},
    )
    assert base_res.status_code == 201
    baseline_id = base_res.json()["run"]["id"]

    # 2. Execute replay with safe policy trigger
    replay_res = client.post(
        f"/api/runs/{baseline_id}/replay",
        json={"prompt": "check_fraud_first before issuing refund"},
    )
    assert replay_res.status_code == 201
    replay_data = replay_res.json()
    replay_id = replay_data["run"]["id"]
    replay_events = replay_data["events"]

    # Prove 6: Replay events use the replay run ID
    assert len(replay_events) == 6
    for event in replay_events:
        assert event["run_id"] == replay_id
        assert event["run_id"] != baseline_id

    # Verify event run_ids in database
    db_replay_events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == replay_id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )
    assert len(db_replay_events) == 6
    for db_evt in db_replay_events:
        assert db_evt.run_id == replay_id

    # Prove 8: The corrected policy produces check_fraud before issue_refund
    tool_calls = [e for e in replay_events if e["type"] == "tool_call"]
    assert len(tool_calls) == 2
    assert tool_calls[0]["name"] == "check_fraud"
    assert tool_calls[1]["name"] == "issue_refund"
    assert tool_calls[0]["sequence"] < tool_calls[1]["sequence"]

    tool_results = [e for e in replay_events if e["type"] == "tool_result"]
    assert len(tool_results) == 2
    fraud_result = next(r for r in tool_results if r["name"] == "check_fraud")
    refund_call = next(c for c in tool_calls if c["name"] == "issue_refund")
    assert fraud_result["sequence"] < refund_call["sequence"]


def test_replay_returns_404_when_baseline_not_found(client):
    """
    Proves:
    9. A missing baseline returns HTTP 404.
    """
    missing_id = "run_nonexistent_9999"
    response = client.post(
        f"/api/runs/{missing_id}/replay",
        json={"prompt": "safe refund prompt"},
    )
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "RUN_NOT_FOUND"
    assert missing_id in data["error"]["message"]


def test_replay_persists_failed_status_and_error_event_on_execution_failure(client, test_db):
    """
    Proves:
    10. An execution failure persists a failed replay and error event when supported.
    """
    # 1. Create valid baseline run
    base_res = client.post(
        "/api/runs",
        json={"scenario": "refund_safety", "prompt": "Initial baseline"},
    )
    assert base_res.status_code == 201
    baseline_id = base_res.json()["run"]["id"]

    # 2. Patch AgentExecutor.execute_scenario to simulate an execution crash
    crash_message = "Simulated deterministic agent crash"
    with patch.object(
        AgentExecutor,
        "execute_scenario",
        side_effect=RuntimeError(crash_message),
    ):
        response = client.post(
            f"/api/runs/{baseline_id}/replay",
            json={"prompt": "safe retry"},
        )
        assert response.status_code in (500, 400)
        assert crash_message in str(response.json())

    # Prove 10: An execution failure persists a failed replay and error event
    failed_replay = (
        test_db.query(Run)
        .filter(Run.baseline_run_id == baseline_id)
        .order_by(Run.created_at.desc())
        .first()
    )
    assert failed_replay is not None
    assert failed_replay.status == "failed"
    assert failed_replay.baseline_run_id == baseline_id

    error_events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == failed_replay.id, TraceEvent.type == "error")
        .all()
    )
    assert len(error_events) >= 1
    assert error_events[0].name in ("execution_error", "replay_execution_error")
    assert crash_message in str(error_events[0].input)
