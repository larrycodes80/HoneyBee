from datetime import datetime
from typing import Optional, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator

TraceEventType = Literal[
    "agent_start",
    "model_input",
    "model_output",
    "tool_call",
    "tool_result",
    "error",
    "agent_end",
]


class TraceEventSchema(BaseModel):
    id: str
    run_id: str
    sequence: int
    type: str
    timestamp: datetime
    name: str
    input: Optional[dict[str, Any]] = None
    output: Optional[Any] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    @model_validator(mode="before")
    @classmethod
    def resolve_orm_attributes(cls, data: Any) -> Any:
        if hasattr(data, "event_metadata"):
            return {
                "id": data.id,
                "run_id": data.run_id,
                "sequence": data.sequence,
                "type": data.type,
                "timestamp": data.timestamp,
                "name": data.name,
                "input": data.input,
                "output": data.output,
                "metadata": data.event_metadata or {},
            }
        return data
