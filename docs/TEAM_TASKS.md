# TraceForge — Team Task Allocation

**Team size:** 3 developers  
**Total build time:** 3 hours  
**Objective:** Deliver a working record–replay–diff–verify MVP.

---

## 1. Team Structure

### Developer A — Backend and Agent Execution

**Primary ownership:** Python backend, execution engine, recorder, persistence, and replay.

Responsibilities:

- FastAPI setup.
- Pydantic schemas.
- SQLite schema and repository functions.
- Agent loop and tool registry.
- Trace recorder.
- Run creation and retrieval.
- Replay engine.
- Controlled tool-result matching.
- Backend execution status and error handling.

**Deliverables:**

- Working backend server.
- Executable sample scenario.
- Persisted baseline and replay traces.
- Documented API contracts.
- Tests for recording and replay matching.

### Developer B — Frontend and User Experience

**Primary ownership:** React interface, API client, timeline, diff view, and assertion presentation.

Responsibilities:

- Vite and TypeScript setup.
- Application shell and visual design.
- Run list and run header.
- Trace timeline.
- Event inspector.
- Prompt editor and replay controls.
- Side-by-side comparison.
- Assertion results.
- Loading and error states.

**Deliverables:**

- Working frontend.
- Typed API client.
- Timeline and event inspector.
- Replay interface.
- Diff and assertion views.
- Integration with actual backend responses.

### Developer C — Integration, Diff Validation, and Demo

**Primary ownership:** Cross-component integration, behavioral correctness, regression testing, and submission readiness.

Developer C is an implementation owner, not just a coordinator.

Responsibilities:

- Establish and validate API contracts with A and B.
- Implement or own the diff engine and assertion evaluator in coordination with A.
- Build focused tests for divergence detection and behavioral assertions.
- Validate baseline/replay linkage.
- Integrate frontend and backend.
- Test the complete user journey.
- Investigate mismatches between the frontend and backend.
- Prepare example fixtures and demo instructions.
- Verify README, license, and clean startup.

**Deliverables:**

- Working diff engine and first-divergence behavior.
- Required-order assertion and test coverage.
- Successful end-to-end demo.
- Reproducible startup instructions.
- Verified public repository and submission artifacts.

### Ownership rule

Developer C owns the correctness and integration of the diff/assertion layer. Developer A owns the agent execution and persistence layer. Developer B owns the interface and presentation layer.

All three developers must agree on the event schema and API contracts before independently implementing dependent features.

---

## 2. Critical Shared Contract

Before parallel development begins, agree on these items:

1. Run response shape.
2. Trace event fields and event types.
3. Replay request shape.
4. Diff response shape.
5. Assertion response shape.
6. Endpoint paths and HTTP methods.
7. Run statuses and assertion statuses.
8. How the replay references its baseline.

The agreed contracts must be recorded in `BACKEND.md` and reflected in frontend TypeScript types.

**Do not allow each developer to invent their own schema.**

If a contract must change, communicate the change immediately and update both backend and frontend implementations.

---

## 3. Work Breakdown

| Workstream                         | Owner              | Priority | Depends on                      |
| ---------------------------------- | ------------------ | -------- | ------------------------------- |
| FastAPI and database setup         | A                  | P0       | Agreed run schema               |
| Agent loop and mock tools          | A                  | P0       | Scenario definition             |
| Trace recorder and persistence     | A                  | P0       | Event schema                    |
| Replay and fixture policy          | A                  | P0       | Recorder and tool registry      |
| Diff engine                        | C                  | P0       | Event schema and sample traces  |
| Behavioral assertions              | C                  | P0       | Event schema and scenario rules |
| Frontend shell and API client      | B                  | P0       | API contract                    |
| Runs list and timeline             | B                  | P0       | Run and event schemas           |
| Replay controls                    | B                  | P0       | Replay endpoint contract        |
| Diff and assertion UI              | B                  | P0       | Diff and assertion schemas      |
| End-to-end verification            | C                  | P0       | Working backend and frontend    |
| README, license, demo instructions | C, reviewed by all | P0       | Stable application behavior     |
| Optional LLM integration           | A, if time permits | P1       | Working mock execution          |
| Advanced diff algorithms           | C, if time permits | P2       | Correct basic comparison        |

---

## 4. Three-Hour Schedule

### Phase 1 — Contract and scaffold (0–20 minutes)

**All developers**

- Confirm the refund-safety scenario.
- Agree on run, event, replay, diff, and assertion schemas.
- Create the repository and branch structure.
- Establish the backend/frontend startup commands.

**Developer A**

- Scaffold FastAPI.
- Initialize SQLite.
- Define the core Pydantic schemas.

**Developer B**

- Scaffold Vite and React.
- Create the app shell and initial layout.
- Define TypeScript interfaces matching the backend schema.

**Developer C**

- Validate the API contract.
- Create the diff/assertion module structure.
- Write the first test cases for ordering and divergence.
- Ensure all developers can run the repository.

### Phase 2 — Independent implementation (20–80 minutes)

**Developer A**

- Implement the agent loop.
- Implement the tool registry.
- Record model/mock decisions and tool interactions.
- Persist baseline traces.
- Implement replay and fixture matching.

**Developer B**

- Implement runs list.
- Implement timeline and event inspector.
- Build replay configuration and controls.
- Implement loading and error states using the agreed API.

**Developer C**

- Implement ordered trace comparison.
- Implement first-divergence detection.
- Implement the required-order assertion.
- Test added, removed, and changed events.
- Validate replay policy behavior with Developer A.

### Phase 3 — Integration (80–125 minutes)

**Developer A**

- Finish the replay endpoint.
- Verify failed runs preserve their events.
- Fix backend contract mismatches.

**Developer B**

- Connect all screens to actual API responses.
- Complete replay submission and run selection.
- Integrate the diff and assertion views.

**Developer C**

- Connect the diff engine to persisted traces.
- Run end-to-end tests.
- Diagnose backend/frontend integration problems.
- Verify that displayed statuses are computed, not hardcoded.

### Phase 4 — Stabilization (125–155 minutes)

**All developers**

- Execute the complete scenario from a clean start.
- Fix critical bugs.
- Test the corrected prompt and the baseline.
- Verify error handling and replay linkage.

**Developer A:** backend reliability and clean startup.

**Developer B:** interaction polish and visual clarity.

**Developer C:** regression tests, demo workflow, and repository documentation.

### Phase 5 — Submission readiness (155–180 minutes)

- Verify installation and startup instructions.
- Verify public repository visibility.
- Add and review the open-source license.
- Ensure no secrets or credentials are committed.
- Rehearse the demonstration.
- Freeze features and fix only critical defects.

---

## 5. Integration Gates

### Gate 1: Shared contract ready

**Deadline:** minute 20.

All developers agree on the event schema and endpoint contracts.

### Gate 2: Baseline trace exists

**Deadline:** minute 60–70.

Developer A can execute the scenario and persist its actual events.

### Gate 3: Replay and diff work independently

**Deadline:** minute 100.

A replay creates a new trace, and Developer C can compare two saved traces without using hardcoded results.

### Gate 4: Full interface works

**Deadline:** minute 130.

Developer B can execute the scenario, replay it, inspect the trace, and view the comparison through the UI.

### Gate 5: Demo frozen

**Deadline:** minute 155.

The team can complete the full workflow reliably. No new features should be introduced after this point unless a core requirement is broken.

---

## 6. Communication and Coordination

Use the shared repository as the source of truth.

- Every developer works on a separate feature branch.
- Share API changes before implementing them.
- Keep pull requests small.
- Communicate blockers as soon as they affect another workstream.
- Do not independently change shared types or endpoint paths without coordination.
- Prefer a minimal working implementation over a broad incomplete architecture.
- Do not wait until the end to integrate.

If a dependency is not ready, use a temporary mock that follows the agreed contract. Replace it with the real implementation as soon as possible.

Temporary mocks must be clearly identified and must not be mistaken for production backend results.

---

## 7. Feature Freeze and Fallback Strategy

If the team falls behind schedule, preserve the following in order:

1. Real trace recording.
2. Persisted baseline and replay runs.
3. Actual behavioral differences.
4. First-divergence detection.
5. At least one real behavioral assertion.
6. Usable UI for the complete workflow.
7. Documentation and demo polish.

Defer optional model integrations, advanced diff algorithms, and nonessential visual features.

A reliable end-to-end demonstration is more valuable than several partially implemented features.

---

## 8. Final Definition of Done

The team is finished when a new user can:

1. Start TraceForge locally.
2. Execute the sample scenario.
3. Inspect the original trace.
4. Modify the system prompt.
5. Replay the scenario.
6. Compare the original and replayed runs.
7. Identify the first meaningful divergence.
8. See a behavioral assertion pass or fail based on actual events.

All three developers should be able to explain the architecture, the replay policy, and how the diff is computed.
