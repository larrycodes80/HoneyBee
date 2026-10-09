from datetime import datetime
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class EvaluationVerdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    INCONCLUSIVE = "INCONCLUSIVE"


class FindingSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class FindingCategory(str, Enum):
    SAFETY_VIOLATION = "safety_violation"
    MISSING_OUTCOME = "missing_outcome"
    PREREQUISITE_VIOLATION = "prerequisite_violation"
    FORBIDDEN_ACTION = "forbidden_action"
    VALID_ALTERNATIVE = "valid_alternative"
    GENERAL = "general"


class EvaluationFinding(BaseModel):
    severity: FindingSeverity = FindingSeverity.MEDIUM
    category: FindingCategory = FindingCategory.GENERAL
    explanation: str
    expected_behavior: str
    observed_behavior: str
    evidence_event_ids: list[str] = Field(default_factory=list)
    recommended_correction: str


class EvaluateRequest(BaseModel):
    expected_workflow: Optional[str] = Field(
        default=None,
        description="Natural-language description of intended workflow constraints and conditional behavior.",
    )


class AuditRequest(BaseModel):
    expected_workflow: Optional[str] = Field(
        default=None,
        description="Natural-language description of intended workflow constraints.",
    )
    run_id: Optional[str] = Field(
        default=None,
        description="ID of an existing persisted run to audit.",
    )
    sample_trace_id: Optional[str] = Field(
        default=None,
        description="ID of a sample trace to evaluate when no persisted run is chosen.",
    )


class SampleTraceItem(BaseModel):
    id: str
    name: str
    description: str
    expected_workflow: str
    scenario: str
    event_count: int


class EvaluationResponse(BaseModel):
    id: str
    run_id: str
    created_at: datetime
    verdict: EvaluationVerdict
    status: str = "passed"  # "passed", "failed", "needs_review", "error"
    summary: str = ""
    expected_workflow: str
    first_divergence_event_id: Optional[str] = None
    expected_behavior: str
    observed_behavior: str
    evidence_event_ids: list[str] = Field(default_factory=list)
    reason: str
    suggested_correction: str
    limitations: Optional[str] = None
    evaluator_type: str = "hybrid_llm"
    findings: list[EvaluationFinding] = Field(default_factory=list)
    provider_metadata: Optional[dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)
