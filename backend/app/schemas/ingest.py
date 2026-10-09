from datetime import datetime
from typing import Optional, Any, Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.trace_event import TraceEventType


class InitRunRequest(BaseModel):
    run_id: Optional[str] = None
    workflow_id: Optional[str] = None
    workflow_version: Optional[str] = None
    scenario: Optional[str] = "custom_agent"
    prompt: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class TraceEventIngestSchema(BaseModel):
    id: Optional[str] = None
    sequence: Optional[int] = None
    type: TraceEventType
    timestamp: Optional[datetime] = None
    name: str = Field(..., max_length=128)
    input: Optional[Any] = None
    output: Optional[Any] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class IngestEventsRequest(BaseModel):
    events: list[TraceEventIngestSchema] = Field(..., max_length=1000)

    model_config = ConfigDict(from_attributes=True)


class FinalizeRunRequest(BaseModel):
    status: Literal["completed", "failed"] = "completed"
    error: Optional[str] = None
    summary: Optional[dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class IngestRunPayload(BaseModel):
    run_id: Optional[str] = None
    workflow_id: Optional[str] = None
    workflow_version: Optional[str] = None
    scenario: Optional[str] = "custom_agent"
    status: Literal["completed", "failed"] = "completed"
    config: dict[str, Any] = Field(default_factory=dict)
    events: list[TraceEventIngestSchema] = Field(default_factory=list, max_length=5000)

    model_config = ConfigDict(from_attributes=True)


class IngestEventsResponse(BaseModel):
    status: str = "ok"
    run_id: str
    ingested_count: int

    model_config = ConfigDict(from_attributes=True)
