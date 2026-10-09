from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, Integer, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class TraceEvent(Base):
    __tablename__ = "trace_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    run_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    input: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    output: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    # Using column name "metadata" in DB, but attribute "event_metadata" to prevent collision with SQLAlchemy Base.metadata
    event_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
    )

    run: Mapped["Run"] = relationship("Run", back_populates="events")

    __table_args__ = (
        Index("ix_trace_events_run_id_sequence", "run_id", "sequence"),
    )
