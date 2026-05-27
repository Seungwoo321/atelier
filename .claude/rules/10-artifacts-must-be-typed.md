# Rule: Every gate output is a typed Pydantic v2 model

Every gate (G1–G5) writes a Pydantic model into `CompanyState`. The 4-stage
verification depends on this:

1. **Schema** stage validates the artifact dict against the model.
2. **Critic** stage runs deterministic checks on the rendered text.
3. **Judge** stage scores against department-specific rubrics.
4. **Guardrails** stage scans for PII/secrets.

When adding or modifying a gate:

- Define or update the Pydantic model in `atelier/artifacts/`.
- Use `Field(min_length=...)` for required collections.
- Make field constraints explicit; do not rely on string `validator=` magic.
- Export the model from `atelier/artifacts/__init__.py`.

Do not introduce free-form `dict[str, Any]` artifacts at gate boundaries.
