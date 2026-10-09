import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
import pytest

from honeybee import HoneyBee, HoneyBeeError, HoneyBeeDeliveryError
from app.models.run import Run
from app.models.trace_event import TraceEvent


def test_sdk_sync_function_tracing(client, test_db):
    hb = HoneyBee(client=client, workflow_id="refund-workflow", workflow_version="v1.0")

    @hb.trace
    def calculate_refund(order_id: str, amount: float) -> dict:
        """Calculate eligible refund."""
        return {"order_id": order_id, "refund_amount": amount, "eligible": True}

    # Verify function metadata preserved
    assert calculate_refund.__name__ == "calculate_refund"
    assert "Calculate eligible refund." in calculate_refund.__doc__

    # Execute function
    result = calculate_refund("ord_123", 45.50)
    assert result == {"order_id": "ord_123", "refund_amount": 45.50, "eligible": True}

    # Verify persisted run
    runs = test_db.query(Run).all()
    assert len(runs) >= 1
    run = runs[-1]
    assert run.status == "completed"
    assert run.config["workflow_id"] == "refund-workflow"
    assert run.config["workflow_version"] == "v1.0"

    # Verify events
    events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == run.id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )
    assert len(events) == 2
    assert events[0].type == "agent_start"
    assert events[0].input["order_id"] == "ord_123"
    assert events[0].input["amount"] == 45.50
    assert events[1].type == "agent_end"
    assert events[1].output["eligible"] is True
    assert events[1].event_metadata["status"] == "completed"
    assert "duration_ms" in events[1].event_metadata


@pytest.mark.asyncio
async def test_sdk_async_function_tracing(client, test_db):
    hb = HoneyBee(client=client, workflow_id="async-workflow")

    @hb.trace
    async def async_agent(customer_id: str):
        await asyncio.sleep(0.01)
        return {"status": "ok", "customer_id": customer_id}

    res = await async_agent("cust_999")
    assert res == {"status": "ok", "customer_id": "cust_999"}

    runs = test_db.query(Run).all()
    run = runs[-1]
    assert run.status == "completed"

    events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == run.id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )
    assert len(events) == 2
    assert events[0].type == "agent_start"
    assert events[1].type == "agent_end"


def test_sdk_explicit_internal_event_recording(client, test_db):
    hb = HoneyBee(client=client, workflow_id="fraud-flow")

    @hb.trace
    def refund_pipeline(customer_id: str, amount: float):
        # 1. Record tool call
        hb.record_event(
            type="tool_call",
            name="check_fraud",
            input={"customer_id": customer_id, "amount": amount},
        )
        # 2. Record tool result
        hb.record_event(
            type="tool_result",
            name="check_fraud",
            output={"risk_score": 0.02, "status": "approved", "is_fraud": False},
        )
        # 3. Record tool call for refund
        hb.record_event(
            type="tool_call",
            name="issue_refund",
            input={"customer_id": customer_id, "amount": amount},
        )
        # 4. Record tool result for refund
        hb.record_event(
            type="tool_result",
            name="issue_refund",
            output={"refund_id": "ref_555", "status": "processed"},
        )
        return {"status": "success"}

    res = refund_pipeline("cust_101", 99.0)
    assert res == {"status": "success"}

    run = test_db.query(Run).all()[-1]
    events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == run.id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )

    # 1: agent_start, 2: tool_call (check_fraud), 3: tool_result, 4: tool_call (refund), 5: tool_result, 6: agent_end
    assert len(events) == 6
    assert events[0].type == "agent_start"
    assert events[1].type == "tool_call"
    assert events[1].name == "check_fraud"
    assert events[2].type == "tool_result"
    assert events[2].name == "check_fraud"
    assert events[3].type == "tool_call"
    assert events[3].name == "issue_refund"
    assert events[4].type == "tool_result"
    assert events[4].name == "issue_refund"
    assert events[5].type == "agent_end"

    # Verify behavioral assertions pass on this trace
    assert_res = client.get(f"/api/runs/{run.id}/assertions")
    assert assert_res.status_code == 200
    assert assert_res.json()["results"][0]["passed"] is True


def test_sdk_exception_recording_and_reraise(client, test_db):
    hb = HoneyBee(client=client)

    @hb.trace
    def failing_agent():
        hb.record_event("tool_call", name="failing_tool", input={"query": "test"})
        raise ValueError("Simulated critical failure")

    # Verify exception is re-raised
    with pytest.raises(ValueError, match="Simulated critical failure"):
        failing_agent()

    run = test_db.query(Run).all()[-1]
    assert run.status == "failed"

    events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == run.id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )
    assert len(events) == 4  # agent_start, tool_call, error, agent_end
    assert events[2].type == "error"
    assert events[2].input["error_type"] == "ValueError"
    assert "Simulated critical failure" in events[2].input["message"]
    assert events[3].type == "agent_end"
    assert events[3].output["status"] == "failed"


@pytest.mark.asyncio
async def test_sdk_concurrency_no_event_leakage_async(client, test_db):
    hb = HoneyBee(client=client)

    @hb.trace
    async def worker(worker_id: str):
        hb.record_event("tool_call", name=f"tool_{worker_id}", input={"worker": worker_id})
        await asyncio.sleep(0.02)
        hb.record_event("tool_result", name=f"tool_{worker_id}", output={"done": worker_id})
        return f"result_{worker_id}"

    # Execute 3 workers concurrently
    results = await asyncio.gather(
        worker("A"),
        worker("B"),
        worker("C"),
    )
    assert results == ["result_A", "result_B", "result_C"]

    runs = test_db.query(Run).all()[-3:]
    for r in runs:
        events = (
            test_db.query(TraceEvent)
            .filter(TraceEvent.run_id == r.id)
            .order_by(TraceEvent.sequence.asc())
            .all()
        )
        assert len(events) == 4
        # Verify events belong strictly to one worker
        worker_id = events[0].input["worker_id"]
        assert events[1].name == f"tool_{worker_id}"
        assert events[2].name == f"tool_{worker_id}"
        assert events[2].output["done"] == worker_id


def test_sdk_concurrency_no_event_leakage_threads(client, test_db):
    import threading
    lock = threading.Lock()

    class ThreadSafeTestClient:
        def __init__(self, inner):
            self.inner = inner
        def post(self, *args, **kwargs):
            with lock:
                return self.inner.post(*args, **kwargs)
        def get(self, *args, **kwargs):
            with lock:
                return self.inner.get(*args, **kwargs)

    hb = HoneyBee(client=ThreadSafeTestClient(client))

    @hb.trace
    def thread_worker(name: str):
        hb.record_event("tool_call", name=f"thread_tool_{name}", input={"name": name})
        time.sleep(0.01)
        hb.record_event("tool_result", name=f"thread_tool_{name}", output={"finished": name})
        return f"thread_result_{name}"

    with ThreadPoolExecutor(max_workers=3) as executor:
        futs = [executor.submit(thread_worker, f"T{i}") for i in range(3)]
        res = [f.result() for f in futs]

    assert len(res) == 3
    runs = test_db.query(Run).all()[-3:]
    for r in runs:
        events = (
            test_db.query(TraceEvent)
            .filter(TraceEvent.run_id == r.id)
            .order_by(TraceEvent.sequence.asc())
            .all()
        )
        assert len(events) == 4
        thread_name = events[0].input["name"]
        assert events[1].name == f"thread_tool_{thread_name}"
        assert events[2].output["finished"] == thread_name


def test_sdk_redaction_and_data_protection(client, test_db):
    hb = HoneyBee(
        client=client,
        redact_keys={"custom_ssn", "secret_pass"},
    )

    @hb.trace
    def sensitive_agent(payload: dict):
        hb.record_event(
            "tool_call",
            name="auth_service",
            input={
                "password": "supersecretpassword123",
                "custom_ssn": "000-11-2222",
                "auth_header": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
                "public_data": "visible_information",
            },
        )
        return {
            "api_key": "sk-1234567890abcdef12345678",
            "account_id": "acc_99",
        }

    res = sensitive_agent({"token": "secret_token_123", "normal_id": "123"})
    assert res["account_id"] == "acc_99"

    run = test_db.query(Run).all()[-1]
    events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == run.id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )

    # 1. Start event inputs redacted
    start_input = events[0].input["payload"]
    assert start_input["token"] == "[REDACTED]"
    assert start_input["normal_id"] == "123"

    # 2. Tool call inputs redacted
    tool_input = events[1].input
    assert tool_input["password"] == "[REDACTED]"
    assert tool_input["custom_ssn"] == "[REDACTED]"
    assert "[REDACTED]" in tool_input["auth_header"]
    assert tool_input["public_data"] == "visible_information"

    # 3. Agent end output redacted
    end_output = events[2].output
    assert end_output["api_key"] == "[REDACTED]"
    assert end_output["account_id"] == "acc_99"


def test_sdk_omission_of_inputs_and_outputs(client, test_db):
    hb = HoneyBee(client=client, capture_input=False, capture_output=False)

    @hb.trace
    def private_agent(secret_data: str):
        return "private_result"

    res = private_agent("sensitive_input")
    assert res == "private_result"

    run = test_db.query(Run).all()[-1]
    events = (
        test_db.query(TraceEvent)
        .filter(TraceEvent.run_id == run.id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )
    assert events[0].input == {"omitted": True}
    assert events[1].output == {"omitted": True}


def test_sdk_delivery_failure_raises_honeybee_delivery_error(test_db):
    # Direct bad URL to force network/delivery failure with fail_fast=True
    hb = HoneyBee(base_url="http://127.0.0.1:59999", fail_fast=True, timeout=0.1)

    @hb.trace
    def dummy_func():
        return "ok"

    with pytest.raises(HoneyBeeDeliveryError):
        dummy_func()


def test_sdk_manual_run_lifecycle_and_batch_ingest(client, test_db):
    # 1. Test POST /api/runs/init
    init_res = client.post(
        "/api/runs/init",
        json={
            "workflow_id": "wf-manual",
            "workflow_version": "v3.0",
            "scenario": "manual_test",
        },
    )
    assert init_res.status_code == 201
    run_id = init_res.json()["run"]["id"]

    # 2. Test POST /api/runs/{run_id}/events
    evt_res = client.post(
        f"/api/runs/{run_id}/events",
        json={
            "events": [
                {"type": "agent_start", "name": "start", "input": {"step": 1}},
                {"type": "tool_call", "name": "call_1", "input": {"arg": "val"}},
            ]
        },
    )
    assert evt_res.status_code == 200
    assert evt_res.json()["ingested_count"] == 2

    # 3. Test POST /api/runs/{run_id}/finalize
    fin_res = client.post(
        f"/api/runs/{run_id}/finalize",
        json={"status": "completed", "summary": {"custom_stat": 42}},
    )
    assert fin_res.status_code == 200
    assert fin_res.json()["run"]["status"] == "completed"

    # 4. Test POST /api/runs/ingest (one-shot batch)
    batch_res = client.post(
        "/api/runs/ingest",
        json={
            "workflow_id": "wf-batch",
            "status": "completed",
            "events": [
                {"type": "agent_start", "name": "agent", "input": {}},
                {"type": "agent_end", "name": "agent", "output": {"ok": True}},
            ],
        },
    )
    assert batch_res.status_code == 201
    batch_data = batch_res.json()
    assert batch_data["run"]["status"] == "completed"
    assert len(batch_data["events"]) == 2
