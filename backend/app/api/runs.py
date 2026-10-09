import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models.run import Run
from app.models.trace_event import TraceEvent
from app.schemas.run import (
    CreateRunRequest,
    RunDetailResponse,
    RunListResponse,
    RunSchema,
)
from app.schemas.trace_event import TraceEventSchema
from app.services.trace_recorder import TraceRecorder
from app.services.agent_executor import AgentExecutor

router = APIRouter(prefix="/api/runs", tags=["Runs"])


@router.post("", response_model=RunDetailResponse, status_code=status.HTTP_201_CREATED)
def create_run(
    body: CreateRunRequest,
    db: Session = Depends(get_db),
) -> RunDetailResponse:
    # 1. Validate scenario
    if body.scenario not in AgentExecutor.SUPPORTED_SCENARIOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_SCENARIO",
                "message": f"Scenario '{body.scenario}' is not supported. Supported: {list(AgentExecutor.SUPPORTED_SCENARIOS)}",
            },
        )

    # 2. Create and persist Run with 'running' status
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    default_prompt = "Check fraud status before issuing a refund."
    effective_prompt = body.prompt if body.prompt is not None else default_prompt

    run = Run(
        id=run_id,
        status="running",
        baseline_run_id=None,
        config={
            "scenario": body.scenario,
            "prompt": effective_prompt,
        },
        summary={
            "event_count": 0,
            "tool_call_count": 0,
            "error_count": 0,
        },
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # 3. Execute scenario and record events
    recorder = TraceRecorder(db=db, run=run)
    try:
        AgentExecutor.execute_scenario(
            scenario=body.scenario,
            recorder=recorder,
            prompt=body.prompt,
        )
        run.status = "completed"
    except Exception as exc:
        run.status = "failed"
        recorder.record_event(
            type="error",
            name="execution_error",
            input={"message": str(exc)},
            output=None,
            metadata={"source": "agent_executor"},
        )
        db.commit()
        db.refresh(run)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "EXECUTION_ERROR",
                "message": f"Execution failed: {exc}",
            },
        )

    db.commit()
    db.refresh(run)

    events = recorder.get_events()
    return RunDetailResponse(
        run=RunSchema.model_validate(run),
        events=[TraceEventSchema.model_validate(e) for e in events],
    )


@router.get("", response_model=RunListResponse)
def list_runs(
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    db: Session = Depends(get_db),
) -> RunListResponse:
    total = db.query(func.count(Run.id)).scalar() or 0
    runs = (
        db.query(Run)
        .order_by(Run.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return RunListResponse(
        items=[RunSchema.model_validate(r) for r in runs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{run_id}", response_model=RunDetailResponse)
def get_run(
    run_id: str,
    db: Session = Depends(get_db),
) -> RunDetailResponse:
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RUN_NOT_FOUND",
                "message": f"Run '{run_id}' was not found.",
            },
        )

    events = (
        db.query(TraceEvent)
        .filter(TraceEvent.run_id == run_id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )

    return RunDetailResponse(
        run=RunSchema.model_validate(run),
        events=[TraceEventSchema.model_validate(e) for e in events],
    )
