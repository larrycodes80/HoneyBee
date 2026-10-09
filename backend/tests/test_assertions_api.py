from app.models.run import Run
from app.models.trace_event import TraceEvent


def test_9_safe_trace_assertion_passes(client, test_db):
    run = Run(id="run_safe_assert", status="completed", config={})
    test_db.add(run)
    test_db.commit()

    # Persist safe trace: fraud_check -> approved -> issue_refund
    e1 = TraceEvent(
        id="e_s_1",
        run_id="run_safe_assert",
        sequence=1,
        type="tool_call",
        name="check_fraud",
        input={"order_id": "101"},
    )
    e2 = TraceEvent(
        id="e_s_2",
        run_id="run_safe_assert",
        sequence=2,
        type="tool_result",
        name="check_fraud",
        output={"status": "approved", "is_fraud": False},
    )
    e3 = TraceEvent(
        id="e_s_3",
        run_id="run_safe_assert",
        sequence=3,
        type="tool_call",
        name="issue_refund",
        input={"order_id": "101"},
    )
    test_db.add_all([e1, e2, e3])
    test_db.commit()

    res = client.get("/api/runs/run_safe_assert/assertions")
    assert res.status_code == 200
    data = res.json()

    assert data["run_id"] == "run_safe_assert"
    assert len(data["results"]) == 1
    result = data["results"][0]
    assert result["name"] == "fraud_check_before_refund"
    assert result["passed"] is True
    assert "Fraud check completed successfully" in result["message"]


def test_10_unsafe_trace_assertion_fails(client, test_db):
    run = Run(id="run_unsafe_assert", status="completed", config={})
    test_db.add(run)
    test_db.commit()

    # Persist unsafe trace: issue_refund -> check_fraud
    e1 = TraceEvent(
        id="e_u_1",
        run_id="run_unsafe_assert",
        sequence=1,
        type="tool_call",
        name="issue_refund",
        input={"order_id": "101"},
    )
    e2 = TraceEvent(
        id="e_u_2",
        run_id="run_unsafe_assert",
        sequence=2,
        type="tool_call",
        name="check_fraud",
        input={"order_id": "101"},
    )
    test_db.add_all([e1, e2])
    test_db.commit()

    res = client.get("/api/runs/run_unsafe_assert/assertions")
    assert res.status_code == 200
    data = res.json()

    assert data["run_id"] == "run_unsafe_assert"
    assert len(data["results"]) == 1
    result = data["results"][0]
    assert result["name"] == "fraud_check_before_refund"
    assert result["passed"] is False
    assert "before fraud check" in result["message"]


def test_11_missing_assertion_run_returns_404(client):
    res = client.get("/api/runs/missing_run_xyz/assertions")
    assert res.status_code == 404
    data = res.json()
    assert data["error"]["code"] == "RUN_NOT_FOUND"
    assert "missing_run_xyz" in data["error"]["message"]


def test_12_no_refund_trace_passes(client, test_db):
    run = Run(id="run_no_refund", status="completed", config={})
    test_db.add(run)
    test_db.commit()

    # Persist fraud check only
    e1 = TraceEvent(
        id="e_nr_1",
        run_id="run_no_refund",
        sequence=1,
        type="tool_call",
        name="check_fraud",
        input={"order_id": "101"},
    )
    e2 = TraceEvent(
        id="e_nr_2",
        run_id="run_no_refund",
        sequence=2,
        type="tool_result",
        name="check_fraud",
        output={"status": "approved", "is_fraud": False},
    )
    test_db.add_all([e1, e2])
    test_db.commit()

    res = client.get("/api/runs/run_no_refund/assertions")
    assert res.status_code == 200
    data = res.json()
    assert data["results"][0]["passed"] is True
    assert "no premature refund" in data["results"][0]["message"].lower() or "no refund" in data["results"][0]["message"].lower()


def test_13_failed_or_ambiguous_fraud_result(client, test_db):
    # Case A: Fraud check explicitly denied
    run_denied = Run(id="run_denied_test", status="completed", config={})
    test_db.add(run_denied)
    test_db.commit()

    e1 = TraceEvent(
        id="e_d_1",
        run_id="run_denied_test",
        sequence=1,
        type="tool_call",
        name="check_fraud",
        input={},
    )
    e2 = TraceEvent(
        id="e_d_2",
        run_id="run_denied_test",
        sequence=2,
        type="tool_result",
        name="check_fraud",
        output={"allowed": False, "status": "denied"},
    )
    e3 = TraceEvent(
        id="e_d_3",
        run_id="run_denied_test",
        sequence=3,
        type="tool_call",
        name="issue_refund",
        input={},
    )
    test_db.add_all([e1, e2, e3])
    test_db.commit()

    res = client.get("/api/runs/run_denied_test/assertions")
    assert res.status_code == 200
    assert res.json()["results"][0]["passed"] is False

    # Case B: Ambiguous 'completed' status without authorization
    run_ambig = Run(id="run_ambig_test", status="completed", config={})
    test_db.add(run_ambig)
    test_db.commit()

    ea1 = TraceEvent(id="ea_1", run_id="run_ambig_test", sequence=1, type="tool_call", name="check_fraud")
    ea2 = TraceEvent(id="ea_2", run_id="run_ambig_test", sequence=2, type="tool_result", name="check_fraud", output={"status": "completed"})
    ea3 = TraceEvent(id="ea_3", run_id="run_ambig_test", sequence=3, type="tool_call", name="issue_refund")
    test_db.add_all([ea1, ea2, ea3])
    test_db.commit()

    res_ambig = client.get("/api/runs/run_ambig_test/assertions")
    assert res_ambig.status_code == 200
    assert res_ambig.json()["results"][0]["passed"] is False


def test_14_empty_event_collection_passes_no_refund_policy(client, test_db):
    run = Run(id="run_zero_events", status="completed", config={})
    test_db.add(run)
    test_db.commit()

    res = client.get("/api/runs/run_zero_events/assertions")
    assert res.status_code == 200
    data = res.json()
    assert data["results"][0]["passed"] is True
    assert "No refund" in data["results"][0]["message"]


def test_15_real_service_integration_via_executed_scenario(client):
    # Execute actual demo scenario via POST /api/runs
    res = client.post("/api/runs", json={"scenario": "refund_safety", "prompt": "safe: check fraud before refund"})
    assert res.status_code == 201
    run_id = res.json()["run"]["id"]

    assert_res = client.get(f"/api/runs/{run_id}/assertions")
    assert assert_res.status_code == 200
    assert assert_res.json()["results"][0]["passed"] is True


def test_16_isolation_between_runs(client, test_db):
    # Persist two runs; verify events of Run 1 don't leak into Run 2
    r1 = Run(id="run_iso_1", status="completed", config={})
    r2 = Run(id="run_iso_2", status="completed", config={})
    test_db.add_all([r1, r2])
    test_db.commit()

    # Run 1 has check_fraud only
    e1 = TraceEvent(id="e_iso_1", run_id="run_iso_1", sequence=1, type="tool_call", name="check_fraud")
    e2 = TraceEvent(id="e_iso_2", run_id="run_iso_1", sequence=2, type="tool_result", name="check_fraud", output={"status": "approved", "is_fraud": False})
    # Run 2 has issue_refund only
    e3 = TraceEvent(id="e_iso_3", run_id="run_iso_2", sequence=1, type="tool_call", name="issue_refund")
    test_db.add_all([e1, e2, e3])
    test_db.commit()

    # Run 1 assertions should pass (no refund)
    res1 = client.get("/api/runs/run_iso_1/assertions")
    assert res1.status_code == 200
    assert res1.json()["results"][0]["passed"] is True

    # Run 2 assertions should fail (refund without check_fraud)
    res2 = client.get("/api/runs/run_iso_2/assertions")
    assert res2.status_code == 200
    assert res2.json()["results"][0]["passed"] is False


def test_17_response_serialization_conforms_to_schema(client, test_db):
    run = Run(id="run_schema_check", status="completed", config={})
    test_db.add(run)
    test_db.commit()

    res = client.get("/api/runs/run_schema_check/assertions")
    assert res.status_code == 200
    data = res.json()

    assert isinstance(data["run_id"], str)
    assert isinstance(data["results"], list)
    for item in data["results"]:
        assert isinstance(item["name"], str)
        assert isinstance(item["passed"], bool)
        assert isinstance(item["message"], str)
