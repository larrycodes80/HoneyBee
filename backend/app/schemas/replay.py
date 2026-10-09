from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.run import RunDetailResponse


class ReplayRequest(BaseModel):
    """
    Request payload for replaying a run matching API_CONTRACT.md section 3.5.
    Both prompt and config_overrides are optional.
    """
    prompt: Optional[str] = None
    config_overrides: Optional[dict[str, Any]] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


# Backward-compatible and contract-aligned aliases
ReplayRunRequest = ReplayRequest
ReplayRunResponse = RunDetailResponse
