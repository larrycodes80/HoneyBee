export type RunStatus = 'running' | 'completed' | 'failed';

export type TraceEventType =
  | 'agent_start'
  | 'model_input'
  | 'model_output'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'agent_end';

export type ChangeType = 'added' | 'removed' | 'changed';

export interface RunConfig {
  scenario: string;
  prompt: string;
  [key: string]: any;
}

export interface RunSummary {
  event_count: number;
  tool_call_count: number;
  error_count: number;
}

export interface Run {
  id: string;
  status: RunStatus;
  created_at: string;
  baseline_run_id: string | null;
  config: RunConfig;
  summary: RunSummary;
}

export interface TraceEvent {
  id: string;
  run_id: string;
  sequence: number;
  type: TraceEventType;
  timestamp: string;
  name: string;
  input: Record<string, any> | null;
  output: Record<string, any> | string | number | boolean | null;
  metadata: Record<string, any>;
}

export interface RunDetailResponse {
  run: Run;
  events: TraceEvent[];
}

export interface ListRunsResponse {
  items: Run[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateRunPayload {
  scenario: string;
  prompt?: string;
}

export interface ReplayRunPayload {
  prompt?: string;
  config_overrides?: Record<string, any>;
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface AssertionResponse {
  run_id: string;
  results: AssertionResult[];
}

export interface DiffChange {
  sequence: number;
  change_type: ChangeType;
  baseline_event: TraceEvent | null;
  replay_event: TraceEvent | null;
}

export interface DiffResponse {
  baseline_run_id: string;
  replay_run_id: string;
  first_divergence_sequence: number | null;
  changes: DiffChange[];
  summary?: {
    added: number;
    removed: number;
    changed: number;
  };
}
