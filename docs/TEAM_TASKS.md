TEAM_TASKS.md — HoneyBee
Goal
Build HoneyBee, a small, working agent replay and debugging harness for the hackathon.
The demo must show:

1. A sample agent executes and records its full trace.
2. The same scenario is replayed with a changed prompt/configuration.
3. A side-by-side diff identifies where the replay diverges from the baseline.
4. A behavioral assertion reports pass/fail (for example, fraud must be checked before a refund is issued).
   Team split: 4 developers — 2 frontend, 2 backend.
   Developer 1 — Frontend: Runs Dashboard & Trace Viewer
   Ownership: Main application shell, runs list, run details, trace timeline.
   Tasks

- Set up or use the agreed React + Vite + TypeScript frontend scaffold.
- Build the runs dashboard showing run ID, status, start time, and run type.
- Build a run detail view with events in chronological order.
- Display event type, timestamp, input/output summary, tool name, tool arguments/results, and errors where applicable.
- Add event-detail inspection (drawer, side panel, or expandable row).
- Implement loading, empty, and error states.
- Start with fixture data matching the shared API schema; replace fixtures with API calls during integration.
  Deliverables
- Runs dashboard and trace viewer.
- Reusable run/event UI components.
- API integration for listing runs and retrieving a run trace.
  Acceptance criteria
- A user can select a run and inspect its events in order.
- Tool calls, tool results, model outputs, and errors are visually distinguishable.
- The page handles empty data and API failures without crashing.
  Developer 2 — Frontend: Replay, Diff & Assertions
  Ownership: Replay controls and comparison/debugging views.
  Tasks
- Build a replay panel for changing the prompt and/or model configuration.
- Allow the user to trigger replay from a baseline run.
- Build a baseline-versus-replay comparison view.
- Highlight added, removed, and changed events.
- Make the first divergence easy to find.
- Display assertion results with clear pass/fail states and short explanations.
- Use fixture data matching the shared API schema until endpoints are available.
- Coordinate component boundaries and styling with Developer 1.
  Deliverables
- Replay panel.
- Side-by-side diff view.
- Assertion results UI.
- API integration for replay, diff, and assertion endpoints.
  Acceptance criteria
- A user can launch replay from a selected baseline.
- The comparison identifies the first differing event and summarizes changes.
- Assertion results shown in the UI come from actual backend responses, not hardcoded success states.
  Developer 3 — Backend: Agent Execution, Recording & Persistence
  Ownership: Core execution path, trace schema, and storage.
  Tasks
- Set up the FastAPI backend and local SQLite database.
- Define and share the Run and TraceEvent schemas before implementation diverges.
- Implement persistence for runs and ordered trace events.
- Build a deterministic sample agent with mock tools (for example, a refund agent with a fraud-check tool and refund tool).
- Record model/mock decisions, tool calls, tool results, errors, and timestamps.
- Implement endpoints:
  - POST /api/runs — execute the sample scenario and record a run.
  - GET /api/runs — list runs.
  - GET /api/runs/{run_id} — retrieve a run and its trace.
- Provide stable fixture scenarios so the demo behaves consistently.
- Add basic tests for recording and retrieval.
  Deliverables
- Working FastAPI service and SQLite persistence.
- Shared run/event schema.
- Deterministic sample run with persisted trace.
- Run creation and retrieval endpoints.
  Acceptance criteria
- Starting a sample run produces a stored run and ordered events.
- Reloading the run returns the same recorded trace.
- Errors are recorded in the trace rather than silently disappearing.
- The backend can run locally using documented commands.
  Developer 4 — Backend: Replay Engine, Diff & Assertions
  Ownership: Replay orchestration, trace comparison, behavioral checks.
  Tasks
- Coordinate with Developer 3 on the shared models, database, and tool interfaces.
- Implement replay as a new run linked to the baseline; never mutate the baseline.
- Support changing the prompt and/or scenario configuration.
- Keep replay behavior explicit and safe: do not feed an unrelated cached tool result to a changed tool call.
- Compare baseline and replay traces in event order.
- Return the first divergence and a structured list of added, removed, or changed events.
- Implement behavioral assertions, including tool-order constraints such as fraud_check occurring before issue_refund.
- Implement endpoints:
  - POST /api/runs/{run_id}/replay — create a replay run.
  - GET /api/runs/{baseline_run_id}/diff/{replay_run_id} — compare traces.
  - GET /api/runs/{run_id}/assertions — evaluate assertions for a run.
- Add basic tests for replay linkage, diff output, and assertion pass/fail behavior.
  Deliverables
- Replay engine.
- Trace diff engine.
- Assertion evaluator and API endpoints.
  Acceptance criteria
- Replay creates a separate run with a baseline reference.
- Diff output identifies the first divergence and event-level changes.
- Assertions are evaluated from the actual event sequence.
- Tests cover at least one passing and one failing safety assertion.
  Shared API Contract
  Agree on these fields before frontend/backend work proceeds independently. Keep the contract small and adjust it only by agreement.
  Run
- id: string
- status: running | completed | failed
- created_at: ISO-8601 timestamp
- baseline_run_id: string or null
- config: object containing the prompt/scenario configuration used
  TraceEvent
- id: string
- run_id: string
- sequence: integer
- type: agent_start | model_input | model_output | tool_call | tool_result | error | agent_end
- timestamp: ISO-8601 timestamp
- name: string
- input: object or null
- output: object or null
- metadata: object
  Diff response
- baseline_run_id: string
- replay_run_id: string
- first_divergence_sequence: integer or null
- changes: list of objects with sequence, change_type, baseline_event, and replay_event
  Assertion response
- run_id: string
- results: list of objects with name, passed, and message
  Important: If the implementation needs different field names, Developer 3 proposes the change and updates the contract; all four developers must use the same version.
  Integration Plan (3 Hours)
  Time Milestone Required outcome
  0–10 min Contract and scaffold Confirm schemas, endpoint payloads, repo commands, and ownership
  10–70 min Parallel implementation Frontend uses matching fixtures; backend builds execution, recording, replay, diff, assertions
  70–105 min First integration Dashboard lists real runs; run details load from the backend
  105–135 min Replay integration Replay, diff, and assertion UI work end-to-end
  135–160 min Stabilize Fix critical bugs; verify safety assertion pass/fail; rehearse demo
  160–180 min Freeze and present No new features; run the demo from a clean start

Team Rules

- Keep tasks independent and commit small, focused changes.
- Do not commit directly to main; use short-lived feature branches.
- Share schema/API changes in the team channel before implementing them.
- Frontend developers use fixtures until endpoints are ready; do not wait idle.
- Backend developers expose and document endpoints as soon as each is usable.
- Do not add real LLM integration unless the complete mock-based demo already works.
- Avoid extra infrastructure, authentication, deployment, and unrelated features.
- Prioritize a reliable end-to-end demo over feature count.
  Definition of Done
- [ ] A sample run records a complete trace.
- [ ] Runs and traces persist in SQLite.
- [ ] Replay creates a new run without changing the baseline.
- [ ] Diff identifies the first divergence and event changes.
- [ ] At least one behavioral assertion passes and one fails in tests.
- [ ] Frontend uses real API responses for the end-to-end demo.
- [ ] Setup and run commands are documented.
- [ ] Demo works from a clean local start.
