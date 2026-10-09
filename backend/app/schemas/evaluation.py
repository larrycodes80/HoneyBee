from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class EvaluationVerdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    INCONCLUSIVE = "INCONCLUSIVE"


class EvaluateRequest(BaseModel):
    expected_workflow: Optional[str] = Field(
        default=None,
        description="Natural-language description of intended workflow constraints and conditional behavior.",
    )


class EvaluationResponse(BaseModel):
    id: str
    run_id: str
    created_at: datetime
    verdict: EvaluationVerdict
    expected_workflow: str
    first_divergence_event_id: Optional[str] = None
    expected_behavior: str
    observed_behavior: str
    evidence_event_ids: list[str] = Field(default_factory=list)
    reason: str
    suggested_correction: str
    limitations: Optional[str] = None
    evaluator_type: str = "hybrid_llm"

    model_config = ConfigDict(from_attributes=True)
