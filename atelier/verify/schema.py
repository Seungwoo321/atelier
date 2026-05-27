"""Stage 1: Pydantic schema validation."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ValidationError


def schema_validate(model: type[BaseModel], data: dict[str, Any]) -> tuple[bool, str | None]:
    try:
        model.model_validate(data)
    except ValidationError as e:
        return False, str(e)
    return True, None
