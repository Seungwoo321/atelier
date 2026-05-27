"""Roles roster.

Phase A: 9 department leads only.
Phase B: full 28-role catalog (see leads.py + specialists.py).
"""

from atelier.roles.base import Role
from atelier.roles.leads import (
    AnalyticsLead,
    BizDevLead,
    ChiefOfStaff,
    DesignLead,
    EngManager,
    MktLead,
    OpsLead,
    PMLead,
    QALead,
    build_leads,
)
from atelier.roles.specialists import build_specialists

__all__ = [
    "Role",
    "ChiefOfStaff",
    "BizDevLead",
    "PMLead",
    "DesignLead",
    "EngManager",
    "QALead",
    "MktLead",
    "OpsLead",
    "AnalyticsLead",
    "build_leads",
    "build_specialists",
]
