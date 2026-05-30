"""Role Foundry — dynamic hiring of senior role specs."""

from atelier.roles.foundry.foundry import Foundry
from atelier.roles.foundry.seed import seed_role_specs
from atelier.roles.foundry.spec import (
    Citation,
    Framework,
    Requisition,
    RoleSpec,
    Rubric,
    WorkingStyle,
)

__all__ = [
    "Citation",
    "Foundry",
    "Framework",
    "Requisition",
    "RoleSpec",
    "Rubric",
    "WorkingStyle",
    "seed_role_specs",
]
