from typing import Optional, Any
from pydantic import BaseModel, Field


class ReplayRequest(BaseModel):
    prompt: Optional[str] = None
    config_overrides: Optional[dict[str, Any]] = Field(default_factory=dict)
