import uuid
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.workflow import Workflow, WorkflowVersion
from app.schemas.workflow import (
    WorkflowSpecification,
    ClarificationQuestion,
    QuestionAnswer,
)
from app.services.ai_provider import (
    get_ai_provider,
    AIProviderError,
)


class WorkflowService:
    """
    Workflow Lifecycle & Interview Service.
    Converts developer natural-language intent into an editable, versioned,
    and explicitly approved specification using Gemma 4 AI inference.
    """

    @classmethod
    def create_workflow(
        cls,
        db: Session,
        title: str,
        intent_description: str,
    ) -> Workflow:
        """Create a new workflow draft from initial natural-language intent."""
        wf_id = f"wf_{uuid.uuid4().hex[:8]}"
        workflow = Workflow(
            id=wf_id,
            title=title or "Untitled Workflow",
            description=intent_description.strip(),
            status="draft",
            questions=[],
            answers=[],
            draft_spec=None,
            ai_status="available",
        )
        db.add(workflow)
        db.commit()
        db.refresh(workflow)
        return workflow

    @classmethod
    def generate_questions(
        cls,
        db: Session,
        workflow: Workflow,
    ) -> Workflow:
        """
        Generate clarification questions for a workflow draft using Gemma 4.
        If inference fails, preserves draft state and records ai_status as unavailable.
        """
        provider = get_ai_provider()
        try:
            output = provider.generate_clarification_questions(
                intent=workflow.description,
                existing_q_and_a=workflow.answers,
            )
            workflow.questions = [q.model_dump() for q in output.questions]
            workflow.ai_status = "available"
        except AIProviderError as exc:
            workflow.ai_status = "unavailable"
            db.commit()
            raise exc

        db.commit()
        db.refresh(workflow)
        return workflow

    @classmethod
    def submit_answers(
        cls,
        db: Session,
        workflow: Workflow,
        answers: list[QuestionAnswer],
    ) -> Workflow:
        """Submit developer answers to clarification questions."""
        existing_answers = {a.get("question_id"): a for a in workflow.answers}
        for ans in answers:
            existing_answers[ans.question_id] = ans.model_dump()

        workflow.answers = list(existing_answers.values())
        if workflow.status == "draft":
            workflow.status = "in_review"

        db.commit()
        db.refresh(workflow)
        return workflow

    @classmethod
    def generate_specification(
        cls,
        db: Session,
        workflow: Workflow,
    ) -> Workflow:
        """
        Synthesize structured specification draft using Gemma 4.
        If inference fails, preserves draft and answers, marks AI as unavailable,
        and never auto-approves or fabricates success.
        """
        provider = get_ai_provider()
        try:
            spec: WorkflowSpecification = provider.generate_workflow_spec(
                intent=workflow.description,
                q_and_a=workflow.answers,
                existing_spec=workflow.draft_spec,
            )
            workflow.draft_spec = spec.model_dump()
            workflow.ai_status = "available"
        except AIProviderError as exc:
            workflow.ai_status = "unavailable"
            db.commit()
            raise exc

        db.commit()
        db.refresh(workflow)
        return workflow

    @classmethod
    def update_draft(
        cls,
        db: Session,
        workflow: Workflow,
        title: Optional[str] = None,
        intent_description: Optional[str] = None,
        spec: Optional[WorkflowSpecification] = None,
    ) -> Workflow:
        """Allow manual editing of draft specification prior to approval."""
        if title is not None:
            workflow.title = title
        if intent_description is not None:
            workflow.description = intent_description
        if spec is not None:
            workflow.draft_spec = spec.model_dump()

        workflow.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(workflow)
        return workflow

    @classmethod
    def approve_workflow(
        cls,
        db: Session,
        workflow: Workflow,
        approved_by: Optional[str] = "developer",
        approval_notes: Optional[str] = None,
    ) -> WorkflowVersion:
        """
        Explicitly approve and persist an immutable workflow version.
        Never auto-approves. Preserves historical versions.
        """
        if not workflow.draft_spec:
            # Fallback to synthesizing a basic specification if none exists
            provider = get_ai_provider()
            spec = provider.generate_workflow_spec(
                intent=workflow.description,
                q_and_a=workflow.answers,
            )
            workflow.draft_spec = spec.model_dump()

        # Determine next version number
        current_max = (
            db.query(func.max(WorkflowVersion.version_num))
            .filter(WorkflowVersion.workflow_id == workflow.id)
            .scalar()
        )
        next_ver = 1 if current_max is None else current_max + 1

        version_id = f"wfv_{uuid.uuid4().hex[:8]}"
        version_record = WorkflowVersion(
            id=version_id,
            workflow_id=workflow.id,
            version_num=next_ver,
            created_at=datetime.now(timezone.utc),
            approved_by=approved_by,
            approval_notes=approval_notes,
            spec=workflow.draft_spec,
            status="approved",
        )

        workflow.status = "approved"
        workflow.active_version_num = next_ver
        workflow.updated_at = datetime.now(timezone.utc)

        db.add(version_record)
        db.commit()
        db.refresh(version_record)
        db.refresh(workflow)

        return version_record

    @classmethod
    def list_workflows(cls, db: Session) -> list[Workflow]:
        return db.query(Workflow).order_by(Workflow.updated_at.desc()).all()

    @classmethod
    def get_workflow(cls, db: Session, workflow_id: str) -> Optional[Workflow]:
        return db.query(Workflow).filter(Workflow.id == workflow_id).first()

    @classmethod
    def list_versions(cls, db: Session, workflow_id: str) -> list[WorkflowVersion]:
        return (
            db.query(WorkflowVersion)
            .filter(WorkflowVersion.workflow_id == workflow_id)
            .order_by(WorkflowVersion.version_num.desc())
            .all()
        )

    @classmethod
    def get_version(cls, db: Session, workflow_id: str, version_num: int) -> Optional[WorkflowVersion]:
        return (
            db.query(WorkflowVersion)
            .filter(
                WorkflowVersion.workflow_id == workflow_id,
                WorkflowVersion.version_num == version_num,
            )
            .first()
        )
