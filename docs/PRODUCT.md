PRODUCT.md — HoneyBee

1. Product Overview
   HoneyBee is a replay and debugging harness for AI agents. It records an agent run as an ordered trace, lets a developer replay the same scenario with a changed prompt or configuration, and compares the new trace against the original to identify where behavior diverged.
   HoneyBee is built for developers who need to understand not only that an agent failed, but which decision or tool interaction caused the failure.
   One-line pitch
   Record it. Replay it. Find the divergence.
   Hackathon demo
   A refund agent issues a refund before checking the fraud status. HoneyBee records the tool-call sequence, evaluates a safety assertion, then replays the scenario with a corrected prompt/configuration. The developer compares both traces, sees the first divergence, and checks whether the safety assertion now passes.
   The hackathon version uses a deterministic mock agent and mock tools so the demo is repeatable and does not depend on an external LLM API.
2. Problem
   Agent failures are difficult to debug because the final answer often hides the sequence of intermediate decisions and tool interactions that led to it. Re-running an agent may produce a different path, and comparing two runs manually is tedious.
   Developers need a way to:

- Inspect an agent's intermediate steps, model inputs/outputs, tool calls/results, and errors.
- Re-run a scenario after changing a prompt or configuration.
- Compare the original and replayed execution in a structured way.
- Locate the earliest meaningful divergence.
- Verify behavioral requirements against the actual event sequence.

3. Target Users

- AI engineers building tool-using agents.
- Developers debugging agent workflows and regressions.
- Teams evaluating changes to prompts, model configurations, or tool behavior.
- Hackathon judges who need to understand the product's value quickly through a concrete demo.

4. Product Goals
   Must have
1. Record a complete, ordered trace of a sample agent run.
1. Persist run metadata and trace events locally.
1. Display runs and inspect their trace events.
1. Replay a baseline scenario with a changed prompt or configuration.
1. Compare baseline and replay traces, highlighting changed, added, and removed events.
1. Identify the first divergence between two traces.
1. Evaluate at least one behavioral assertion from recorded events.
1. Demonstrate one failing and one passing safety assertion.
   Nice to have, only if time permits

- Filtering or searching trace events.
- More than one deterministic demo scenario.
- Exporting a trace as JSON.
- Optional live LLM integration after the deterministic demo works.

5. Non-goals for the Hackathon

- A production-grade observability platform.
- Support for every agent framework.
- Distributed tracing or multi-service deployment.
- Authentication, billing, organizations, or team management.
- A full experiment tracking platform.
- A dependency on a live LLM or external API for the core demo.
- A sophisticated semantic diff algorithm or a large assertion language.
- Replaying arbitrary real-world side effects without safeguards.

6. Core User Workflow
1. Create a run. Execute the deterministic refund_safety scenario.
1. Inspect the trace. See events in chronological order, including tool calls and results.
1. Check behavior. Evaluate whether the fraud check occurred before any refund was issued.
1. Replay. Change the prompt or scenario configuration and create a new run linked to the baseline.
1. Compare. View the baseline and replay side by side.
1. Find divergence. Identify the earliest sequence where event behavior differs.
1. Verify. Confirm whether the safety assertion passes on the replay.
1. Functional Requirements
   FR-1: Run execution
   The user can trigger a supported sample scenario. The backend creates a unique run and records the scenario configuration, status, creation time, and summary counts.
   FR-2: Trace recording
   The system records ordered events for agent start/end, model/mock input and output, tool calls, tool results, and errors. Each event has a stable ID, run ID, sequence number, timestamp, event type, name, input/output, and metadata.
   FR-3: Run persistence and retrieval
   Runs and events are persisted in SQLite. The user can list runs and retrieve a run with events ordered by sequence.
   FR-4: Replay
   The user can replay a baseline run with an optional prompt or configuration override. Replay creates a new run with baseline_run_id set to the source run ID. The baseline is immutable.
   FR-5: Trace diff
   The user can compare a baseline and replay. The response includes the first divergence position and a list of added, removed, or changed events. Event IDs and timestamps should not by themselves count as semantic differences.
   FR-6: Behavioral assertions
   The system evaluates assertions from actual recorded events. The first required assertion is fraud_check_before_refund, which checks that a fraud-check tool call occurs before any refund tool call.
   FR-7: Clear failure handling
   Missing runs and invalid requests return structured JSON errors. The UI displays loading, empty, and error states rather than pretending operations succeeded.
1. Demo Scenario: Refund Safety
   Scenario
   A mock customer requests a refund. The agent has two tools:

- fraud_check
- issue_refund
  Unsafe baseline
  The agent calls issue_refund before fraud_check. The assertion fails.
  Safe replay
  The agent checks fraud status before issuing a refund. The assertion passes.
  What the audience should see
- A timeline of recorded events.
- The unsafe tool-call order in the baseline.
- A failed fraud_check_before_refund assertion.
- A replay with changed prompt/configuration.
- A side-by-side diff with the first divergence highlighted.
- A passing assertion on the replay.
  Honesty requirement: If the hackathon build uses deterministic mock behavior, label it as a deterministic simulation. Do not present the mock as a live LLM decision.

9. UX Requirements

- The first screen should make the list of runs obvious.
- Users should be able to open a run and understand its event order quickly.
- Distinguish model/mock events, tool calls, tool results, and errors visually.
- The first divergence must be easy to locate.
- Assertion results must show pass/fail and a concise reason.
- Baseline and replay must be clearly labeled.
- Keep the interface focused on debugging; avoid unrelated dashboards and decorative features.
- Use real backend responses for the final demo.

10. API Surface
    The API contract is defined in API_CONTRACT.md. Expected endpoints:

- GET /health
- POST /api/runs
- GET /api/runs
- GET /api/runs/{run_id}
- POST /api/runs/{run_id}/replay
- GET /api/runs/{baseline_run_id}/diff/{replay_run_id}
- GET /api/runs/{run_id}/assertions
  Frontend work should use fixtures matching the API contract until backend endpoints are available.

11. Technical Direction

- Backend: Python 3.13+, FastAPI, Pydantic v2, SQLite, SQLAlchemy 2.x, Uvicorn.
- Frontend: React, Vite, TypeScript, Tailwind CSS, and the agreed component/UI setup in FRONTEND.md.
- Tests: pytest for backend; focused manual or automated checks for the end-to-end UI.
- Execution: Deterministic mock agent and mock tools for the core demo.
- Storage: Local SQLite database; no external database server required.
  Avoid introducing extra infrastructure or dependencies unless required for the core workflow.

12. Data Model Overview
    Run

- id
- status
- created_at
- baseline_run_id
- config
- summary
  TraceEvent
- id
- run_id
- sequence
- type
- timestamp
- name
- input
- output
- metadata
  AssertionResult
- name
- passed
- message
  DiffChange
- sequence
- change_type
- baseline_event
- replay_event
  Use API_CONTRACT.md as the canonical source for field types and endpoint payloads.

13. Three-Hour Delivery Plan
    Time Focus Exit condition
    0–10 min Agree on API contract and scaffold All developers use the same schemas
    10–70 min Parallel implementation Frontend fixtures and backend core are underway
    70–105 min Integrate run listing and trace viewer Frontend can inspect a real recorded run
    105–135 min Integrate replay, diff, assertions Core workflow works end to end
    135–160 min Stabilize and test Unsafe and safe runs produce expected assertion outcomes
    160–180 min Freeze and rehearse Demo works from a clean local start

14. Acceptance Criteria
    The hackathon MVP is ready when:

- [ ] A user can create a sample run.
- [ ] The complete trace is persisted and retrievable after restarting the backend.
- [ ] Trace events are ordered and include tool calls and results.
- [ ] A baseline can be replayed without being modified.
- [ ] The diff shows the first meaningful divergence.
- [ ] At least one safety assertion can fail and pass based on actual events.
- [ ] The UI displays the run, trace, diff, and assertion results from backend responses.
- [ ] The core demo does not require an external LLM API.
- [ ] Setup and demo steps are documented.

15. Risks and Mitigations

- Integration mismatch: Freeze API_CONTRACT.md and share models early.
- Replay is not meaningful: Use a deterministic scenario that deliberately produces safe and unsafe traces.
- Time lost on infrastructure: Use SQLite and local development defaults.
- Mock mistaken for real model behavior: Clearly label deterministic mock execution in the UI and demo.
- Unreliable final demo: Run the full workflow several times and freeze features before presentation.
