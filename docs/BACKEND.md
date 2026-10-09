# TraceForge — Backend Engineering Specification

**Product:** TraceForge  
**Backend:** FastAPI + Python + SQLite  
**Purpose:** Agent execution, trace recording, replay, behavioral diffing, and assertion evaluation  
**Status:** Hackathon MVP  
**Target implementation time:** 3 hours

---

## 1. Backend Objectives

The backend is responsible for the core functionality of TraceForge.

It must:

1. Execute a supported agent scenario.
2. Record ordered execution events.
3. Persist runs and trace events.
4. Replay a saved scenario with modified configuration.
5. Reuse controlled tool results when replay matching rules permit.
6. Compare baseline and replay traces.
7. Identify the first meaningful divergence.
8. Evaluate behavioral assertions against actual trace events.
9. Expose a REST API consumed by the frontend.

The backend must remain independent of the frontend implementation. The frontend must not implement its own trace comparison or assertion logic.

### Core principle

**Every result shown in the UI must be derived from actual backend execution data.**

No hardcoded diff results, fabricated event sequences, or manually assigned assertion outcomes are permitted.

---

## 2. Technology Stack

| Component         | Technology                                                   |
| ----------------- | ------------------------------------------------------------ |
| Language          | Python 3.13+                                                 |
| API framework     | FastAPI                                                      |
| Validation        | Pydantic v2                                                  |
| Database          | SQLite                                                       |
| Database access   | Python `sqlite3` for MVP                                     |
| ASGI server       | Uvicorn                                                      |
| Tests             | pytest                                                       |
| API documentation | FastAPI OpenAPI                                              |
| Model execution   | Deterministic mock decisions initially; optional LLM adapter |

Use the Python standard library wherever practical to minimize setup time.

SQLAlchemy and Alembic are not required for this hackathon MVP.

---

## 3. Suggested Directory Structure

```text
traceforge/
├── PRODUCT.md
├── BACKEND.md
├── README.md
├── LICENSE
├── .gitignore
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── schemas.py
│   │   ├── api/
│   │   │   ├── runs.py
│   │   │   ├── replay.py
│   │   │   └── diff.py
│   │   ├── core/
│   │   │   ├── agent.py
│   │   │   ├── recorder.py
│   │   │   ├── replay_engine.py
│   │   │   ├── diff_engine.py
│   │   │   ├── assertions.py
│   │   │   └── tool_registry.py
│   │   └── services/
│   │       └── run_service.py
│   └── tests/
│       ├── test_recorder.py
│       ├── test_replay.py
│       ├── test_diff.py
│       └── test_assertions.py
└── frontend/
    └── ...
```

This is a logical structure, not a requirement to create every file before the core flow works. If time is limited, consolidate modules and refactor only after the end-to-end demo succeeds.

---

## 4. Core Domain Models

All API request and response models should be defined using Pydantic.

### 4.1 Run

A run represents one execution of an agent scenario.

```python
class Run:
    id: str
    scenario_id: str
    baseline_run_id: str | None
    system_prompt: str
    model_config: dict
    status: str
    final_output: dict | str | None
    created_at: str
    completed_at: str | None
```

Allowed statuses:

- `running`
- `completed`
- `failed`

A baseline run has `baseline_run_id = None`.

A replay run references the run against which it is being compared.

### 4.2 TraceEvent

A trace event represents one execution step.

```python
class TraceEvent:
    id: str
    run_id: str
    step_index: int
    event_type: str
    name: str | None
    input: dict | str | None
    arguments: dict | None
    output: dict | str | None
    error: dict | str | None
    timestamp: str
```

Supported event types:

- `run_started`
- `model_request`
- `model_response`
- `tool_call`
- `tool_result`
- `error`
- `run_completed`

Event indices must increase monotonically within each run, starting at zero.

The event recorder is the sole authority for assigning step indices.

### 4.3 ReplayRequest

```python
class ReplayRequest:
    system_prompt: str | None
    model_config: dict | None
    scenario_input: dict | None
    tool_result_policy: str
```

Supported `tool_result_policy` values:

- `matched_fixtures_only`
- `fail_on_unmatched`

For the MVP, `matched_fixtures_only` allows configured or recorded fixtures to be reused for matching tool interactions. Unmatched calls must not receive an unrelated cached response.

`fail_on_unmatched` rejects unmatched tool interactions rather than executing an unconfigured operation.

If a replay omits `scenario_input`, use the original scenario input.

If a replay omits `system_prompt`, use the original prompt.

The model configuration must be explicit in the resulting run, even when inherited from the baseline.

### 4.4 DiffResult

```python
class DiffResult:
    baseline_run_id: str
    replay_run_id: str
    changes: list
    first_divergence: dict | None
    summary: dict
```

Each change should include:

- `change_type`
- `baseline_step_index`
- `replay_step_index`
- `field`
- `baseline_value`
- `replay_value`
- `severity`

Suggested change types:

- `added`
- `removed`
- `changed`
- `reordered`

Severity is presentation metadata. It must not substitute for an assertion result.

### 4.5 AssertionResult

```python
class AssertionResult:
    run_id: str
    assertion_type: str
    description: str
    status: str
    evidence: dict
```

Allowed statuses:

- `passed`
- `failed`
- `error`

`passed` and `failed` must be computed from trace events. Use `error` when the assertion could not be evaluated.

---

## 5. Database Schema

Use SQLite with foreign-key enforcement enabled.

### Table: `runs`

| Column                | Type | Constraints                    |
| --------------------- | ---- | ------------------------------ |
| `id`                  | TEXT | Primary key                    |
| `scenario_id`         | TEXT | Not null                       |
| `baseline_run_id`     | TEXT | Nullable, references `runs.id` |
| `system_prompt`       | TEXT | Not null                       |
| `model_config_json`   | TEXT | Not null                       |
| `scenario_input_json` | TEXT | Not null                       |
| `status`              | TEXT | Not null                       |
| `final_output_json`   | TEXT | Nullable                       |
| `created_at`          | TEXT | Not null                       |
| `completed_at`        | TEXT | Nullable                       |

### Table: `trace_events`

| Column           | Type    | Constraints                    |
| ---------------- | ------- | ------------------------------ |
| `id`             | TEXT    | Primary key                    |
| `run_id`         | TEXT    | Not null, references `runs.id` |
| `step_index`     | INTEGER | Not null                       |
| `event_type`     | TEXT    | Not null                       |
| `name`           | TEXT    | Nullable                       |
| `input_json`     | TEXT    | Nullable                       |
| `arguments_json` | TEXT    | Nullable                       |
| `output_json`    | TEXT    | Nullable                       |
| `error_json`     | TEXT    | Nullable                       |
| `timestamp`      | TEXT    | Not null                       |

Create a unique constraint on `(run_id, step_index)`.

### Persistence requirements

- Store JSON-compatible values as serialized JSON.
- Retrieve events in ascending `step_index` order.
- Use parameterized SQL queries.
- Enable SQLite foreign keys.
- Persist completed and failed runs.
- Do not overwrite the baseline when replaying.
- Keep timestamps in UTC ISO 8601 format.

For a single-process hackathon application, a single SQLite connection strategy with proper transaction handling is sufficient.

---

## 6. Trace Recorder

The recorder must be called by the agent runner and replay engine.

It must not depend on the frontend or a model provider.

### Responsibilities

1. Initialize a run's event sequence.
2. Assign unique event IDs.
3. Assign monotonically increasing step indices.
4. Add timestamps.
5. Persist events.
6. Expose events in execution order.

### Suggested interface

```python
class TraceRecorder:
    def __init__(self, run_id, repository):
        ...

    def record(
        self,
        event_type: str,
        name: str | None = None,
        input=None,
        arguments=None,
        output=None,
        error=None,
    ):
        ...

    def get_events(self) -> list:
        ...
```

The interface is illustrative; adapt it to the chosen implementation.

### Recording requirements

- Record tool calls before invoking the tool.
- Record tool results after the tool returns.
- Record errors when tool execution or agent execution fails.
- Record run completion only after the run has reached a terminal state.
- Ensure the final persisted trace accurately reflects execution.

Do not discard earlier events if a later step fails.

---

## 7. Agent Execution Engine

The initial agent should be deliberately small.

It needs only enough behavior to demonstrate a real failure, a corrected execution, and a meaningful trace comparison.

### Sample scenario

Input:

```json
{
  "order_id": 42,
  "refund_amount": 50
}
```

Available tools:

```text
check_fraud_flags(order_id)
issue_refund(order_id, amount)
```

The expected behavior is:

1. Check fraud flags.
2. Inspect the returned fraud status.
3. Issue a refund only if the order is safe.
4. Do not issue a refund if the fraud check fails or reports a flag.

### Agent interface

```python
def run_agent(
    scenario_input: dict,
    system_prompt: str,
    model_config: dict,
    recorder: TraceRecorder,
    tool_registry,
) -> dict:
    ...
```

The actual implementation may use an object-based interface.

### Execution requirements

- Every model decision or mock decision must be observable.
- Every tool invocation must generate a `tool_call` event.
- Every tool result must generate a `tool_result` event.
- Tool exceptions must generate error events.
- The final output must be saved in the run record.
- Run status must accurately reflect completion or failure.

### Deterministic mock decisions

The MVP may use a mock decision provider to ensure a reliable demonstration.

The mock provider should support at least two distinct configurations:

- A baseline configuration that produces an unsafe tool-call sequence.
- A corrected configuration that checks fraud before issuing a refund.

The selected configuration must affect the actual agent execution. It must not merely change a displayed label or substitute a prewritten diff.

Where feasible, the corrected behavior should be driven by the changed prompt or decision configuration. If the mock provider uses scripted decisions instead, document that limitation clearly.

---

## 8. Tool Registry and Replay Safety

All tools must be registered explicitly.

The agent must not be allowed to execute arbitrary function names supplied by a model response.

### Tool registry responsibilities

- Map registered tool names to implementations.
- Validate required arguments.
- Execute allowed tools.
- Capture results and exceptions.
- Apply replay fixture rules where appropriate.

### Tool fixture model

A fixture should contain:

```json
{
  "tool_name": "check_fraud_flags",
  "arguments": {
    "order_id": 42
  },
  "result": {
    "flagged": false
  }
}
```

The matching implementation must compare tool names and arguments using a documented matching policy.

For the MVP, compare JSON-compatible argument values structurally rather than comparing their serialized key order.

### Replay matching rules

1. Identify the next expected recorded tool interaction.
2. Compare its tool name and arguments against the new interaction.
3. If they match, reuse the corresponding recorded result when the selected replay policy permits.
4. If they do not match, mark the interaction as unmatched.
5. Do not return an unrelated recorded result.
6. Apply the selected policy to unmatched calls.
7. Record the resulting interaction and any replay errors.

For deterministic demonstration, mock fixtures may be registered for both expected and newly generated calls.

Do not replay side-effecting operations against real external services in the MVP.

---

## 9. Replay Engine

### Responsibilities

- Load the baseline run.
- Load its scenario input.
- Apply replay overrides.
- Create a new run.
- Execute the scenario using the configured replay policy.
- Persist the new trace.
- Evaluate the configured assertions.
- Return the replay run identifier.

### Replay invariants

- The baseline must remain immutable.
- A replay always creates a new run.
- `baseline_run_id` must reference the baseline.
- The replay must store the prompt and model configuration actually used.
- Replay events must be recorded through the same recorder abstraction.
- Unmatched tool calls must remain visible in the trace.
- Replay failures must be persisted and inspectable.

### Replay algorithm

```text
Load baseline
    ↓
Resolve prompt, model config, and scenario input
    ↓
Create replay run
    ↓
Initialize replay recorder and fixture policy
    ↓
Execute agent
    ↓
Persist trace and final status
    ↓
Evaluate assertions
    ↓
Return replay run
```

If execution fails, preserve the trace collected up to the failure and mark the run as failed.

---

## 10. Diff Engine

The diff engine compares persisted event sequences. It does not execute agents.

### Responsibilities

1. Load the baseline trace.
2. Load the replay trace.
3. Compare event types and order.
4. Compare tool names and arguments.
5. Compare results and errors.
6. Compare final outputs.
7. Identify the first meaningful divergence.
8. Produce a structured diff result.

### Initial comparison strategy

For the MVP, use an ordered event comparison.

For each corresponding event:

- Compare `event_type`.
- Compare `name`.
- Compare `arguments`.
- Compare `input`.
- Compare `output`.
- Compare `error`.

When event types or names differ, report the mismatch.

When one trace contains additional events, report additions or removals.

When matching events appear in a different order, report a sequence difference where the implementation can establish the reorder reliably.

### First divergence

`first_divergence` should identify the earliest meaningful difference in the execution sequences.

It should include:

- Baseline step index.
- Replay step index.
- Change type.
- Relevant field.
- Baseline value.
- Replay value.

If the traces are equivalent under the implemented comparison rules, return `null`.

### Important limitations

The MVP does not need a sophisticated sequence-alignment algorithm. A straightforward ordered comparison is acceptable, provided it is consistent and does not claim to identify a reorder when it has only observed an insertion or deletion.

Model text may differ without changing tool behavior. Keep event-level changes separate from behavioral assertion results.

---

## 11. Behavioral Assertions

Assertions turn trace comparison into a testing mechanism.

Implement at least one meaningful assertion for the demo.

### Assertion A: Required ordering

Description:

`check_fraud_flags must complete before issue_refund is called.`

Evaluation:

1. Find the first `tool_result` event for `check_fraud_flags`.
2. Find the first `tool_call` event for `issue_refund`.
3. Fail if the refund is called before the fraud check has completed.
4. Fail if a refund is attempted without a completed fraud check.
5. Pass only when the required ordering is satisfied.

### Assertion B: Prohibited action

Description:

`issue_refund must not be called when fraud flags are present.`

Evaluation:

- Find the fraud-check result.
- Determine whether the result reports a fraud flag.
- Fail if a refund tool call occurs after a flagged result.
- Pass if the trace demonstrates that no prohibited refund call occurred.

### Assertion C: Run completed

Description:

`The agent run must complete without an execution error.`

Evaluation:

- Pass if the run completes successfully and has no execution error.
- Fail if the run fails or contains an execution error relevant to the scenario.

### Assertion behavior

- Assertions must run against persisted trace data.
- Each result must include evidence supporting the outcome.
- An assertion must not pass simply because a final answer claims success.
- Missing required evidence must not be treated as success.
- The assertion evaluator must be testable independently of the UI.

---

## 12. REST API Contract

Use the `/api` prefix for all application endpoints.

### `POST /api/runs`

Execute a new scenario and record its trace.

Request:

```json
{
  "scenario_id": "refund-safety",
  "scenario_input": {
    "order_id": 42,
    "refund_amount": 50
  },
  "system_prompt": "Check fraud flags before issuing refunds.",
  "model_config": {
    "provider": "mock",
    "mode": "baseline"
  }
}
```

Response:

```json
{
  "id": "run_123",
  "scenario_id": "refund-safety",
  "baseline_run_id": null,
  "status": "completed",
  "final_output": {
    "message": "Scenario completed"
  }
}
```

The IDs and outputs above are illustrative.

### `GET /api/runs`

List runs, newest first.

Each result should include:

- Run ID.
- Scenario ID.
- Baseline run ID.
- Status.
- Creation timestamp.
- Completion timestamp.

### `GET /api/runs/{run_id}`

Retrieve a run and its trace.

Response structure:

```json
{
  "run": {
    "id": "run_123",
    "scenario_id": "refund-safety",
    "baseline_run_id": null,
    "status": "completed"
  },
  "events": []
}
```

The `events` array must contain the actual persisted events in ascending step order.

### `POST /api/runs/{run_id}/replay`

Replay an existing run with optional overrides.

Request:

```json
{
  "system_prompt": "Always check fraud flags before any refund.",
  "model_config": {
    "provider": "mock",
    "mode": "corrected"
  },
  "tool_result_policy": "matched_fixtures_only"
}
```

Response:

```json
{
  "id": "run_124",
  "baseline_run_id": "run_123",
  "status": "completed"
}
```

The replay must be executed and persisted before a completed response is returned.

### `GET /api/runs/{baseline_run_id}/diff/{replay_run_id}`

Compare the two runs.

Response:

```json
{
  "baseline_run_id": "run_123",
  "replay_run_id": "run_124",
  "first_divergence": {
    "baseline_step_index": 2,
    "replay_step_index": 2,
    "change_type": "changed",
    "field": "name",
    "baseline_value": "issue_refund",
    "replay_value": "check_fraud_flags"
  },
  "changes": [],
  "summary": {
    "total_changes": 1
  }
}
```

The response above is illustrative. The real indices and values must come from the actual persisted traces.

### `GET /api/runs/{run_id}/assertions`

Return assertion results for the requested run.

Response:

```json
{
  "run_id": "run_124",
  "results": [
    {
      "assertion_type": "required_order",
      "description": "Fraud check must complete before refund.",
      "status": "passed",
      "evidence": {}
    }
  ]
}
```

### API conventions

- Use Pydantic models for validation.
- Return `404` for unknown run IDs.
- Return `422` for invalid request payloads.
- Return `500` for unexpected internal failures.
- Use consistent error response structures.
- Avoid exposing stack traces to the frontend.
- Use JSON-compatible responses throughout.

The API may be consolidated into fewer modules or endpoints if necessary, but the end-to-end product workflow must remain available.

---

## 13. Backend Test Plan

Prioritize tests for the core behavior.

### Recorder tests

- Events receive increasing step indices.
- Events persist and can be retrieved.
- Event ordering is stable.
- Failed runs retain previously recorded events.

### Replay tests

- A replay creates a new run.
- The baseline is not overwritten.
- The replay references its baseline.
- Prompt overrides are applied.
- Matching fixtures are reused correctly.
- Unmatched calls do not receive unrelated results.

### Diff tests

- Identical traces produce no meaningful changes.
- Changed tool names are detected.
- Changed arguments are detected.
- Added and removed events are detected.
- The first divergence points to the earliest meaningful difference.

### Assertion tests

- Correct tool ordering passes.
- Incorrect tool ordering fails.
- A refund after a flagged fraud result fails.
- Missing required evidence does not pass.
- Failed executions are not reported as successful.

At minimum, the recorder, replay matching, diff engine, and required-order assertion should have automated tests.

---

## 14. Implementation Priorities

### P0 — Required for the demo

- FastAPI application.
- SQLite schema and repository functions.
- Small executable agent scenario.
- Trace recorder.
- Run creation and retrieval.
- Replay with controlled mock fixtures.
- Ordered trace diff.
- First-divergence reporting.
- Required-order assertion.
- Frontend-compatible API responses.

### P1 — Important if time permits

- Multiple saved scenarios.
- Better sequence alignment.
- Additional assertion types.
- More detailed error payloads.
- A real LLM adapter.
- Latency and token usage tracking.

### P2 — Future work

- LangGraph adapters.
- Batch regression suites.
- CI integration.
- Distributed execution.
- Multi-user access.
- Production-grade sandboxing.

Do not begin P1 or P2 work until the P0 flow works end to end.

---

## 15. Three-Hour Developer A Plan

### Minutes 0–30: Foundation

- Initialize the backend.
- Create the SQLite schema.
- Define Pydantic request and response models.
- Implement health and run endpoints.
- Agree on API contracts with the frontend developer.

### Minutes 30–70: Recording

- Implement the agent loop.
- Register the fraud-check and refund tools.
- Record model or mock decisions.
- Record tool calls and results.
- Persist events and run status.

### Minutes 70–100: Replay

- Implement baseline loading.
- Apply prompt and model configuration overrides.
- Add controlled fixture matching.
- Persist a separate replay trace.

### Minutes 100–125: Diff and assertions

- Implement ordered event comparison.
- Report the first meaningful divergence.
- Implement the required-order assertion.
- Add focused automated tests.

### Minutes 125–150: Integration

- Connect the API to the frontend.
- Fix schema mismatches.
- Verify the complete baseline/replay/diff workflow.

### Minutes 150–180: Stabilization

- Run tests.
- Fix critical defects.
- Verify clean local startup.
- Help prepare the README and demonstration.

**Priority rule:** if time becomes tight, preserve real trace recording, real replay, and real diffing. Reduce optional abstractions rather than replacing the core functionality with hardcoded output.

---

## 16. Definition of Done

The backend is ready for the hackathon demo when:

- A baseline agent execution can be recorded and retrieved.
- The trace contains actual ordered execution events.
- A replay can use a modified prompt or mock decision configuration.
- The replay is stored independently from the baseline.
- Tool-result matching follows explicit rules.
- The diff is computed from persisted events.
- The first divergence is identified correctly.
- At least one safety assertion is evaluated from actual events.
- Errors and unmatched interactions are visible.
- The frontend can complete the full workflow using the documented API.

TraceForge's backend should prove one essential capability: **a developer can reproduce an agent scenario, change its behavior, and verify the difference using real execution traces.**
