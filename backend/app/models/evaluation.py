from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, DateTime, JSON, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    run_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    verdict: Mapped[str] = mapped_column(String(32), nullable=False)  # PASS, FAIL, INCONCLUSIVE
    status: Mapped[str] = mapped_column(String(32), default="passed", nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expected_workflow: Mapped[str] = mapped_column(Text, nullable=False)
    first_divergence_event_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    expected_behavior: Mapped[str] = mapped_column(Text, nullable=False)
    observed_behavior: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_event_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_correction: Mapped[str] = mapped_column(Text, nullable=False)
    limitations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evaluator_type: Mapped[str] = mapped_column(String(64), default="hybrid_llm", nullable=False)
    findings: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    provider_metadata: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    run: Mapped["Run"] = relationship("Run", back_populates="evaluations")

    __table_args__ = (
        Index("ix_evaluations_run_id_created_at", "run_id", "created_at"),
    )
