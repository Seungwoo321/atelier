"""Runtime configuration loaded from environment variables."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

LLMProviderName = Literal["sdk", "acp"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ATELIER_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    llm_provider: LLMProviderName = "sdk"
    acp_endpoint: str | None = None

    quota_cap: float = Field(default=0.20, ge=0.0, le=1.0)

    verify_enabled: bool = True
    judge_enabled: bool = False
    judge_threshold: float = Field(default=0.70, ge=0.0, le=1.0)
    reflexion_cap: int = Field(default=1, ge=0, le=3)
    specialist_debate_enabled: bool = False
    council_enabled: bool = False
    role_memory_enabled: bool = True
    role_memory_max_facts: int = Field(default=5, ge=0, le=20)

    artifacts_dir: Path = Path("./artifacts")
    inbox_dir: Path = Path("./inbox")
    runs_dir: Path = Path("./runs")

    log_level: str = "INFO"

    def ensure_dirs(self) -> None:
        for p in (self.artifacts_dir, self.inbox_dir, self.runs_dir):
            p.mkdir(parents=True, exist_ok=True)


def load_settings() -> Settings:
    return Settings()
