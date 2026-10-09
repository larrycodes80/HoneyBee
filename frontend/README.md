# HoneyBee — Frontend Dashboard & Workflow Studio (Phase 4C)

The HoneyBee frontend is an AI agent execution, inspection, and verification harness built with React, Vite, TypeScript, and Tailwind CSS design tokens.

## 1. Architecture & Overview

The Phase 4C user interface delivers two primary workflows:

1. **Intended Behavior Definition & Workflow Studio (`/workflow`)**
   - Natural language workflow description input.
   - AI draft generation via model inference.
   - Interactive clarification interview to resolve edge cases and ordering requirements.
   - Structured specification editor with **7 mandatory behavioral dimensions**:
     - `Required Outcomes`: Success criteria and verifiable end states.
     - `Required Conditions`: Preconditions and validation gates.
     - `Forbidden Actions`: Prohibitions (e.g. issuing refund before fraud check).
     - `Safety Invariants`: Global invariants across all steps.
     - `Acceptable Alternatives`: Permitted recovery branches.
     - `Execution Preferences`: Optimization priorities.
     - `Unresolved Assumptions`: Ambiguities requiring validation.
   - Explicit specification approval workflow. Once approved by the backend, historical versions are locked and marked immutable to preserve audit integrity.
   - Provider availability checks: If Gemma/inference is unavailable, the UI surfaces the actual backend error rather than fabricating mock outputs.

2. **Runs Dashboard & Trace Timeline (`/trace` & `/diff`)**
   - Live integration with persisted backend runs (`/api/runs`).
   - Run Explorer displays run ID, agent/function name, associated workflow ID & version, execution timestamp, run status, event counts, and server pagination.
   - Chronological event timeline detailing sequence step, timestamp, event type, and tool/model names.
   - Visual distinction between **Outer-Function SDK Events** (`[SDK Outer]`) captured automatically and **Internal Events** (`[Internal]`) explicitly instrumented by developers.
   - Privacy redaction support: Sensitive fields marked by the backend are indicated with `[REDACTED]` shield tags and clear warnings.
   - Event Inspector displaying structured payloads (inputs, outputs, execution metadata).
   - Side-by-side diff comparison and behavioral safety assertions.

## 2. API Contract Integration

All API calls are centralized in `src/lib/api.ts` through a typed `ApiError` boundary:

- `listWorkflows()`: `GET /api/workflows`
- `getWorkflow(id)`: `GET /api/workflows/{id}`
- `createWorkflowDraft(payload)`: `POST /api/workflows/draft`
- `submitInterviewAnswers(id, payload)`: `POST /api/workflows/{id}/answers`
- `updateWorkflowDraft(id, payload)`: `PUT /api/workflows/{id}`
- `approveWorkflow(id)`: `POST /api/workflows/{id}/approve`
- `listRuns(params)`: `GET /api/runs?limit=...&offset=...`
- `getRun(id)`: `GET /api/runs/{id}`
- `createRun(payload)`: `POST /api/runs`
- `replayRun(id, payload)`: `POST /api/runs/{id}/replay`
- `getRunDiff(baselineId, replayId)`: `GET /api/runs/{baselineId}/diff/{replayId}`
- `getAssertions(id)`: `GET /api/runs/{id}/assertions`

### Real Backend vs Fixture Mode
The UI connects to the real backend running on port 8000 by default (`http://localhost:8000`). If backend endpoints are pending or return errors, the UI clearly displays the real HTTP error rather than fabricating false success states.

## 3. Development & Verification

### Run Local Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Linter
```bash
npm run lint
```

### Automated Tests
```bash
npm run test
```
