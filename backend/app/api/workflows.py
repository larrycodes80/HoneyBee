from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.workflow import (
    WorkflowResponse,
    WorkflowListResponse,
    WorkflowVersionResponse,
    CreateWorkflowRequest,
    SubmitAnswersRequest,
    UpdateWorkflowDraftRequest,
    ApproveWorkflowRequest,
)
from app.services.workflow_service import WorkflowService
from app.services.ai_provider import (
    AIProviderError,
    AIAuthenticationError,
    AIRateLimitError,
    AITimeoutError,
    AIModelUnavailableError,
    AIMalformedResponseError,
    AIConfigurationError,
)

router = APIRouter(prefix="/api/workflows", tags=["Workflows"])


def _handle_ai_error(exc: AIProviderError) -> HTTPException:
    if isinstance(exc, AIAuthenticationError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "AI_AUTHENTICATION_ERROR", "message": str(exc)},
        )
    if isinstance(exc, AIRateLimitError):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "AI_RATE_LIMIT_ERROR", "message": str(exc)},
        )
    if isinstance(exc, AITimeoutError):
        return HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={"code": "AI_TIMEOUT_ERROR", "message": str(exc)},
        )
    if isinstance(exc, AIModelUnavailableError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AI_MODEL_UNAVAILABLE", "message": str(exc)},
        )
    if isinstance(exc, (AIMalformedResponseError, AIConfigurationError)):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "AI_INFERENCE_ERROR", "message": str(exc)},
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail={"code": "AI_PROVIDER_ERROR", "message": str(exc)},
    )


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow_draft(
    body: CreateWorkflowRequest,
    db: Session = Depends(get_db),
) -> WorkflowResponse:
    """Create a new workflow draft from initial natural-language intent."""
    wf = WorkflowService.create_workflow(
        db=db,
        title=body.title,
        intent_description=body.intent_description,
    )
    return WorkflowResponse.model_validate(wf)


@router.get("", response_model=WorkflowListResponse)
def list_workflows(
    db: Session = Depends(get_db),
) -> WorkflowListResponse:
    """List all workflow drafts and approved specifications."""
    items = WorkflowService.list_workflows(db=db)
    return WorkflowListResponse(
        items=[WorkflowResponse.model_validate(w) for w in items],
        total=len(items),
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
) -> WorkflowResponse:
    """Retrieve a workflow draft and its latest interview/specification state."""
    wf = WorkflowService.get_workflow(db=db, workflow_id=workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "WORKFLOW_NOT_FOUND", "message": f"Workflow '{workflow_id}' was not found."},
        )
    return WorkflowResponse.model_validate(wf)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow_draft(
    workflow_id: str,
    body: UpdateWorkflowDraftRequest,
    db: Session = Depends(get_db),
) -> WorkflowResponse:
    """Manually edit workflow draft details, title, or specification prior to approval."""
    wf = WorkflowService.get_workflow(db=db, workflow_id=workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "WORKFLOW_NOT_FOUND", "message": f"Workflow '{workflow_id}' was not found."},
        )

    updated = WorkflowService.update_draft(
        db=db,
        workflow=wf,
        title=body.title,
        intent_description=body.intent_description,
        spec=body.spec,
    )
    return WorkflowResponse.model_validate(updated)


@router.post("/{workflow_id}/questions", response_model=WorkflowResponse)
def generate_clarification_questions(
    workflow_id: str,
    db: Session = Depends(get_db),
) -> WorkflowResponse:
    """Generate clarification questions from intent using Gemma 4 AI inference."""
    wf = WorkflowService.get_workflow(db=db, workflow_id=workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "WORKFLOW_NOT_FOUND", "message": f"Workflow '{workflow_id}' was not found."},
        )

    try:
        updated = WorkflowService.generate_questions(db=db, workflow=wf)
        return WorkflowResponse.model_validate(updated)
    except AIProviderError as exc:
        raise _handle_ai_error(exc)


@router.post("/{workflow_id}/answers", response_model=WorkflowResponse)
def submit_answers(
    workflow_id: str,
    body: SubmitAnswersRequest,
    db: Session = Depends(get_db),
) -> WorkflowResponse:
    """Submit developer answers to clarification interview questions."""
    wf = WorkflowService.get_workflow(db=db, workflow_id=workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "WORKFLOW_NOT_FOUND", "message": f"Workflow '{workflow_id}' was not found."},
        )

    updated = WorkflowService.submit_answers(db=db, workflow=wf, answers=body.answers)
    return WorkflowResponse.model_validate(updated)


@router.post("/{workflow_id}/generate-spec", response_model=WorkflowResponse)
def generate_workflow_specification(
    workflow_id: str,
    db: Session = Depends(get_db),
) -> WorkflowResponse:
    """Synthesize structured specification draft from intent and answers using Gemma 4."""
    wf = WorkflowService.get_workflow(db=db, workflow_id=workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "WORKFLOW_NOT_FOUND", "message": f"Workflow '{workflow_id}' was not found."},
        )

    try:
        updated = WorkflowService.generate_specification(db=db, workflow=wf)
        return WorkflowResponse.model_validate(updated)
    except AIProviderError as exc:
        raise _handle_ai_error(exc)


@router.post("/{workflow_id}/approve", response_model=WorkflowVersionResponse, status_code=status.HTTP_201_CREATED)
def approve_workflow(
    workflow_id: str,
    body: Optional[ApproveWorkflowRequest] = None,
    db: Session = Depends(get_db),
) -> WorkflowVersionResponse:
    """
    Explicitly approve and lock the workflow draft into an immutable version.
    Never auto-approves. Preserves historical versions when re-edited.
    """
    wf = WorkflowService.get_workflow(db=db, workflow_id=workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "WORKFLOW_NOT_FOUND", "message": f"Workflow '{workflow_id}' was not found."},
        )

    approved_by = body.approved_by if body and body.approved_by else "developer"
    approval_notes = body.approval_notes if body else None

    try:
        version = WorkflowService.approve_workflow(
            db=db,
            workflow=wf,
            approved_by=approved_by,
            approval_notes=approval_notes,
        )
        return WorkflowVersionResponse.model_validate(version)
    except AIProviderError as exc:
        raise _handle_ai_error(exc)


@router.get("/{workflow_id}/versions", response_model=list[WorkflowVersionResponse])
def list_workflow_versions(
    workflow_id: str,
    db: Session = Depends(get_db),
) -> list[WorkflowVersionResponse]:
    """Retrieve all immutable historical approved versions of a workflow."""
    wf = WorkflowService.get_workflow(db=db, workflow_id=workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "WORKFLOW_NOT_FOUND", "message": f"Workflow '{workflow_id}' was not found."},
        )

    versions = WorkflowService.list_versions(db=db, workflow_id=workflow_id)
    return [WorkflowVersionResponse.model_validate(v) for v in versions]


@router.get("/{workflow_id}/versions/{version_num}", response_model=WorkflowVersionResponse)
def get_workflow_version(
    workflow_id: str,
    version_num: int,
    db: Session = Depends(get_db),
) -> WorkflowVersionResponse:
    """Retrieve a specific immutable historical version of a workflow."""
    version = WorkflowService.get_version(db=db, workflow_id=workflow_id, version_num=version_num)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "VERSION_NOT_FOUND",
                "message": f"Version '{version_num}' for workflow '{workflow_id}' was not found.",
            },
        )
    return WorkflowVersionResponse.model_validate(version)
