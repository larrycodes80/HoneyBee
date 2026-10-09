from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any, Literal

TraceEventType = Literal[
    "agent_start",
    "model_input",
    "model_output",
    "tool_call",
    "tool_result",
    "error",
    "agent_end",
]


@dataclass
class TraceEvent:
    type: str
    name: str
    id: Optional[str] = None
    sequence: Optional[int] = None
    timestamp: Optional[datetime] = None
    input: Optional[Any] = None
    output: Optional[Any] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Run:
    id: str
    status: str
    workflow_id: Optional[str] = None
    workflow_version: Optional[str] = None
    config: dict[str, Any] = field(default_factory=dict)
    summary: dict[str, Any] = field(default_factory=dict)
    events: list[TraceEvent] = field(default_factory=list)
