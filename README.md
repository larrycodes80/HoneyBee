# 🐝 HoneyBee

> **Deterministic Observability, Replay, Diffing & Behavioral Assertion Harness for AI Agents**

[![Python Version](https://img.shields.io/badge/python-3.11%20%7C%203.12%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-red.svg)](https://www.sqlalchemy.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-57%20passing-brightgreen.svg)](backend/tests/)

---

## 📌 Overview

**HoneyBee** is an end-to-end platform for recording, replaying, diffing, and evaluating autonomous AI agent executions. When deploying LLM-based agents into mission-critical workflows (such as financial refunds or customer support), stochastic model behavior, prompt drift, and tool-call mutations introduce silent regressions.

HoneyBee solves this by providing:
1. **Lightweight Instrumentation SDK (`honeybee`)**: Zero-overhead `@hb.trace` decorator and explicit internal step recorder using Python `contextvars` for thread-safe/async-safe trace capture with local client-side redaction.
2. **Deterministic Replay Harness**: Replays recorded agent runs under modified system prompts, models, policies, or scenario conditions.
3. **Dual-Trace Diff Engine**: Computes structural and semantic divergence between baseline and replay runs, identifying the exact step of behavioral divergence.
4. **Behavioral Assertion Engine**: Enforces fail-closed safety invariants (e.g., verifying that a `fraud_check` tool was successfully called and confirmed benign before any `process_refund` tool execution).
5. **Intent-Based Semantic Evaluator**: Grades agent decisions against expected criteria using an LLM evaluation engine.
6. **Interactive Visual Workbench**: A high-density React 19 UI for timeline inspection, visual diffing, assertion verdicts, and side-by-side run comparisons.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph AgentRuntime["Agent Host Process"]
        A[User Agent / Decorated Function]
        SDK["HoneyBee Python SDK (honeybee)"]
        CV["contextvars Isolation"]
        RED["Client-side Redaction Engine"]
        A -->|@hb.trace / hb.record_event| SDK
        SDK --> CV
        SDK --> RED
    end

    subgraph BackendAPI["HoneyBee Backend (FastAPI + SQLAlchemy)"]
        API["REST API Router (/api/runs)"]
        REC["TraceRecorder Service"]
        DIFF["DiffEngine Service"]
        ASSERT["AssertionEngine Service"]
        EVAL["EvaluatorEngine Service"]
        EXEC["AgentExecutor (Replay / Mock)"]
        DB[(SQLite / StaticPool)]

        RED -->|HTTP POST JSON| API
        API --> REC
        API --> DIFF
        API --> ASSERT
        API --> EVAL
        API --> EXEC

        REC --> DB
        DIFF --> DB
        ASSERT --> DB
        EVAL --> DB
        EXEC --> REC
    end

    subgraph WebUI["HoneyBee Frontend (React 19 + Vite)"]
        UI["Workbench Dashboard"]
        TIMELINE["Trace Timeline & Event Drawer"]
        DIFFVIEW["Dual-Trace Diff View"]
        ASSVIEW["Assertion Invariant Panel"]

        API <-->|JSON REST| UI
        UI --> TIMELINE
        UI --> DIFFVIEW
        UI --> ASSVIEW
    end
```

---

## 🔬 Tech Stack & Operational Mechanics

Every technology in HoneyBee is chosen for strict deterministic execution, isolation, and high developer ergonomics. Below is the technical breakdown of each layer based on the repository implementation:

### 1. Backend Core & Storage

#### **FastAPI (>= 0.115.0)**
* **Role**: Primary ASGI application framework delivering asynchronous request dispatching, strict OpenAPI compliance, and unified dependency injection.
* **Operational Mechanics**:
  * **Lifespan Management**: `main.py` uses `@asynccontextmanager` lifespan handlers to invoke `init_db()` on boot, initializing database schemas and verifying foreign key integrity without requiring cold restart migrations.
  * **Dependency Injection (`Depends(get_db)`)**: Routes leverage FastAPI's generator dependency injection to acquire a scoped SQLAlchemy session (`SessionLocal`) per HTTP request, guaranteeing automatic commit/rollback and connection release upon request completion.
  * **Standardized Error Envelope**: Custom handlers intercept `HTTPException` and validation errors to guarantee a consistent response envelope across all endpoints:
    ```json
    { "error": { "code": "NOT_FOUND", "message": "Run not found" } }
    ```

#### **SQLAlchemy (>= 2.0.30) & SQLite**
* **Role**: Relational persistence layer for runs, trace events, and semantic evaluations.
* **Operational Mechanics**:
  * **Relational Schema**:
    * `Run` (`backend/app/models/run.py`): Tracks execution ID (`run_...`), status (`pending`, `running`, `completed`, `failed`), scenario/prompt configurations, baseline association (`baseline_run_id`), duration, and summary metrics.
    * `TraceEvent` (`backend/app/models/trace_event.py`): Stores sequential events linked via foreign key `run_id` with `ondelete="CASCADE"`. Schema columns: `sequence` (monotonic 0-indexed integer), `type`, `name`, `timestamp`, `input`, `output`, and `metadata` (aliased in Python as `event_metadata` to avoid collisions with SQLAlchemy's `Base.metadata`).
    * `Evaluation` (`backend/app/models/evaluation.py`): Records automated evaluation judgments, scores, feedback, and intent compliance.
  * **Monotonic Sequence Integrity**: `TraceRecorder` locks or computes `next_seq = max(existing_seq) + 1` ensuring gapless, strictly ordered trace events.
  * **Engine & Pooling**: Configured with `check_same_thread=False` and SQLite foreign key PRAGMA enforcement (`PRAGMA foreign_keys=ON`).

#### **Pydantic (>= 2.8.0) & Pydantic-Settings (>= 2.4.0)**
* **Role**: Strict schema validation, deserialization, and environment management.
* **Operational Mechanics**:
  * **Model Validation & Translation**: `TraceEventSchema` implements `@model_validator(mode="before")` to translate ORM attribute `event_metadata` into the public schema field `metadata` transparently.
  * **Settings Management**: `Settings` (`backend/app/core/config.py`) loads environment variables (`DATABASE_URL`, `CORS_ORIGINS`, `DO_AGENT_KEY`, etc.) with default fallbacks and dynamic CORS list parsing.

---

### 2. Python Instrumentation SDK (`honeybee/`)

The HoneyBee SDK is a standalone, lightweight instrumentation library located in `honeybee/` that records function executions and internal agent steps directly into the HoneyBee backend.

#### **Execution Context Isolation (`contextvars.ContextVar`)**
* **Role**: Thread-safe and asynchronous task-local execution state.
* **Operational Mechanics**:
  * Managed via `honeybee/context.py` using `_current_run_id` and `_current_client`.
  * Guarantees that concurrent async tasks (`asyncio.gather`) and multi-threaded worker pools never mix up run IDs or leak trace events across interleaving agent executions.

#### **Function Decorator (`@hb.trace`)**
* **Role**: Transparent instrumentation wrapper for synchronous and asynchronous agent functions.
* **Operational Mechanics** (`honeybee/decorator.py`):
  * Inspects function signatures using `inspect.iscoroutinefunction(func)`.
  * Generates a unique run ID (`run_<uuid4>`) or registers with the backend via `POST /api/runs/init`.
  * Automatically records an `agent_start` event with sanitized function positional/keyword arguments.
  * Executes the target function, tracks elapsed runtime with sub-millisecond precision (`time.perf_counter()`), and records an `agent_end` event containing the return payload.
  * Intercepts unhandled exceptions, records an `error` event containing the exception type and message, marks the run as `failed` via `POST /api/runs/{run_id}/finalize`, and re-raises the exception without suppressing it.

#### **Explicit Internal Event Recording (`hb.record_event`)**
* **Role**: Captures granular sub-steps (LLM calls, tool executions, vector searches).
* **Operational Mechanics**:
  * Accepts standardized event types: `agent_start`, `model_input`, `model_output`, `tool_call`, `tool_result`, `error`, `agent_end`.
  * Associates events with the currently active context-local run ID.
  * Dispatches ordered events via `POST /api/runs/{run_id}/events`.

#### **Recursive Client-Side Redaction Engine (`honeybee/redaction.py`)**
* **Role**: Prevents credentials and PII from leaving the host process.
* **Operational Mechanics**:
  * Performs deep recursive traversal over dictionaries, lists, and nested objects.
  * Uses regex pattern matching against sensitive keys (`api_key`, `token`, `password`, `secret`, `ssn`, `credit_card`).
  * Replaces sensitive values with `"[REDACTED]"`.
  * Supports complete omission of input or output payloads when configured (`redact_inputs=True`, `redact_outputs=True`).

#### **HTTP Transport Layer (`httpx.Client`)**
* **Role**: HTTP communication with the HoneyBee ingestion backend.
* **Operational Mechanics**:
  * Wraps transport calls with bounded error handling, translating network or HTTP 4xx/5xx failures into explicit `HoneyBeeDeliveryError` exceptions so failures are never silently swallowed.

---

### 3. Core Analytical Engines (`backend/app/services/`)

#### **Diff Engine (`diff_engine.py`)**
* **Role**: Dual-trace alignment and behavioral divergence analysis.
* **Operational Mechanics**:
  * Takes baseline trace events and replay trace events ordered by `sequence`.
  * Compares sequential event signatures: `(sequence, type, name)`.
  * Performs deep equality comparison on event inputs and outputs.
  * Computes structured diffs categorized by `change_type`: `added`, `removed`, `modified`, or `unchanged`.
  * Identifies the exact `first_divergence` (the earliest step where replay deviated from baseline in event type, tool selection, input payload, or output result).
  * Computes high-level summary counters: `baseline_event_count`, `replay_event_count`, `added_count`, `removed_count`, and `modified_count`.

#### **Behavioral Assertion Engine (`assertion_engine.py`)**
* **Role**: Verifies business and safety invariants across agent execution traces.
* **Operational Mechanics**:
  * Evaluates assertions such as `fraud_check_before_refund`.
  * **Fail-Closed Verification**:
    1. Checks if a `process_refund` tool call exists.
    2. If a refund was processed, verifies that a `fraud_check` tool call occurred at an earlier sequence index.
    3. Inspects the corresponding `tool_result` for `fraud_check`:
       * If fraud check result was `failed`, `flagged`, `denied`, or errored, the assertion strictly fails (`status: "failed"`).
       * Only passes if fraud status was explicitly cleared (`passed`, `approved`, or `cleared`).
  * Produces a structured result containing: `id`, `name`, `status` (`passed` / `failed`), `description`, and `evidence` (event IDs, sequence numbers, and recorded verdicts).

#### **Evaluator Engine (`evaluator_engine.py`) & LLM Client (`llm_client.py`)**
* **Role**: Intent-based semantic evaluation scoring agent actions against user intents.
* **Operational Mechanics**:
  * Combines execution traces, user prompt goals, and configurable evaluation rules.
  * Prompts an LLM backend (DigitalOcean / external API) with structured trace telemetry to grade reasoning consistency, safety, and policy compliance.
  * Persists evaluations into the `Evaluation` database table.

#### **Mock Agent Executor (`agent_executor.py`)**
* **Role**: Deterministic execution harness for agent scenarios (such as `refund_safety`).
* **Operational Mechanics**:
  * Emulates agent loops: model reasoning, tool call selection, simulated tool execution, and final customer response.
  * Allows parameterized replay under baseline or modified prompt conditions to demonstrate divergence and assertion failure scenarios.

---

### 4. Frontend Application (`frontend/`)

#### **React 19 (19.2.8)**
* **Role**: Declarative UI layer for visualizing and operating the agent harness.
* **Operational Mechanics**:
  * **State Architecture**: `App.tsx` coordinates active run selection, baseline vs. replay pairing, active tab states (`timeline`, `diff`, `assertions`), and modal triggers.
  * **Components**:
    * `RunsDashboard.tsx`: Displays recent agent runs, status badges, and duration metrics.
    * `TraceTimeline.tsx` & `EventCard.tsx`: Visualizes ordered trace events with chronological badges, payload inspectors, and duration metrics.
    * `EventDrawer.tsx`: Flyout drawer for inspecting raw JSON input, output, and metadata of any event.
    * `diff/TraceDiffView.tsx`: Side-by-side comparative diff display highlighting divergent steps.
    * `assertions/AssertionsPanel.tsx`: Visual indicators for safety invariant verdicts with drill-down into captured evidence.
    * `replay/ReplayModal.tsx`: Configuration modal to launch replay runs with modified prompts or policies.
  * **Fixture Fallback**: `api.ts` gracefully falls back to deterministic local mock fixtures (`fixtures/`) if the backend is unreachable during frontend standalone development.

#### **Vite 8 (8.3.0) & TypeScript 6 (6.0.2)**
* **Role**: High-speed build tooling and compile-time contract enforcement.
* **Operational Mechanics**:
  * TypeScript interfaces (`frontend/src/types/index.ts`) enforce strict contracts matching backend Pydantic models (`Run`, `TraceEvent`, `DiffResponse`, `AssertionResponse`).
  * Fast Hot Module Replacement (HMR) powered by native ES modules.
  * Production builds compile and bundle cleanly via `tsc -b && vite build`.

#### **Oxlint (1.81.0)**
* **Role**: High-performance Rust-based linter enforcing clean React and TypeScript standards.

---

## 📡 API Reference

All routes are mounted under `/api/runs` (with `/health` at the root):

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend liveness and health check |
| `GET` | `/api/runs` | List recorded runs (ordered newest first) |
| `POST` | `/api/runs` | Execute a new scenario run via AgentExecutor |
| `POST` | `/api/runs/init` | SDK endpoint: Initialize an external run |
| `POST` | `/api/runs/ingest` | SDK endpoint: Batch ingest a run and its trace events |
| `POST` | `/api/runs/{run_id}/events` | SDK endpoint: Append ordered events to an active run |
| `POST` | `/api/runs/{run_id}/finalize` | SDK endpoint: Finalize an active run with status & duration |
| `GET` | `/api/runs/{run_id}` | Fetch run details including full trace events |
| `POST` | `/api/runs/{run_id}/replay` | Replay a baseline run with prompt/policy overrides |
| `GET` | `/api/runs/{baseline_id}/diff/{replay_id}` | Compute dual-trace diff and locate first divergence |
| `GET` | `/api/runs/{run_id}/assertions` | Evaluate behavioral invariants (e.g. refund safety) |
| `POST` | `/api/runs/{run_id}/evaluate` | Trigger intent-based semantic evaluation |
| `GET` | `/api/runs/{run_id}/evaluations` | Retrieve evaluations for a given run |

---

## 💻 Python SDK Usage

### Basic Usage with `@hb.trace`

```python
from honeybee import HoneyBee

# Initialize client pointing to HoneyBee backend
hb = HoneyBee(base_url="http://localhost:8000")

@hb.trace
def support_agent(customer_id: str, message: str) -> dict:
    # 1. Record model reasoning
    hb.record_event(
        "model_input",
        name="gemma-2-9b",
        input={"prompt": f"Handle request for customer {customer_id}: {message}"}
    )
    
    # 2. Record tool call
    hb.record_event(
        "tool_call",
        name="fraud_check",
        input={"customer_id": customer_id}
    )
    
    # Simulate fraud check
    fraud_verdict = {"status": "cleared", "risk_score": 0.05}
    hb.record_event(
        "tool_result",
        name="fraud_check",
        output=fraud_verdict
    )
    
    # 3. Complete processing
    return {"status": "success", "action": "refund_approved"}

# Execute function — trace is automatically captured and persisted
result = support_agent("cust_9921", "Please refund order #4412")
```

### Asynchronous Support

```python
@hb.trace
async def async_agent(task_id: str):
    hb.record_event("model_input", name="planner", input={"task": task_id})
    # Async tasks maintain run context safely via contextvars
    await asyncio.sleep(0.1)
    hb.record_event("tool_call", name="executor", input={"action": "run"})
    return {"status": "completed"}
```

---

## 🚀 Getting Started

### Prerequisites
* **Python**: 3.11 or higher
* **Node.js**: 18.x or higher
* **Package Managers**: `uv` or `pip` (Python), `npm` (Node)

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment and install dependencies
pip install -e ".[dev]"

# Run database tests (57 tests covering CRUD, Diff, Assertions, Evaluator & SDK)
pytest

# Start the FastAPI development server
uvicorn app.main:app --reload --port 8000
```
Backend will be available at `http://localhost:8000` (API docs at `http://localhost:8000/docs`).

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run linter
npm run lint

# Build production bundle
npm run build

# Start Vite development server
npm run dev
```
Frontend UI will be running at `http://localhost:5173`.

---

## 🧪 Testing Suite

HoneyBee includes a comprehensive test suite across unit, integration, and concurrency scenarios:

* `test_health.py`: Liveness check verification.
* `test_runs.py`: Run lifecycle, replay triggering, and event cascades.
* `test_trace_recorder.py`: Monotonic sequencing and summary computation.
* `test_diff_api.py`: Baseline vs. replay trace comparison and divergence detection.
* `test_assertions_api.py`: `fraud_check_before_refund` invariant checks and fail-closed validation.
* `test_phase2.py`: Multi-run replay and assertion workflows.
* `test_phase3.py`: Evaluator engine and semantic LLM assessment.
* `test_sdk.py`: Synchronous/asynchronous decorator tracing, explicit event recording, recursive redaction, contextvar concurrency isolation, and bounded transport failure resilience.

To run all tests:
```bash
cd backend
pytest -v
```

---

## 📜 License

MIT License. Built for deterministic, safe, and observable AI agents.