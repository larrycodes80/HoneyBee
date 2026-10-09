# HoneyBee — Frontend Engineering Specification

**Product:** HoneyBee  
**Stack:** React + Vite + TypeScript  
**Styling:** Tailwind CSS + shadcn/ui  
**API:** FastAPI  
**Status:** Hackathon MVP

---

## 1. Purpose

The HoneyBee frontend is a developer-focused interface for recording, inspecting, replaying, and comparing AI agent executions.

It must make the product's core workflow immediately understandable:

**Record → Replay → Diff → Verify**

The frontend must use real backend responses. It must not fabricate trace events, divergence results, or assertion outcomes.

## 2. Product Experience

The application should feel like a lightweight AI infrastructure debugging tool.

### Design principles

- Dark, developer-oriented interface.
- Clear typography and compact information density.
- Strong visual hierarchy between runs, events, and details.
- Monospaced typography for tool names, arguments, and structured payloads.
- Clear distinction between baseline and replay.
- Red for meaningful regressions, green for passed assertions, and neutral styling for unchanged events.
- Minimal animations and no unnecessary decorative elements.
- Responsive layouts where practical.

Avoid building a generic chatbot UI, marketing landing page, or analytics dashboard that hides the debugging workflow.

## 3. Technology Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Native `fetch` for API communication

Do not add a large state-management library or complex data-fetching framework unless the existing project requires it.

Use a small API client module and React state for the MVP.

## 4. Application Structure

Recommended frontend structure:

```text
frontend/
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types/
    │   ├── run.ts
    │   ├── trace.ts
    │   └── diff.ts
    ├── lib/
    │   ├── api.ts
    │   └── utils.ts
    ├── components/
    │   ├── app-shell.tsx
    │   ├── runs-list.tsx
    │   ├── run-header.tsx
    │   ├── trace-timeline.tsx
    │   ├── trace-event.tsx
    │   ├── event-details.tsx
    │   ├── replay-panel.tsx
    │   ├── diff-view.tsx
    │   └── assertion-results.tsx
    └── pages/
        └── dashboard.tsx
```

This is a suggested structure. Consolidate files when doing so improves delivery speed.

## 5. Main Application Layout

The primary screen should use three logical regions.

### A. Navigation and run selection

Display the product name, a new-run action, and a list of recent executions.

Each run entry should show:

- Scenario name or ID.
- Short run ID.
- Baseline or replay designation.
- Execution status.
- Relative or formatted creation time.

Selecting a run opens its execution details.

### B. Execution timeline

Display trace events in chronological order.

Each event should show:

- Step index.
- Event type.
- Event name.
- Execution status, where applicable.
- Whether the event changed in the comparison.

Selecting an event opens its details.

### C. Inspector and comparison panel

Show detailed event payloads, replay configuration, diff information, or assertion results depending on the selected view.

The layout should prioritize the timeline and comparison rather than requiring the user to navigate through multiple pages.

## 6. Required Screens and Components

### 6.1 Runs panel

Responsibilities:

- Fetch and display available runs.
- Allow selection of a run.
- Distinguish baseline runs from replay runs.
- Display completed and failed states.
- Refresh the list after a new run or replay.

The empty state should provide an action to execute the example scenario.

### 6.2 Run header

Display:

- Scenario ID.
- Run ID.
- Run status.
- Baseline ID, if applicable.
- Creation and completion timestamps.
- Replay action.

The header must make it clear whether the selected run is an original execution or a replay.

### 6.3 Trace timeline

Render events in ascending `step_index` order.

Recommended visual treatment:

- Model events: neutral event styling.
- Tool calls: distinct tool-call styling.
- Tool results: grouped visually with the associated tool call where possible.
- Errors: clearly highlighted.
- Added or removed events: distinct comparison markers.
- Changed events: highlight only the relevant fields where possible.

Do not infer event order from timestamps when `step_index` is available.

### 6.4 Event details

When a user selects an event, show its complete available payload.

Display structured values as formatted JSON.

Support:

- Event type.
- Event name.
- Step index.
- Input.
- Arguments.
- Output.
- Error details.
- Timestamp.

Missing fields should be displayed as unavailable rather than causing a rendering error.

### 6.5 Replay panel

The replay panel must include:

- Editable system prompt.
- Baseline identification.
- Optional model configuration.
- Tool-result policy selection.
- Replay button.
- Loading state.
- Error feedback.

When replay starts, disable duplicate submissions until the request completes.

After a successful replay:

1. Refresh the run list.
2. Select the new replay.
3. Retrieve the new trace.
4. Load the baseline/replay comparison.
5. Display assertion results.

### 6.6 Diff view

The diff view compares a baseline trace with a replay trace.

Show:

- Baseline run ID.
- Replay run ID.
- Total number of reported changes.
- First meaningful divergence.
- Ordered changes.
- Baseline and replay values for changed fields.

Use a side-by-side layout on desktop.

On smaller screens, stack the baseline and replay panels vertically.

Every change must come from the backend diff response.

### 6.7 Assertion results

Display each assertion with:

- Description.
- Pass/fail/error status.
- Evidence supporting the result.

A passed assertion should be visually distinct from a failed assertion.

Do not derive assertion status from diff color or final-answer text.

## 7. TypeScript Data Contracts

The frontend types must match the backend API responses.

### Run

```typescript
export type RunStatus = "running" | "completed" | "failed";

export interface Run {
  id: string;
  scenario_id: string;
  baseline_run_id: string | null;
  status: RunStatus;
  created_at: string;
  completed_at: string | null;
  final_output?: unknown;
}
```

### Trace event

```typescript
export interface TraceEvent {
  id: string;
  run_id: string;
  step_index: number;
  event_type: string;
  name: string | null;
  input: unknown | null;
  arguments: Record<string, unknown> | null;
  output: unknown | null;
  error: unknown | null;
  timestamp: string;
}
```

### Diff response

```typescript
export interface DiffChange {
  change_type: "added" | "removed" | "changed" | "reordered";
  baseline_step_index: number | null;
  replay_step_index: number | null;
  field: string | null;
  baseline_value: unknown;
  replay_value: unknown;
  severity: string;
}

export interface DiffResult {
  baseline_run_id: string;
  replay_run_id: string;
  changes: DiffChange[];
  first_divergence: DiffChange | null;
  summary: {
    total_changes: number;
  };
}
```

The exact nullable fields must match the implemented Pydantic schemas. Update the frontend types if the final API contract changes; do not silently coerce incompatible responses.

### Assertion result

```typescript
export interface AssertionResult {
  run_id: string;
  assertion_type: string;
  description: string;
  status: "passed" | "failed" | "error";
  evidence: Record<string, unknown>;
}
```

## 8. API Integration

Create a single API client module.

Base URL:

```text
VITE_API_BASE_URL=http://localhost:8000
```

### Required operations

| Operation               | Endpoint                                       |
| ----------------------- | ---------------------------------------------- |
| List runs               | `GET /api/runs`                                |
| Create run              | `POST /api/runs`                               |
| Retrieve run and events | `GET /api/runs/{run_id}`                       |
| Replay run              | `POST /api/runs/{run_id}/replay`               |
| Compare runs            | `GET /api/runs/{baseline_id}/diff/{replay_id}` |
| Retrieve assertions     | `GET /api/runs/{run_id}/assertions`            |

Use URL encoding for path parameters where appropriate.

The API client must:

- Handle unsuccessful HTTP responses.
- Parse JSON safely.
- Surface useful error messages.
- Use typed request and response contracts.
- Avoid duplicating endpoint logic across components.

The backend must enable CORS for the local Vite development origin.

## 9. State Management

Use local React state or a small shared context for the MVP.

The application needs to track:

- Run list.
- Selected run.
- Selected event.
- Baseline run ID.
- Replay run ID.
- Editable system prompt.
- Tool-result policy.
- Current loading operation.
- API error state.
- Diff response.
- Assertion results.

Avoid maintaining duplicate copies of the same trace data across unrelated components.

After a mutation, refresh data from the backend rather than constructing a fake successful response locally.

## 10. Error and Loading States

Every major asynchronous operation needs a visible state.

### Loading

- Initial application load.
- Fetching a run.
- Starting a scenario.
- Executing a replay.
- Calculating or fetching a diff.
- Loading assertions.

### Errors

Handle:

- Backend unavailable.
- Invalid request.
- Unknown run ID.
- Replay failure.
- Diff request failure.
- Malformed or unexpected response.
- Missing baseline or replay.

An unsuccessful operation must not be presented as a successful run.

Preserve the selected baseline and any unsaved prompt edits when appropriate.

## 11. Frontend Acceptance Criteria

The frontend is ready when:

1. The app starts locally using the documented command.
2. The user can execute the example scenario.
3. The runs panel displays actual backend runs.
4. The user can inspect ordered trace events.
5. The user can inspect event arguments, results, and errors.
6. The user can edit the prompt and start a replay.
7. The replay is retrieved as a distinct run.
8. The UI displays the backend-computed diff.
9. The first divergence is visible.
10. Assertion results reflect backend evaluation.
11. Loading and error states are handled.
12. The complete demo can be executed without editing source code.

## 12. Time-Bounded Implementation Plan

### First 30 minutes

- Scaffold the Vite app.
- Define shared TypeScript interfaces.
- Implement the application shell.
- Agree on API response contracts.

### Minutes 30–75

- Build the runs list.
- Build the trace timeline.
- Build event details.
- Implement the API client.

### Minutes 75–110

- Build the replay panel.
- Integrate replay submission.
- Refresh and select the replay.

### Minutes 110–140

- Implement side-by-side diff.
- Implement assertion results.
- Connect actual backend responses.

### Minutes 140–180

- Fix integration problems.
- Test the full workflow.
- Polish empty, loading, and error states.
- Rehearse the demonstration.

If integration is delayed, prioritize the trace timeline, replay action, real diff, and assertion results over visual polish.

## 13. Definition of Done

The frontend must enable a developer to execute a scenario, inspect its trace, modify the prompt, replay it, view behavioral differences, and verify assertions through a single coherent interface.

The interface is successful when a developer can understand where the agent's behavior changed without manually reading raw database records or fabricated example data.
