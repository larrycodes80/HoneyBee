import uuid
from datetime import datetime, timezone
from app.models.run import Run
from app.models.trace_event import TraceEvent


def test_1_valid_baseline_and_replay_diff(client, test_db):
    # Create baseline run
    b_run = Run(
        id="run_base_1",
        status="completed",
        config={"scenario": "refund_safety", "prompt": "default"},
        summary={"event_count": 2, "tool_call_count": 1, "error_count": 0},
    )
    r_run = Run(
        id="run_rep_1",
        status="completed",
        baseline_run_id="run_base_1",
        config={"scenario": "refund_safety", "prompt": "safe"},
        summary={"event_count": 2, "tool_call_count": 1, "error_count": 0},
    )
    test_db.add_all([b_run, r_run])
    test_db.commit()

    # Add events
    evt1 = TraceEvent(
        id="evt_b_1",
        run_id="run_base_1",
        sequence=1,
        type="agent_start",
        name="agent_start",
        input={"task": "refund"},
        output=None,
        event_metadata={},
    )
    evt2 = TraceEvent(
        id="evt_b_2",
        run_id="run_base_1",
        sequence=2,
        type="tool_call",
        name="issue_refund",
        input={"amount": 100},
        output=None,
        event_metadata={},
    )
    evt3 = TraceEvent(
        id="evt_r_1",
        run_id="run_rep_1",
        sequence=1,
        type="agent_start",
        name="agent_start",
        input={"task": "refund"},
        output=None,
        event_metadata={},
    )
    evt4 = TraceEvent(
        id="evt_r_2",
        run_id="run_rep_1",
        sequence=2,
        type="tool_call",
        name="check_fraud",
        input={"amount": 100},
        output=None,
        event_metadata={},
    )
    test_db.add_all([evt1, evt2, evt3, evt4])
    test_db.commit()

    res = client.get("/api/runs/run_base_1/diff/run_rep_1")
    assert res.status_code == 200
    data = res.json()

    assert data["baseline_run_id"] == "run_base_1"
    assert data["replay_run_id"] == "run_rep_1"
    assert data["first_divergence_sequence"] == 2
    assert len(data["changes"]) == 1
    assert data["changes"][0]["change_type"] == "changed"
    assert data["changes"][0]["baseline_event"]["name"] == "issue_refund"
    assert data["changes"][0]["replay_event"]["name"] == "check_fraud"


def test_2_meaningfully_different_traces(client):
    # Execute actual demo scenario via API: unsafe baseline and safe replay
    base_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    assert base_res.status_code == 201
    baseline_id = base_res.json()["run"]["id"]

    replay_res = client.post(
        f"/api/runs/{baseline_id}/replay",
        json={"prompt": "safe: check fraud before refund"},
    )
    assert replay_res.status_code == 201
    replay_id = replay_res.json()["run"]["id"]

    diff_res = client.get(f"/api/runs/{baseline_id}/diff/{replay_id}")
    assert diff_res.status_code == 200
    diff_data = diff_res.json()

    assert diff_data["baseline_run_id"] == baseline_id
    assert diff_data["replay_run_id"] == replay_id
    assert diff_data["first_divergence_sequence"] == 2
    assert len(diff_data["changes"]) >= 2
    assert diff_data["summary"]["changed"] >= 2


def test_3_equivalent_semantic_traces(client, test_db):
    # Two runs with identical event semantics but different IDs and timestamps
    r1 = Run(id="run_eq_1", status="completed", config={})
    r2 = Run(id="run_eq_2", status="completed", config={})
    test_db.add_all([r1, r2])
    test_db.commit()

    e1 = TraceEvent(
        id="e_1",
        run_id="run_eq_1",
        sequence=1,
        type="agent_start",
        name="start",
        input={"test": True},
        output=None,
        timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    e2 = TraceEvent(
        id="e_2",
        run_id="run_eq_2",
        sequence=1,
        type="agent_start",
        name="start",
        input={"test": True},
        output=None,
        timestamp=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    test_db.add_all([e1, e2])
    test_db.commit()

    res = client.get("/api/runs/run_eq_1/diff/run_eq_2")
    assert res.status_code == 200
    data = res.json()
    assert data["first_divergence_sequence"] is None
    assert len(data["changes"]) == 0
    assert data["summary"]["added"] == 0
    assert data["summary"]["removed"] == 0
    assert data["summary"]["changed"] == 0


def test_4_missing_baseline_returns_404(client):
    res = client.get("/api/runs/nonexistent_base/diff/any_rep")
    assert res.status_code == 404
    data = res.json()
    assert data["error"]["code"] == "RUN_NOT_FOUND"
    assert "nonexistent_base" in data["error"]["message"]


def test_5_missing_replay_returns_404(client, test_db):
    b = Run(id="run_exists", status="completed", config={})
    test_db.add(b)
    test_db.commit()

    res = client.get("/api/runs/run_exists/diff/nonexistent_rep")
    assert res.status_code == 404
    data = res.json()
    assert data["error"]["code"] == "RUN_NOT_FOUND"
    assert "nonexistent_rep" in data["error"]["message"]


def test_6_empty_event_collections(client, test_db):
    r1 = Run(id="run_empty_1", status="completed", config={})
    r2 = Run(id="run_empty_2", status="completed", config={})
    test_db.add_all([r1, r2])
    test_db.commit()

    res = client.get("/api/runs/run_empty_1/diff/run_empty_2")
    assert res.status_code == 200
    data = res.json()
    assert data["first_divergence_sequence"] is None
    assert len(data["changes"]) == 0
    assert data["summary"]["added"] == 0
    assert data["summary"]["removed"] == 0
    assert data["summary"]["changed"] == 0


def test_7_event_ordering_respects_sequence_in_db(client, test_db):
    r1 = Run(id="run_order_1", status="completed", config={})
    r2 = Run(id="run_order_2", status="completed", config={})
    test_db.add_all([r1, r2])
    test_db.commit()

    # Insert sequence 2 BEFORE sequence 1 in DB
    e_seq2 = TraceEvent(
        id="e_seq2",
        run_id="run_order_1",
        sequence=2,
        type="tool_call",
        name="tool_B",
        input=None,
        output=None,
    )
    e_seq1 = TraceEvent(
        id="e_seq1",
        run_id="run_order_1",
        sequence=1,
        type="tool_call",
        name="tool_A",
        input=None,
        output=None,
    )
    test_db.add_all([e_seq2, e_seq1])
    test_db.commit()

    # Replay has identical events
    er_seq1 = TraceEvent(
        id="er_seq1",
        run_id="run_order_2",
        sequence=1,
        type="tool_call",
        name="tool_A",
        input=None,
        output=None,
    )
    er_seq2 = TraceEvent(
        id="er_seq2",
        run_id="run_order_2",
        sequence=2,
        type="tool_call",
        name="tool_B",
        input=None,
        output=None,
    )
    test_db.add_all([er_seq1, er_seq2])
    test_db.commit()

    res = client.get("/api/runs/run_order_1/diff/run_order_2")
    assert res.status_code == 200
    data = res.json()
    # Since DB ordered by sequence.asc(), both traces match sequence-for-sequence
    assert data["first_divergence_sequence"] is None
    assert len(data["changes"]) == 0


def test_8_self_comparison(client):
    base_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    run_id = base_res.json()["run"]["id"]

    res = client.get(f"/api/runs/{run_id}/diff/{run_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["baseline_run_id"] == run_id
    assert data["replay_run_id"] == run_id
    assert data["first_divergence_sequence"] is None
    assert len(data["changes"]) == 0
