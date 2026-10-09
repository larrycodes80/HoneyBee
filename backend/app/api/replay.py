from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.replay import ReplayRequest
from app.schemas.run import RunDetailResponse, RunSchema
from app.schemas.trace_event import TraceEventSchema
from app.services.replay_service import replay_run

router = APIRouter(prefix="/api/runs", tags=["Replay"])


@router.post("/{run_id}/replay", response_model=RunDetailResponse, status_code=status.HTTP_201_CREATED)
def create_run_replay(
    run_id: str,
    body: ReplayRequest,
    db: Session = Depends(get_db),
) -> RunDetailResponse:
    """
    POST /api/runs/{run_id}/replay
    Parses ReplayRequest, delegates execution directly to replay_service,
    and returns RunDetailResponse matching API_CONTRACT.md.
    """
    run, events = replay_run(
        db=db,
        baseline_run_id=run_id,
        prompt=body.prompt,
        config_overrides=body.config_overrides,
    )
    return RunDetailResponse(
        run=RunSchema.model_validate(run),
        events=[TraceEventSchema.model_validate(e) for e in events],
    )
