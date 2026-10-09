from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, DateTime, JSON, ForeignKey, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), default="running", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    baseline_run_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    summary: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=lambda: {
            "event_count": 0,
            "tool_call_count": 0,
            "error_count": 0,
        },
        nullable=False,
    )

    events: Mapped[list["TraceEvent"]] = relationship(
        "TraceEvent",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="TraceEvent.sequence",
    )
