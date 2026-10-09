# HoneyBee 🐝

> **Record it. Replay it. Find the divergence. Verify behavior.**

HoneyBee is a developer-first execution, replay, and debugging harness for tool-using AI agents. It records agent runs as chronologically ordered execution traces, allows developers to replay identical scenarios with modified prompts or configuration policies, isolates the earliest semantic divergence between traces, and evaluates behavioral safety assertions against actual persisted execution events.

---

## 🌟 Key Capabilities

### 1. Agent Trace Recording & Inspection
- **Ordered Execution Timeline**: Captures model inputs, model thoughts/outputs, tool calls, tool results, and execution errors with sequence numbers and timestamps.
- **SDK vs. Internal Instrumentation**: Visually distinguishes between outer-function events captured automatically by the SDK (`[SDK Outer]`) and internal events explicitly instrumented by developers (`[Internal]`).
- **Privacy & Redaction Aware**: Automatically detects and respects backend privacy redactions (`[REDACTED]`), masking sensitive data fields in inspector views while maintaining trace fidelity.

### 2. Deterministic Replay & Diff Comparison
- **Immutable Baselines**: Baseline runs are permanently immutable. Replays generate a newly linked execution record referencing the baseline (`baseline_run_id`).
- **Semantic Trace Diffing**: Compares execution traces side-by-side, ignoring incidental differences (timestamps, ephemeral IDs) and highlighting true behavioral divergences (added, removed, or changed tool interactions).
- **First Divergence Detection**: Automatically flags the earliest step where agent behavior branched away from baseline.

### 3. Behavioral Safety Assertions
- **Event-Order Verification**: Evaluates compliance rules directly against the persisted event sequence rather than arbitrary output strings (e.g., verifying that `fraud_check` occurs strictly prior to `issue_refund`).
- **Pass/Fail Audit Trail**: Reports clear pass/fail status accompanied by human-readable explanations.

### 4. Workflow Studio (Phase 4)
- **Natural-Language Behavior Drafting**: Translate plain-English workflow descriptions into structured behavioral specifications.
- **Clarification Interview Interface**: Interactive question-answering workflow to surface and resolve hidden edge cases and ambiguous constraints.
- **7-Dimension Behavioral Specification**:
  1. **Required Outcomes**: Verifiable end states and success criteria.
  2. **Required Conditions**: Preconditions and gating requirements.
  3. **Forbidden Actions**: Prohibited agent behaviors and tool calls.
  4. **Safety Invariants**: Global invariants maintained across all execution steps.
  5. **Acceptable Alternatives**: Permitted fallback branches and recovery paths.
  6. **Execution Preferences**: Latency, token budget, and optimization priorities.
  7. **Unresolved Assumptions**: Dependencies requiring external validation.
- **Explicit Approval & Immutability**: Specifications require explicit backend confirmation to enter `approved` status. Historical versions are locked to guarantee audit integrity.

---

## 🏗️ Repository Architecture

```text
HoneyBee/
├── backend/                  # FastAPI backend service & replay engine
│   ├── app/
│   │   ├── api/              # REST route handlers (runs, replay, workflows, health)
│   │   ├── core/             # Configuration and database session lifecycle
│   │   ├── db/               # SQLite database setup & models
│   │   ├── schemas/          # Pydantic v2 validation models
│   │   ├── services/         # Deterministic agent executor, diff engine, assertions
│   │   └── main.py           # Application entrypoint & middleware
│   ├── tests/                # Pytest suite covering execution, replay, and assertions
│   └── pyproject.toml        # Backend dependencies & metadata
│
├── frontend/                 # React 19 + TypeScript + Vite web dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── workspace/    # RunExplorer, TimelinePane, EventInspector
│   │   │   ├── workflow/     # WorkflowStudio & specification editor
│   │   │   ├── diff/         # Side-by-side comparison workspace & diff cards
│   │   │   ├── replay/       # Prompt & scenario override replay modal
│   │   │   └── assertions/   # Behavioral assertion result panel
│   │   ├── lib/              # Centralized API client & typed ApiError handling
│   │   ├── types/            # Shared TypeScript interfaces matching API contract
│   │   └── index.css         # Dark-themed styling tokens & components
│   ├── test/                 # Node.js automated test suite
│   └── package.json          # Frontend scripts and dependencies
│
└── docs/                     # Specifications & Hackathon documentation
    ├── API_CONTRACT.md       # Shared team REST API contract
    ├── PRODUCT.md            # Product vision and requirements
    ├── FRONTEND.md           # Frontend engineering specification
    ├── BACKEND.md            # Backend engineering specification
    └── TEAM_TASKS.md         # Team milestone breakdown
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python**: `>= 3.11`
- **Node.js**: `>= 20.0`
- **npm** or **pnpm**

---

### 1. Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The backend API will be available at `http://localhost:8000`.  
Interactive Swagger docs: `http://localhost:8000/docs`

---

### 2. Frontend Setup

In a separate terminal window:

```bash
cd frontend

# Install npm dependencies
npm install

# Start the Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📡 API Contract Surface

All endpoints are standardized under `/api` in accordance with [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md):

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check endpoint |
| `GET` | `/api/runs` | List persisted runs (`limit`, `offset` pagination) |
| `POST` | `/api/runs` | Trigger execution of a demo scenario (e.g. `refund_safety`) |
| `GET` | `/api/runs/{run_id}` | Retrieve run metadata and ordered trace events |
| `POST` | `/api/runs/{run_id}/replay` | Replay baseline run with prompt/configuration overrides |
| `GET` | `/api/runs/{baseline_id}/diff/{replay_id}` | Compare two runs and return first divergence + event deltas |
| `GET` | `/api/runs/{run_id}/assertions` | Evaluate behavioral safety assertions for a run |
| `GET` | `/api/workflows` | List workflow specifications |
| `GET` | `/api/workflows/{id}` | Retrieve detailed workflow specification |
| `POST` | `/api/workflows/draft` | Create draft specification from natural language description |
| `POST` | `/api/workflows/{id}/answers` | Submit answers to clarification interview questions |
| `PUT` | `/api/workflows/{id}` | Update draft specification |
| `POST` | `/api/workflows/{id}/approve` | Explicitly approve workflow specification |

---

## 🧪 Demo Walkthrough: Refund Safety Scenario

HoneyBee includes a deterministic reference scenario, `refund_safety`, demonstrating the full debugging lifecycle:

1. **Unsafe Baseline Run**:
   - The agent handles a customer refund by immediately calling `issue_refund` before checking fraud flags.
   - HoneyBee records the full event timeline.
   - The behavioral safety assertion `fraud_check_before_refund` reports **FAIL**.
2. **Replay with Corrected Policy**:
   - Developer opens the replay dialog and specifies a corrected instruction: `"Always check fraud before issuing a refund."`
   - Replay executes, producing a new linked run (`baseline_run_id: run_01`).
3. **Diff & Divergence Isolation**:
   - HoneyBee aligns both event timelines side-by-side.
   - Flags the **first divergence point** at Sequence 3 (`issue_refund` replaced with `fraud_check`).
4. **Behavioral Assertion Pass**:
   - The safety assertion is re-evaluated on the replay trace and reports **PASS**.

---

## 🔬 Testing & Verification

### Run Backend Tests
```bash
cd backend
python -m pytest tests/
```

### Run Frontend Tests & Checks
```bash
cd frontend

# Run automated tests
npm run test

# Run linter
npm run lint

# Verify production bundle build
npm run build
```

---

## 📄 License & Team
Built by the HoneyBee Team for the 2026 AI Agent Hackathon.