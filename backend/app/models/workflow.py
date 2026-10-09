from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, DateTime, JSON, ForeignKey, Index, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)  # draft, in_review, approved
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    active_version_num: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=None)
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    answers: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    draft_spec: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True, default=None)
    ai_status: Mapped[str] = mapped_column(String(64), default="available", nullable=False)

    versions: Mapped[list["WorkflowVersion"]] = relationship(
        "WorkflowVersion",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowVersion.version_num.desc()",
    )


class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workflow_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_num: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    approved_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    approval_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    spec: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="approved", nullable=False)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="versions")

    __table_args__ = (
        Index("ix_workflow_versions_wf_ver", "workflow_id", "version_num", unique=True),
    )
