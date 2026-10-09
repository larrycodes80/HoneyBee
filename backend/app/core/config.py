from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = Field(default="sqlite:///./honeybee.db", alias="DATABASE_URL")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ORIGINS",
    )
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    evaluator_provider: str = Field(default="auto", alias="EVALUATOR_PROVIDER")
    evaluator_model: str = Field(default="gpt-4o-mini", alias="EVALUATOR_MODEL")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_base_url: str | None = Field(default=None, alias="OPENAI_BASE_URL")

    # DigitalOcean Gemma inference settings
    honeybee_llm_provider: str = Field(default="fake", alias="HONEYBEE_LLM_PROVIDER")
    digitalocean_inference_api_key: str | None = Field(default=None, alias="DIGITALOCEAN_INFERENCE_API_KEY")
    digitalocean_token: str | None = Field(default=None, alias="DIGITALOCEAN_TOKEN")
    digitalocean_inference_base_url: str = Field(
        default="https://inference.do-ai.run",
        alias="DIGITALOCEAN_INFERENCE_BASE_URL",
    )
    digitalocean_inference_model: str = Field(
        default="gemma-4-it",
        alias="DIGITALOCEAN_INFERENCE_MODEL",
    )
    digitalocean_inference_timeout_seconds: int = Field(
        default=60,
        alias="DIGITALOCEAN_INFERENCE_TIMEOUT_SECONDS",
    )

    @property
    def effective_digitalocean_key(self) -> str | None:
        key = self.digitalocean_inference_api_key or self.digitalocean_token
        if key and key.strip() and key.strip() != "your_digitalocean_token_here":
            return key.strip()
        return None

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
