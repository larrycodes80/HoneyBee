from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class WorkflowSpecification(BaseModel):
    """
    Formal, structured workflow specification converted from natural-language intent.
    Strictly distinguishes hard requirements and safety invariants from preferences.
    """
    goal: str = Field(description="High-level intended objective of the workflow")
    required_outcomes: list[str] = Field(
        default_factory=list,
        description="Mandatory tangible outcomes that must be achieved.",
    )
    required_conditions: list[str] = Field(
        default_factory=list,
        description="Pre-requisite states that must be validated prior to actions.",
    )
    forbidden_actions: list[str] = Field(
        default_factory=list,
        description="Explicit actions that the agent must never perform.",
    )
    safety_invariants: list[str] = Field(
        default_factory=list,
        description="Non-negotiable safety rules that must hold true at every execution step.",
    )
    acceptable_alternatives: list[str] = Field(
        default_factory=list,
        description="Valid alternative ordering or execution paths that satisfy requirements.",
    )
    failure_handling_requirements: list[str] = Field(
        default_factory=list,
        description="Required fallback behavior, retry policies, or escalation procedures.",
    )
    success_criteria: list[str] = Field(
        default_factory=list,
        description="Verifiable evaluation conditions for passing execution.",
    )
    external_side_effects: list[str] = Field(
        default_factory=list,
        description="External mutations permitted (e.g. database updates, webhooks, disbursements).",
    )
    unresolved_assumptions: list[str] = Field(
        default_factory=list,
        description="Open questions or assumptions that require developer clarity.",
    )
    hard_requirements: list[str] = Field(
        default_factory=list,
        description="Mandatory compliance constraints (must not be violated).",
    )
    preferences: list[str] = Field(
        default_factory=list,
        description="Non-binding stylistic or performance suggestions (never equated with safety invariants).",
    )

    model_config = ConfigDict(from_attributes=True)


class ClarificationQuestion(BaseModel):
    id: str
    question: str
    category: str = Field(
        default="safety_boundary",
        description="Category such as safety_boundary, edge_case, failure_handling, or tradeoff.",
    )
    rationale: str = Field(
        description="Why this question is critical to resolving ambiguous intent.",
    )


class ClarificationQuestionsOutput(BaseModel):
    questions: list[ClarificationQuestion] = Field(default_factory=list)


class QuestionAnswer(BaseModel):
    question_id: str
    question: str
    answer: str


class CreateWorkflowRequest(BaseModel):
    title: str = "Untitled Workflow"
    intent_description: str = Field(
        description="Natural-language description of intended agent workflow.",
    )


class SubmitAnswersRequest(BaseModel):
    answers: list[QuestionAnswer] = Field(
        description="Developer answers to clarification interview questions.",
    )


class UpdateWorkflowDraftRequest(BaseModel):
    title: Optional[str] = None
    intent_description: Optional[str] = None
    spec: Optional[WorkflowSpecification] = None


class ApproveWorkflowRequest(BaseModel):
    approved_by: Optional[str] = "developer"
    approval_notes: Optional[str] = None


class WorkflowVersionResponse(BaseModel):
    id: str
    workflow_id: str
    version_num: int
    created_at: datetime
    approved_by: Optional[str] = None
    approval_notes: Optional[str] = None
    spec: WorkflowSpecification
    status: str = "approved"

    model_config = ConfigDict(from_attributes=True)


class WorkflowResponse(BaseModel):
    id: str
    title: str
    description: str
    status: str  # draft, in_review, approved
    created_at: datetime
    updated_at: datetime
    active_version_num: Optional[int] = None
    questions: list[ClarificationQuestion] = Field(default_factory=list)
    answers: list[QuestionAnswer] = Field(default_factory=list)
    draft_spec: Optional[WorkflowSpecification] = None
    ai_status: Optional[str] = "available"

    model_config = ConfigDict(from_attributes=True)


class WorkflowListResponse(BaseModel):
    items: list[WorkflowResponse]
    total: int

    model_config = ConfigDict(from_attributes=True)
