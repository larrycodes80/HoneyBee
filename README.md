# 🐝 HoneyBee

> **Record it. Replay it. Find the divergence. Verify behavior.**

[![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-red.svg)](https://www.sqlalchemy.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-84%20passing-brightgreen.svg)](backend/tests/)

---

## 📌 Overview

**HoneyBee** is a developer-first execution, replay, diffing, and evaluation harness for autonomous and tool-using AI agents. 

When deploying LLM-based agents into mission-critical workflows (such as financial transactions, customer support, or automated code modifications), stochastic model behavior, prompt drift, and tool-call mutations introduce silent behavioral regressions. 

HoneyBee provides complete observability and auditability across the entire agent lifecycle:
1. **Lightweight Python Tracing SDK (`honeybee`)**: Zero-overhead `@hb.trace` decorator and explicit internal step recorder using Python `contextvars` for thread-safe and async-safe trace capture with client-side recursive redaction.
2. **Ordered Trace Recording & Inspection**: Captures monotonic execution traces (inputs, thoughts, tool calls, tool results, errors) with visual `[SDK Outer]` vs. `[Internal]` separation.
3. **Deterministic Replay Harness**: Replays recorded agent runs under modified system prompts, models, policies, or scenario conditions against immutable baselines.
4. **Dual-Trace Diff Engine**: Computes structural and semantic divergence between baseline and replay runs, automatically isolating the **First Divergence Point**.
5. **Behavioral Safety Assertion Engine**: Enforces fail-closed safety invariants directly on persisted execution events (e.g., verifying that a `fraud_check` tool was successfully called and confirmed benign before any `issue_refund` execution).
6. **Intent-Based Semantic Evaluator**: Evaluates agent behavior against natural-language developer intent using local **Ollama** (`qwen3.5-4b`), **DigitalOcean Gemma 4**, or a deterministic fallback engine with strict evidence citations (zero hallucinated event IDs).
7. **Workflow Studio**: An interactive interview interface that translates natural-language workflow intent into formal, editable, versioned 7-dimension behavioral specifications.
8. **High-Density React 19 Workbench**: A dark-themed web dashboard for timeline inspection, visual diffing, assertion verdicts, and side-by-side run comparisons.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph AgentRuntime["Agent Host Process"]
        A[User Agent / Decorated Function]
        SDK["HoneyBee Python SDK (honeybee)"]
        CV["contextvars Isolation"]
        RED["Client-Side Redaction Engine"]
        A -->|@hb.trace / hb.record_event| SDK
        SDK --> CV
        SDK --> RED
    end

    subgraph BackendAPI["HoneyBee Backend (FastAPI + SQLAlchemy)"]
        API["REST API Router (/api)"]
        REC["TraceRecorder Service"]
        DIFF["DiffEngine Service"]
        ASSERT["AssertionEngine Service"]
        EVAL["EvaluatorEngine Service"]
        WF["WorkflowService"]
        AI["AI Provider (Ollama / DigitalOcean / Fake)"]
        EXEC["AgentExecutor (Replay / Mock)"]
        DB[(SQLite Database)]

        RED -->|HTTP POST JSON| API
        API --> REC
        API --> DIFF
        API --> ASSERT
        API --> EVAL
        API --> WF
        API --> EXEC

        EVAL --> AI
        WF --> AI
        REC --> DB
        DIFF --> DB
        ASSERT --> DB
        EVAL --> DB
        WF --> DB
        EXEC --> REC
    end

    subgraph WebUI["HoneyBee Frontend (React 19 + TypeScript + Vite)"]
        UI["Workbench Dashboard"]
        TIMELINE["Trace Timeline & Event Drawer"]
        DIFFVIEW["Dual-Trace Diff View"]
        ASSVIEW["Assertion Invariant Panel"]
        EVALPANEL["Intent Evaluation Panel"]
        STUDIO["Workflow Studio"]

        API <-->|JSON REST| UI
        UI --> TIMELINE
        UI --> DIFFVIEW
        UI --> ASSVIEW
        UI --> EVALPANEL
        UI --> STUDIO
    end
```

---

## 🌟 Key Capabilities

### 1. Agent Trace Recording & Inspection
- **Chronological Execution Timeline**: Captures model inputs, thoughts, tool calls, tool results, and execution errors with sequence numbers and timestamps.
- **SDK Outer vs. Internal Events**: Distinguishes between outer-function events captured automatically by the SDK (`[SDK Outer]`) and internal milestones instrumented by developers (`[Internal]`).
- **Privacy & Redaction Aware**: Automatically detects and respects backend privacy redactions (`[REDACTED]`), masking sensitive data fields in inspector views while maintaining trace fidelity.

### 2. Deterministic Replay & Diff Comparison
- **Immutable Baselines**: Baseline runs are permanently immutable. Replays generate a newly linked execution record referencing the baseline (`baseline_run_id`).
- **Semantic Trace Diffing**: Compares execution traces side-by-side, ignoring incidental differences (timestamps, ephemeral IDs) and highlighting true behavioral divergences (added, removed, or changed tool interactions).
- **First Divergence Detection**: Flags the earliest step where agent behavior branched away from baseline.

### 3. Behavioral Safety Assertions
- **Event-Order Verification**: Evaluates compliance rules directly against the persisted event sequence rather than arbitrary output strings (e.g., verifying that `fraud_check` occurs strictly prior to `issue_refund`).
- **Pass/Fail Audit Trail**: Reports clear pass/fail status accompanied by human-readable explanations.

### 4. Intent-Based Evaluation Engine
- **Multi-Provider AI Architecture**: Supports local **Ollama** (`qwen3.5-4b`), **DigitalOcean Gemma 4**, and offline deterministic evaluation engines.
- **Evidence-Grounded Findings**: Evaluates traces against intended workflows and returns verdict (`PASS`, `FAIL`, `INCONCLUSIVE`), expected vs. observed behavior, earliest divergence, and concrete evidence event IDs.
- **Hallucination Prevention**: Strict validation ensures every cited event ID exists in the recorded trace.

### 5. Workflow Studio
- **Behavioral Intent Interview**: Generates targeted clarification questions resolving ambiguous boundaries, edge cases, and safety invariants.
- **7-Dimension Behavioral Specification**:
  1. **Required Outcomes**: Verifiable end states and success criteria.
  2. **Required Conditions**: Preconditions and gating requirements.
  3. **Forbidden Actions**: Prohibited agent behaviors and tool calls.
  4. **Safety Invariants**: Global invariants maintained across all execution steps.
  5. **Acceptable Alternatives**: Permitted fallback branches and recovery paths.
  6. **Hard Requirements vs. Preferences**: Distinguishes non-negotiable safety rules from stylistic preferences.
  7. **Failure Handling**: Required behavior when dependencies or tools fail.
- **Approval & Versioning**: Specifications require explicit developer approval before activation and preserve immutable historical versions.

---

## 💻 Python SDK Usage

HoneyBee provides a zero-dependency client SDK located in `honeybee/` (installable via `pip install -e .`).

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
        name="qwen3.5-4b",
        input={"prompt": f"Handle request for customer {customer_id}: {message}"}
    )
    
    # 2. Record tool call
    hb.record_event(
        "tool_call",
        name="check_fraud",
        input={"customer_id": customer_id}
    )
    
    # Simulate fraud check result
    fraud_verdict = {"status": "cleared", "risk_score": 0.05}
    hb.record_event(
        "tool_result",
        name="check_fraud",
        output=fraud_verdict
    )
    
    # 3. Complete processing
    return {"status": "success", "action": "refund_approved"}

# Execute function — trace is automatically captured and persisted
result = support_agent("cust_9921", "Please refund order #4412")
```

### Asynchronous Tracing Support

```python
import asyncio
from honeybee import HoneyBee

hb = HoneyBee(base_url="http://localhost:8000")

@hb.trace
async def async_agent(task_id: str):
    hb.record_event("model_input", name="planner", input={"task": task_id})
    # Async tasks maintain run context safely via Python contextvars
    await asyncio.sleep(0.1)
    hb.record_event("tool_call", name="executor", input={"action": "run"})
    return {"status": "completed"}
```

---

## 📡 API Reference

All API endpoints are standardized under `/api` (with `/health` at the root):

### Runs & SDK Ingestion
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Backend liveness and health check |
| `GET` | `/api/runs` | List recorded runs (`limit`, `offset` pagination) |
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

### Workflow Specifications
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/workflows` | List all workflow specifications |
| `POST` | `/api/workflows` | Create a new workflow draft from natural-language intent |
| `GET` | `/api/workflows/{id}` | Retrieve a workflow draft or specification |
| `POST` | `/api/workflows/{id}/questions` | Generate clarification questions using AI provider |
| `POST` | `/api/workflows/{id}/answers` | Submit developer answers to clarification interview |
| `POST` | `/api/workflows/{id}/generate-spec` | Synthesize structured specification draft via AI provider |
| `PUT` | `/api/workflows/{id}` | Update draft title, description, or specification fields |
| `POST` | `/api/workflows/{id}/approve` | Explicitly approve workflow specification into active version |
| `GET` | `/api/workflows/{id}/versions` | List immutable approved versions of a workflow |

---

## ⚙️ Configuration & Environment

Configuration is managed via Pydantic Settings in `backend/app/core/config.py` and read from `backend/.env`:

```env
# Database & Network
DATABASE_URL=sqlite:///./honeybee.db
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PORT=8000
HOST=0.0.0.0

# Active AI Provider: ollama | digitalocean | fake
HONEYBEE_LLM_PROVIDER=ollama

# Ollama local inference (default: qwen3.5-4b)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5-4b
OLLAMA_TIMEOUT_SECONDS=120

# DigitalOcean Gemma inference (alternative cloud provider)
# HONEYBEE_LLM_PROVIDER=digitalocean
# DIGITALOCEAN_TOKEN=your_token_here
DIGITALOCEAN_INFERENCE_BASE_URL=https://inference.do-ai.run
DIGITALOCEAN_INFERENCE_MODEL=gemma-4-it
DIGITALOCEAN_INFERENCE_TIMEOUT_SECONDS=60
```

---

## 🚀 Getting Started

### Prerequisites
- **Python**: `>= 3.11`
- **Node.js**: `>= 20.0`
- **npm** or **pnpm**
- *(Optional)* **Ollama**: with `ollama pull qwen3.5-4b` for local inference

---

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1

# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Start backend server
uvicorn app.main:app --reload --port 8000
```
Backend will be available at `http://localhost:8000` (interactive Swagger documentation at `http://localhost:8000/docs`).

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run automated tests
node test/phase4.test.mjs

# Build production bundle
npm run build

# Start development server
npm run dev
```
Frontend UI will be running at `http://localhost:5173`.

---

## 🧪 Test Suite

HoneyBee maintains a rigorous test suite covering the complete execution lifecycle:

- `test_health.py`: Liveness check verification.
- `test_runs.py`: Run lifecycle, execution triggers, and cascade deletes.
- `test_trace_recorder.py`: Monotonic event sequencing and summary computation.
- `test_diff_api.py`: Baseline vs. replay trace comparison and divergence detection.
- `test_assertions_api.py`: `fraud_check_before_refund` invariant checks and fail-closed validation.
- `test_phase2.py`: Multi-run replay and assertion workflows.
- `test_phase3.py`: Evaluator engine and semantic LLM assessment.
- `test_workflows.py`: Specification synthesis, clarification interviews, and approval versioning.
- `test_ollama_provider.py`: Ollama `qwen3.5-4b` provider initialization, JSON parsing, and offline fallbacks.
- `test_sdk.py`: Synchronous/asynchronous decorator tracing, explicit event recording, recursive redaction, and transport resilience.

```bash
cd backend
uv run pytest -v
```

---

## 📄 License
MIT License. Built for deterministic, safe, and observable AI agents.
