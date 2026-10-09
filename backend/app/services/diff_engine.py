import json
from typing import Optional, Any
from app.models.trace_event import TraceEvent
from app.schemas.trace_event import TraceEventSchema
from app.schemas.diff import DiffChangeSchema, DiffSummarySchema, DiffResponse


class DiffEngine:
    """
    DiffEngine compares execution traces between a baseline run and a replay run.
    Identifies aligned changes, additions, removals, and the earliest sequence divergence.
    """

    @classmethod
    def _normalize(cls, val: Any) -> Any:
        if val is None:
            return None
        if isinstance(val, (dict, list)):
            return json.dumps(val, sort_keys=True)
        return val

    @classmethod
    def _is_semantically_equal(
        cls,
        base_event: TraceEvent,
        replay_event: TraceEvent,
    ) -> bool:
        if base_event.type != replay_event.type:
            return False
        if base_event.name != replay_event.name:
            return False
        if cls._normalize(base_event.input) != cls._normalize(replay_event.input):
            return False
        if cls._normalize(base_event.output) != cls._normalize(replay_event.output):
            return False
        return True

    @classmethod
    def compute_diff(
        cls,
        baseline_events: list[TraceEvent],
        replay_events: list[TraceEvent],
        baseline_run_id: str,
        replay_run_id: str,
    ) -> DiffResponse:
        max_len = max(len(baseline_events), len(replay_events))
        changes: list[DiffChangeSchema] = []
        first_divergence: Optional[int] = None

        for idx in range(max_len):
            seq = idx + 1
            b_evt = baseline_events[idx] if idx < len(baseline_events) else None
            r_evt = replay_events[idx] if idx < len(replay_events) else None

            b_schema = TraceEventSchema.model_validate(b_evt) if b_evt else None
            r_schema = TraceEventSchema.model_validate(r_evt) if r_evt else None

            if b_evt is not None and r_evt is not None:
                if not cls._is_semantically_equal(b_evt, r_evt):
                    changes.append(
                        DiffChangeSchema(
                            sequence=seq,
                            change_type="changed",
                            baseline_event=b_schema,
                            replay_event=r_schema,
                        )
                    )
                    if first_divergence is None:
                        first_divergence = seq
            elif b_evt is not None and r_evt is None:
                changes.append(
                    DiffChangeSchema(
                        sequence=seq,
                        change_type="removed",
                        baseline_event=b_schema,
                        replay_event=None,
                    )
                )
                if first_divergence is None:
                    first_divergence = seq
            elif b_evt is None and r_evt is not None:
                changes.append(
                    DiffChangeSchema(
                        sequence=seq,
                        change_type="added",
                        baseline_event=None,
                        replay_event=r_schema,
                    )
                )
                if first_divergence is None:
                    first_divergence = seq

        summary = DiffSummarySchema(
            added=sum(1 for c in changes if c.change_type == "added"),
            removed=sum(1 for c in changes if c.change_type == "removed"),
            changed=sum(1 for c in changes if c.change_type == "changed"),
        )

        return DiffResponse(
            baseline_run_id=baseline_run_id,
            replay_run_id=replay_run_id,
            first_divergence_sequence=first_divergence,
            changes=changes,
            summary=summary,
        )
