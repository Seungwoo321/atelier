"""QuotaGuard — subscription quota cap enforcement (Phase A: dry-run accounting).

Cost model is *quota fraction*, not USD (see 02-decisions.md#D10).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class QuotaGuard:
    cap: float                       # 0.0..1.0 of daily subscription quota
    used: float = 0.0                # accumulated fraction
    per_role: dict[str, float] = field(default_factory=dict)

    def remaining(self) -> float:
        return max(0.0, self.cap - self.used)

    def can_spend(self, amount: float) -> bool:
        return self.used + amount <= self.cap

    def charge(self, role: str, amount: float) -> None:
        if not self.can_spend(amount):
            raise QuotaExceeded(
                f"quota cap {self.cap:.2%} would be exceeded "
                f"(used={self.used:.2%}, +{amount:.2%})"
            )
        self.used += amount
        self.per_role[role] = self.per_role.get(role, 0.0) + amount


class QuotaExceeded(RuntimeError):
    pass
