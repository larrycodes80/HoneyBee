import uuid
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.run import Run
from app.models.trace_event import TraceEvent


class TraceRecorder:
    """
    Reusable trace recorder service for recording agent execution events.
    Assigns monotonically increasing sequences starting at 1 and maintains
    the owning run's summary counts.
    """

    def __init__(self, db: Session, run: Run | str):
        self.db = db
        if isinstance(run, str):
            run_obj = db.query(Run).filter(Run.id == run).first()
            if not run_obj:
                raise ValueError(f"Run with ID '{run}' not found")
            self.run = run_obj
            self.run_id = run
        else:
            self.run = run
            self.run_id = run.id

        # Determine current highest sequence number for this run
        max_seq = (
            self.db.query(func.max(TraceEvent.sequence))
            .filter(TraceEvent.run_id == self.run_id)
            .scalar()
        )
        self._current_sequence = max_seq if max_seq is not None else 0

        # Sync counts from current run summary or calculate
        summary = self.run.summary or {}
        self.event_count = summary.get("event_count", self._current_sequence)
        self.tool_call_count = summary.get("tool_call_count", 0)
        self.error_count = summary.get("error_count", 0)

    def record_event(
        self,
        type: str,
        name: str,
        input: Optional[dict[str, Any]] = None,
        output: Optional[Any] = None,
        metadata: Optional[dict[str, Any]] = None,
        timestamp: Optional[datetime] = None,
    ) -> TraceEvent:
        """
        Record a new TraceEvent to the database and update run summary.
        """
        self._current_sequence += 1
        event_id = f"evt_{uuid.uuid4().hex[:12]}"
        event_time = timestamp or datetime.now(timezone.utc)

        event = TraceEvent(
            id=event_id,
            run_id=self.run_id,
            sequence=self._current_sequence,
            type=type,
            timestamp=event_time,
            name=name,
            input=input,
            output=output,
            event_metadata=metadata if metadata is not None else {},
        )

        self.db.add(event)

        # Update summary counts
        self.event_count += 1
        if type == "tool_call":
            self.tool_call_count += 1
        elif type == "error":
            self.error_count += 1

        self.run.summary = {
            "event_count": self.event_count,
            "tool_call_count": self.tool_call_count,
            "error_count": self.error_count,
        }

        self.db.flush()
        return event

    def get_events(self) -> list[TraceEvent]:
        """
        Retrieve all recorded events for this run, ordered by sequence ascending.
        """
        return (
            self.db.query(TraceEvent)
            .filter(TraceEvent.run_id == self.run_id)
            .order_by(TraceEvent.sequence.asc())
            .all()
        )
