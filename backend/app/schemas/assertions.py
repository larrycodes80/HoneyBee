from pydantic import BaseModel, Field, ConfigDict


class AssertionResultSchema(BaseModel):
    name: str
    passed: bool
    message: str

    model_config = ConfigDict(from_attributes=True)


class AssertionResponse(BaseModel):
    run_id: str
    results: list[AssertionResultSchema] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
