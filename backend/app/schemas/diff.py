from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.trace_event import TraceEventSchema


class DiffChangeSchema(BaseModel):
    sequence: int
    change_type: Literal["added", "removed", "changed"]
    baseline_event: Optional[TraceEventSchema] = None
    replay_event: Optional[TraceEventSchema] = None

    model_config = ConfigDict(from_attributes=True)


class DiffSummarySchema(BaseModel):
    added: int = 0
    removed: int = 0
    changed: int = 0

    model_config = ConfigDict(from_attributes=True)


class DiffResponse(BaseModel):
    baseline_run_id: str
    replay_run_id: str
    first_divergence_sequence: Optional[int] = None
    changes: list[DiffChangeSchema] = Field(default_factory=list)
    summary: DiffSummarySchema = Field(default_factory=DiffSummarySchema)

    model_config = ConfigDict(from_attributes=True)
