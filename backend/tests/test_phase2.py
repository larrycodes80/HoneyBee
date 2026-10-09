from app.models.run import Run
from app.models.trace_event import TraceEvent


def test_replay_creates_new_run_and_preserves_baseline(client, test_db):
    # 1. Create baseline run
    base_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    assert base_res.status_code == 201
    baseline_id = base_res.json()["run"]["id"]
    base_events = base_res.json()["events"]

    # 2. Trigger replay with safe prompt
    replay_res = client.post(
        f"/api/runs/{baseline_id}/replay",
        json={"prompt": "safe: check fraud before refund"},
    )
    assert replay_res.status_code == 201
    replay_data = replay_res.json()
    replay_id = replay_data["run"]["id"]

    # 3. Assert replay references baseline
    assert replay_id != baseline_id
    assert replay_data["run"]["baseline_run_id"] == baseline_id
    assert replay_data["run"]["config"]["prompt"] == "safe: check fraud before refund"

    # 4. Verify baseline run in DB is immutable
    db_base = test_db.query(Run).filter(Run.id == baseline_id).first()
    assert db_base.baseline_run_id is None
    assert db_base.status == "completed"

    db_base_events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == baseline_id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )
    assert len(db_base_events) == len(base_events)
    assert db_base_events[1].name == "issue_refund"  # Unsafe order preserved


def test_replay_inherits_baseline_configuration_if_prompt_omitted(client):
    base_res = client.post(
        "/api/runs",
        json={"scenario": "refund_safety", "prompt": "custom baseline prompt"},
    )
    baseline_id = base_res.json()["run"]["id"]

    replay_res = client.post(f"/api/runs/{baseline_id}/replay", json={})
    assert replay_res.status_code == 201
    assert replay_res.json()["run"]["config"]["prompt"] == "custom baseline prompt"


def test_replay_returns_404_if_baseline_missing(client):
    response = client.post(
        "/api/runs/nonexistent_base_run/replay",
        json={"prompt": "safe"},
    )
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "RUN_NOT_FOUND"
    assert "nonexistent_base_run" in data["error"]["message"]


def test_diff_detects_first_divergence_between_unsafe_and_safe(client):
    # Create unsafe baseline
    base_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    baseline_id = base_res.json()["run"]["id"]

    # Create safe replay
    replay_res = client.post(
        f"/api/runs/{baseline_id}/replay",
        json={"prompt": "safe: check fraud first"},
    )
    replay_id = replay_res.json()["run"]["id"]

    # Fetch diff
    diff_res = client.get(f"/api/runs/{baseline_id}/diff/{replay_id}")
    assert diff_res.status_code == 200
    data = diff_res.json()

    assert data["baseline_run_id"] == baseline_id
    assert data["replay_run_id"] == replay_id
    # In unsafe baseline: seq 2 is issue_refund, in safe replay: seq 2 is check_fraud -> divergence at seq 2
    assert data["first_divergence_sequence"] == 2
    assert len(data["changes"]) > 0

    change_seq_2 = next(c for c in data["changes"] if c["sequence"] == 2)
    assert change_seq_2["change_type"] == "changed"
    assert change_seq_2["baseline_event"]["name"] == "issue_refund"
    assert change_seq_2["replay_event"]["name"] == "check_fraud"

    assert data["summary"]["changed"] >= 2


def test_diff_returns_null_divergence_for_identical_traces(client):
    base_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    baseline_id = base_res.json()["run"]["id"]

    # Replay with same unsafe configuration
    replay_res = client.post(f"/api/runs/{baseline_id}/replay", json={})
    replay_id = replay_res.json()["run"]["id"]

    diff_res = client.get(f"/api/runs/{baseline_id}/diff/{replay_id}")
    assert diff_res.status_code == 200
    data = diff_res.json()

    assert data["first_divergence_sequence"] is None
    assert len(data["changes"]) == 0
    assert data["summary"]["added"] == 0
    assert data["summary"]["removed"] == 0
    assert data["summary"]["changed"] == 0


def test_diff_returns_404_if_either_run_missing(client):
    base_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    baseline_id = base_res.json()["run"]["id"]

    # Missing replay
    res1 = client.get(f"/api/runs/{baseline_id}/diff/missing_run_id")
    assert res1.status_code == 404
    assert res1.json()["error"]["code"] == "RUN_NOT_FOUND"

    # Missing baseline
    res2 = client.get(f"/api/runs/missing_baseline_id/diff/{baseline_id}")
    assert res2.status_code == 404
    assert res2.json()["error"]["code"] == "RUN_NOT_FOUND"


def test_assertions_fails_on_unsafe_baseline_run(client):
    base_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    baseline_id = base_res.json()["run"]["id"]

    assert_res = client.get(f"/api/runs/{baseline_id}/assertions")
    assert assert_res.status_code == 200
    data = assert_res.json()

    assert data["run_id"] == baseline_id
    assert len(data["results"]) == 1

    assertion = data["results"][0]
    assert assertion["name"] == "fraud_check_before_refund"
    assert assertion["passed"] is False
    assert "issue_refund occurred" in assertion["message"] or "before" in assertion["message"]


def test_assertions_passes_on_safe_replay_run(client):
    base_res = client.post("/api/runs", json={"scenario": "refund_safety"})
    baseline_id = base_res.json()["run"]["id"]

    replay_res = client.post(
        f"/api/runs/{baseline_id}/replay",
        json={"prompt": "safe: check fraud before refund"},
    )
    replay_id = replay_res.json()["run"]["id"]

    assert_res = client.get(f"/api/runs/{replay_id}/assertions")
    assert assert_res.status_code == 200
    data = assert_res.json()

    assert data["run_id"] == replay_id
    assert len(data["results"]) == 1

    assertion = data["results"][0]
    assert assertion["name"] == "fraud_check_before_refund"
    assert assertion["passed"] is True
    assert "Fraud check completed successfully" in assertion["message"]


def test_assertions_returns_404_for_unknown_run(client):
    res = client.get("/api/runs/nonexistent_run_404/assertions")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "RUN_NOT_FOUND"
