# Rule: Cost model is subscription quota, not USD

`QuotaGuard` (in `atelier/budget.py`) accounts spend as a fraction of the
user's daily Claude subscription quota. The default cap is 20%
(`ATELIER_QUOTA_CAP=0.20`).

Do not introduce dollar-per-token estimators, OpenAI-style usage math, or
hard token caps. Per-role accounting goes through `QuotaGuard.charge(role, frac)`.

When a department appears to be drifting above its share of the cap, log it
via `observability.tracer.trace_event("quota.drift", ...)`. Do not auto-kill;
let the Chief of Staff decide.
