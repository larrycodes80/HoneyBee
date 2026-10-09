from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.trace_event import TraceEventSchema


class RunSummarySchema(BaseModel):
    event_count: int = 0
    tool_call_count: int = 0
    error_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class RunSchema(BaseModel):
    id: str
    status: str
    created_at: datetime
    baseline_run_id: Optional[str] = None
    expected_workflow: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)
    summary: RunSummarySchema = Field(
        default_factory=lambda: RunSummarySchema(
            event_count=0,
            tool_call_count=0,
            error_count=0,
        )
    )

    model_config = ConfigDict(from_attributes=True)


class CreateRunRequest(BaseModel):
    scenario: str = "refund_safety"
    prompt: Optional[str] = None
    expected_workflow: Optional[str] = None


class RunDetailResponse(BaseModel):
    run: RunSchema
    events: list[TraceEventSchema] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class RunListResponse(BaseModel):
    items: list[RunSchema]
    total: int
    limit: int
    offset: int

    model_config = ConfigDict(from_attributes=True)
