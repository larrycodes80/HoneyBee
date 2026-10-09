# HoneyBee Backend & Python SDK

FastAPI + SQLAlchemy + SQLite backend foundation for agent trace recording, replaying, behavioral assertions, and SDK instrumentation.

---

## 1. HoneyBee Python SDK

The HoneyBee Python SDK allows developers to instrument real agent workflows, automatically capturing function inputs, outputs, errors, duration, and explicit internal tool/model events.

### Installation & Quickstart

```python
from honeybee import HoneyBee

# 1. Initialize client
hb = HoneyBee(
    base_url="http://localhost:8000",
    workflow_id="support-refunds",
    workflow_version="v1.0",
)

# 2. Decorate sync or async agent functions
@hb.trace
def support_agent(customer_id: str, message: str) -> dict:
    # 3. Explicitly record internal agent steps
    hb.record_event(
        type="tool_call",
        name="check_fraud",
        input={"customer_id": customer_id},
    )

    fraud_res = {"risk_score": 0.05, "status": "approved", "is_fraud": False}

    hb.record_event(
        type="tool_result",
        name="check_fraud",
        output=fraud_res,
    )

    hb.record_event(
        type="tool_call",
        name="issue_refund",
        input={"customer_id": customer_id, "amount": 50.0},
    )

    refund_res = {"refund_id": "ref_101", "status": "processed"}

    hb.record_event(
        type="tool_result",
        name="issue_refund",
        output=refund_res,
    )

    return {"status": "success", "refund_id": "ref_101"}

# Execute the agent
result = support_agent("customer-123", "Can I get a refund?")
```

### Async Functions Support

```python
@hb.trace
async def async_support_agent(customer_id: str, prompt: str):
    await asyncio.sleep(0.1)
    hb.record_event("tool_call", name="lookup_customer", input={"customer_id": customer_id})
    return {"status": "completed"}
```

### Redaction and Data Protection

The SDK automatically sanitizes sensitive fields before transmitting them:

```python
hb = HoneyBee(
    base_url="http://localhost:8000",
    # Automatically redacts: api_key, token, password, secret, credit_card, etc.
    redact_keys={"custom_ssn", "secret_pass"},
    capture_input=True,    # Set False to omit input arguments
    capture_output=True,   # Set False to omit return value
    fail_fast=True,        # Raise HoneyBeeDeliveryError on delivery failure
)
```

### Context-Local Concurrency

The SDK utilizes `contextvars.ContextVar` to bind internal `hb.record_event()` calls to the currently active run. Concurrent `asyncio` tasks and concurrent OS threads in `ThreadPoolExecutor` have isolated execution contexts with zero cross-run event leakage.

---

## 2. Backend Ingestion API Endpoints

The backend provides endpoints for both incremental and batch trace ingestion:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/runs/init` | Initialize an external run with workflow ID, version, and custom config |
| `POST` | `/api/runs/{run_id}/events` | Submit one or more ordered trace events |
| `POST` | `/api/runs/{run_id}/finalize` | Finalize a run with its final status (`completed` / `failed`) and summary |
| `POST` | `/api/runs/ingest` | Batch ingest run metadata and events in a single transaction |
| `GET`  | `/api/runs/{run_id}` | Retrieve persisted run and ordered events |
| `GET`  | `/api/runs/{base}/diff/{rep}` | Compare traces and detect sequence divergences |
| `GET`  | `/api/runs/{run_id}/assertions` | Evaluate behavioral safety assertions |

---

## 3. Running Backend Tests

```bash
cd backend
pytest tests -v
```
