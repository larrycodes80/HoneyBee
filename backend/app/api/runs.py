import uuid
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models.run import Run
from app.models.trace_event import TraceEvent
from app.models.evaluation import Evaluation
from app.schemas.run import (
    CreateRunRequest,
    RunDetailResponse,
    RunListResponse,
    RunSchema,
)
from app.schemas.trace_event import TraceEventSchema
from app.schemas.replay import ReplayRequest
from app.schemas.diff import DiffResponse
from app.schemas.assertions import AssertionResponse
from app.schemas.ingest import (
    InitRunRequest,
    IngestEventsRequest,
    FinalizeRunRequest,
    IngestRunPayload,
    IngestEventsResponse,
)
from app.schemas.evaluation import EvaluateRequest, EvaluationResponse
from app.services.trace_recorder import TraceRecorder
from app.services.agent_executor import AgentExecutor, is_safe_policy
from app.services.diff_engine import DiffEngine
from app.services.assertion_engine import AssertionEngine
from app.services.evaluator_engine import EvaluatorEngine

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
    policy_label = "safe_replay" if (body.prompt is not None and is_safe_policy(body.prompt)) else "unsafe_baseline"

    run = Run(
        id=run_id,
        status="running",
        baseline_run_id=None,
        expected_workflow=body.expected_workflow,
        config={
            "scenario": body.scenario,
            "prompt": effective_prompt,
            "policy": policy_label,
            "expected_workflow": body.expected_workflow,
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
            policy=policy_label,
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


@router.post("/init", response_model=RunDetailResponse, status_code=status.HTTP_201_CREATED)
def init_run(
    body: InitRunRequest,
    db: Session = Depends(get_db),
) -> RunDetailResponse:
    run_id = body.run_id or f"run_{uuid.uuid4().hex[:8]}"

    existing = db.query(Run).filter(Run.id == run_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RUN_ALREADY_EXISTS",
                "message": f"Run with ID '{run_id}' already exists.",
            },
        )

    config = {
        "scenario": body.scenario or "custom_agent",
        "prompt": body.prompt or "",
        **(body.config or {}),
    }
    if body.workflow_id:
        config["workflow_id"] = body.workflow_id
    if body.workflow_version:
        config["workflow_version"] = body.workflow_version

    run = Run(
        id=run_id,
        status="running",
        baseline_run_id=None,
        config=config,
        summary={
            "event_count": 0,
            "tool_call_count": 0,
            "error_count": 0,
        },
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return RunDetailResponse(
        run=RunSchema.model_validate(run),
        events=[],
    )


@router.post("/ingest", response_model=RunDetailResponse, status_code=status.HTTP_201_CREATED)
def ingest_run(
    body: IngestRunPayload,
    db: Session = Depends(get_db),
) -> RunDetailResponse:
    run_id = body.run_id or f"run_{uuid.uuid4().hex[:8]}"
    existing = db.query(Run).filter(Run.id == run_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RUN_ALREADY_EXISTS",
                "message": f"Run with ID '{run_id}' already exists.",
            },
        )

    config = {
        "scenario": body.scenario or "custom_agent",
        **(body.config or {}),
    }
    if body.workflow_id:
        config["workflow_id"] = body.workflow_id
    if body.workflow_version:
        config["workflow_version"] = body.workflow_version

    run = Run(
        id=run_id,
        status=body.status,
        baseline_run_id=None,
        config=config,
        summary={
            "event_count": 0,
            "tool_call_count": 0,
            "error_count": 0,
        },
    )
    db.add(run)
    db.flush()

    recorder = TraceRecorder(db=db, run=run)
    for evt_data in body.events:
        recorder.record_event(
            type=evt_data.type,
            name=evt_data.name,
            input=evt_data.input if isinstance(evt_data.input, dict) else ({"value": evt_data.input} if evt_data.input is not None else None),
            output=evt_data.output,
            metadata=evt_data.metadata,
            timestamp=evt_data.timestamp,
        )

    db.commit()
    db.refresh(run)

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


@router.post("/{run_id}/replay", response_model=RunDetailResponse, status_code=status.HTTP_201_CREATED)
def replay_run(
    run_id: str,
    body: ReplayRequest,
    db: Session = Depends(get_db),
) -> RunDetailResponse:
    # 1. Load baseline run; verify existence
    baseline_run = db.query(Run).filter(Run.id == run_id).first()
    if not baseline_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RUN_NOT_FOUND",
                "message": f"Baseline run '{run_id}' was not found.",
            },
        )

    # 2. Derive replay configuration while leaving baseline immutable
    scenario = baseline_run.config.get("scenario", "refund_safety")
    if body.prompt is not None:
        effective_prompt = body.prompt
        policy_label = "safe_replay" if is_safe_policy(effective_prompt) else "unsafe_baseline"
    else:
        effective_prompt = baseline_run.config.get("prompt", "Check fraud status before issuing a refund.")
        policy_label = baseline_run.config.get("policy", "unsafe_baseline")

    effective_expected_workflow = body.expected_workflow or baseline_run.expected_workflow
    replay_config = {
        **baseline_run.config,
        "scenario": scenario,
        "prompt": effective_prompt,
        "policy": policy_label,
        "expected_workflow": effective_expected_workflow,
        **(body.config_overrides or {}),
    }

    # 3. Create new replay run linked to baseline
    replay_id = f"run_{uuid.uuid4().hex[:8]}"
    replay_run = Run(
        id=replay_id,
        status="running",
        baseline_run_id=baseline_run.id,
        expected_workflow=effective_expected_workflow,
        config=replay_config,
        summary={
            "event_count": 0,
            "tool_call_count": 0,
            "error_count": 0,
        },
    )
    db.add(replay_run)
    db.commit()
    db.refresh(replay_run)

    # 4. Re-execute scenario using TraceRecorder
    recorder = TraceRecorder(db=db, run=replay_run)
    try:
        AgentExecutor.execute_scenario(
            scenario=scenario,
            recorder=recorder,
            prompt=effective_prompt,
            policy=policy_label,
        )
        replay_run.status = "completed"
    except Exception as exc:
        replay_run.status = "failed"
        recorder.record_event(
            type="error",
            name="replay_execution_error",
            input={"message": str(exc)},
            output=None,
            metadata={"source": "replay_engine"},
        )
        db.commit()
        db.refresh(replay_run)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "REPLAY_EXECUTION_ERROR",
                "message": f"Replay execution failed: {exc}",
            },
        )

    db.commit()
    db.refresh(replay_run)

    events = recorder.get_events()
    return RunDetailResponse(
        run=RunSchema.model_validate(replay_run),
        events=[TraceEventSchema.model_validate(e) for e in events],
    )


@router.post("/{run_id}/events", response_model=IngestEventsResponse)
def ingest_events(
    run_id: str,
    body: IngestEventsRequest,
    db: Session = Depends(get_db),
) -> IngestEventsResponse:
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RUN_NOT_FOUND",
                "message": f"Run '{run_id}' was not found.",
            },
        )

    if not body.events:
        return IngestEventsResponse(status="ok", run_id=run_id, ingested_count=0)

    recorder = TraceRecorder(db=db, run=run)
    count = 0
    for evt_data in body.events:
        recorder.record_event(
            type=evt_data.type,
            name=evt_data.name,
            input=evt_data.input if isinstance(evt_data.input, dict) else ({"value": evt_data.input} if evt_data.input is not None else None),
            output=evt_data.output,
            metadata=evt_data.metadata,
            timestamp=evt_data.timestamp,
        )
        count += 1

    db.commit()
    return IngestEventsResponse(status="ok", run_id=run_id, ingested_count=count)


@router.post("/{run_id}/finalize", response_model=RunDetailResponse)
def finalize_run(
    run_id: str,
    body: FinalizeRunRequest,
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

    run.status = body.status
    if body.summary:
        current_summary = dict(run.summary or {})
        current_summary.update(body.summary)
        run.summary = current_summary

    db.commit()
    db.refresh(run)

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


@router.get("/{baseline_run_id}/diff/{replay_run_id}", response_model=DiffResponse)
def get_run_diff(
    baseline_run_id: str,
    replay_run_id: str,
    db: Session = Depends(get_db),
) -> DiffResponse:
    # 1. Verify existence of both runs
    baseline_run = db.query(Run).filter(Run.id == baseline_run_id).first()
    if not baseline_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RUN_NOT_FOUND",
                "message": f"Baseline run '{baseline_run_id}' was not found.",
            },
        )

    replay_run = db.query(Run).filter(Run.id == replay_run_id).first()
    if not replay_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RUN_NOT_FOUND",
                "message": f"Replay run '{replay_run_id}' was not found.",
            },
        )

    # 2. Fetch ordered events
    base_events = (
        db.query(TraceEvent)
        .filter(TraceEvent.run_id == baseline_run_id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )
    rep_events = (
        db.query(TraceEvent)
        .filter(TraceEvent.run_id == replay_run_id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )

    # 3. Compute trace diff
    return DiffEngine.compute_diff(
        baseline_events=base_events,
        replay_events=rep_events,
        baseline_run_id=baseline_run_id,
        replay_run_id=replay_run_id,
    )


@router.get("/{run_id}/assertions", response_model=AssertionResponse)
def get_run_assertions(
    run_id: str,
    db: Session = Depends(get_db),
) -> AssertionResponse:
    # 1. Verify run exists
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RUN_NOT_FOUND",
                "message": f"Run '{run_id}' was not found.",
            },
        )

    # 2. Fetch ordered events
    events = (
        db.query(TraceEvent)
        .filter(TraceEvent.run_id == run_id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )

    # 3. Evaluate behavioral assertions
    return AssertionEngine.evaluate_assertions(events=events, run_id=run_id)


@router.post("/{run_id}/evaluate", response_model=EvaluationResponse)
def evaluate_run_intent(
    run_id: str,
    body: Optional[EvaluateRequest] = None,
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    """
    Phase 3: Intent-Based Evaluation Engine.
    Compares the developer's expected workflow against the persisted execution trace.
    Returns verdict (PASS, FAIL, INCONCLUSIVE), earliest divergence, evidence event IDs,
    explanation, and suggested correction.
    """
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

    override_workflow = body.expected_workflow if body else None
    return EvaluatorEngine.evaluate_run(
        db=db,
        run=run,
        events=events,
        expected_workflow_override=override_workflow,
    )


@router.get("/{run_id}/evaluation", response_model=EvaluationResponse)
def get_run_evaluation(
    run_id: str,
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    """
    Retrieve the latest persisted evaluation result for a run.
    If run has not been evaluated yet, performs evaluation on demand.
    """
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RUN_NOT_FOUND",
                "message": f"Run '{run_id}' was not found.",
            },
        )

    existing_eval = (
        db.query(Evaluation)
        .filter(Evaluation.run_id == run_id)
        .order_by(Evaluation.created_at.desc())
        .first()
    )

    if existing_eval:
        return EvaluationResponse.model_validate(existing_eval)

    # If no evaluation exists yet, run evaluation on demand
    events = (
        db.query(TraceEvent)
        .filter(TraceEvent.run_id == run_id)
        .order_by(TraceEvent.sequence.asc())
        .all()
    )

    return EvaluatorEngine.evaluate_run(
        db=db,
        run=run,
        events=events,
        expected_workflow_override=None,
    )
