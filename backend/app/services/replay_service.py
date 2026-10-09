import copy
import uuid
from typing import Optional, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.run import Run
from app.models.trace_event import TraceEvent
from app.services.agent_executor import AgentExecutor, is_safe_policy
from app.services.trace_recorder import TraceRecorder


def replay_run(
    db: Session,
    baseline_run_id: str,
    prompt: Optional[str] = None,
    config_overrides: Optional[dict[str, Any]] = None,
) -> tuple[Run, list[TraceEvent]]:
    """
    Executes a replay of an existing baseline run with optional prompt and config overrides.

    Preserves baseline immutability:
    - Never modifies the baseline run or its events.
    - Deep-copies baseline config and applies overrides.
    - Preserves baseline scenario.
    - Creates a new Run with baseline_run_id linked to the baseline run.
    - Records events under the new replay run ID via TraceRecorder and AgentExecutor.
    - Returns the new Run and its ordered TraceEvent objects.
    """
    # 1. Load baseline run
    baseline_run = db.query(Run).filter(Run.id == baseline_run_id).first()
    if not baseline_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RUN_NOT_FOUND",
                "message": f"Run '{baseline_run_id}' was not found.",
            },
        )

    # 2. Deep-copy baseline configuration
    replay_config = copy.deepcopy(baseline_run.config) if baseline_run.config else {}

    # 3. Apply safe config overrides
    safe_overrides = copy.deepcopy(config_overrides) if config_overrides else {}
    for key, value in safe_overrides.items():
        if key != "scenario":  # Preserve baseline scenario
            replay_config[key] = value

    # 4. Apply prompt override if supplied; fallback to config_overrides prompt or baseline prompt
    if prompt is not None:
        effective_prompt = prompt
        policy_label = "safe_replay" if is_safe_policy(effective_prompt) else "unsafe_baseline"
    else:
        effective_prompt = safe_overrides.get("prompt") or baseline_run.config.get("prompt")
        policy_label = safe_overrides.get("policy") or baseline_run.config.get("policy", "unsafe_baseline")

    replay_config["prompt"] = effective_prompt
    replay_config["policy"] = policy_label

    # 5. Guarantee baseline scenario is preserved
    scenario = baseline_run.config.get("scenario", "refund_safety") if baseline_run.config else "refund_safety"
    replay_config["scenario"] = scenario

    # 6. Create new replay run
    replay_run_id = f"run_{uuid.uuid4().hex[:8]}"
    new_run = Run(
        id=replay_run_id,
        status="running",
        baseline_run_id=baseline_run.id,
        config=replay_config,
        summary={
            "event_count": 0,
            "tool_call_count": 0,
            "error_count": 0,
        },
    )
    db.add(new_run)
    db.commit()
    db.refresh(new_run)

    # 7. Initialize recorder for the new run
    recorder = TraceRecorder(db=db, run=new_run)

    # 8. Execute scenario
    try:
        AgentExecutor.execute_scenario(
            scenario=scenario,
            recorder=recorder,
            prompt=effective_prompt,
            policy=policy_label,
        )
        new_run.status = "completed"
    except Exception as exc:
        new_run.status = "failed"
        recorder.record_event(
            type="error",
            name="execution_error",
            input={"message": str(exc)},
            output=None,
            metadata={"source": "agent_executor"},
        )
        db.commit()
        db.refresh(new_run)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "EXECUTION_ERROR",
                "message": f"Execution failed: {exc}",
            },
        )

    db.commit()
    db.refresh(new_run)

    # 9. Return the replay run and its ordered events
    return new_run, recorder.get_events()
