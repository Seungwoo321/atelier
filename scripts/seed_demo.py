"""Seed a sample run so the web dashboard and office event log have content.

Writes:
  artifacts/atelier-demo/result.json — combined gate outputs
  artifacts/atelier-demo/{charter,plan,design,review,launch}.json — per-gate
  runs/events.jsonl — synthetic event sequence covering G1→G5
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

from atelier.artifacts import (
    CodeReview,
    DesignMemo,
    LaunchMemo,
    Plan,
    ProductCharter,
)

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "artifacts/atelier-demo"
RUNS = ROOT / "runs"


def main() -> None:
    ART.mkdir(parents=True, exist_ok=True)
    RUNS.mkdir(parents=True, exist_ok=True)

    charter = ProductCharter(
        title="Atelier weekly retrospective for tech leads",
        one_liner=(
            "A 5-minute Friday digest that turns each lead's commits, PRs, "
            "and incidents into a shareable narrative."
        ),
        problem="Tech leads burn an hour every Friday assembling status updates by hand.",
        target_user="Engineering managers and staff engineers running 4–12 person teams.",
        success_metrics=[
            "Adoption: 60% of pilot leads sending the digest weekly",
            "Time saved: median ≥ 35 min/week vs. baseline",
            "Quality: digest open-rate ≥ 55% among directs",
        ],
        non_goals=["Replacing 1:1s", "Performance review automation"],
        constraints=["No raw PII in the digest", "Dry-run external sends until v1.1"],
    )

    plan = Plan(
        title="Atelier retrospective — 6-week plan",
        milestones=[
            "W1: Wire git + Linear pulls, draft digest skeleton",
            "W2: Markdown rendering + Slack preview",
            "W3: Pilot with 3 internal leads",
            "W4: Iterate based on pilot feedback",
            "W5: Public beta behind feature flag",
            "W6: GA with opt-in email/Slack delivery",
        ],
        risks=[
            "Linear API rate limits during weekly batch",
            "PII leakage in commit messages",
        ],
        owners={
            "Strategy": "BizDev Lead",
            "Product": "PM Lead",
            "Engineering": "Eng Manager",
            "Design": "Design Lead",
            "QA": "QA Lead",
            "Marketing": "Mkt Lead",
        },
    )

    design = DesignMemo(
        feature="Weekly retrospective digest",
        information_architecture=[
            "Header: lead name + week label",
            "Wins: 3 bullets pulled from merged PRs",
            "Risks: 2 bullets from open incidents",
            "Next: planned bets and capacity notes",
            "Footer: opt-out + privacy link",
        ],
        wireframe_notes=(
            "Stack vertical on mobile, two-column wins/risks on ≥ md. "
            "Hero card uses the office accent (amber on neutral-950). "
            "Avoid more than 280 chars per bullet."
        ),
        tokens={
            "accent": "amber-300",
            "danger": "rose-300",
            "muted": "neutral-400",
        },
    )

    review = CodeReview(
        feature="Weekly retrospective digest",
        summary=(
            "Skeleton + 3 collectors (git, Linear, PagerDuty) merged. "
            "Critic stage clean; Judge scored 8.6 against Engineering rubric."
        ),
        passed_checks=[
            "schema: 100% artifacts type-clean",
            "critic: no hallucinated commit refs",
            "judge: rubric ≥ 8.0",
            "guardrails: 0 PII hits",
        ],
        outstanding_risks=[
            "Slack delivery still dry-run; needs human approval gate",
        ],
    )

    launch = LaunchMemo(
        feature="Weekly retrospective digest",
        channels=["internal Slack #eng-leads", "opt-in email digest"],
        success_metrics=[
            "≥ 60% weekly active pilot leads by week 4",
            "≥ 35 min/week time saved (self-reported)",
        ],
        dry_run=True,
    )

    (ART / "charter.json").write_text(charter.model_dump_json(indent=2))
    (ART / "plan.json").write_text(plan.model_dump_json(indent=2))
    (ART / "design.json").write_text(design.model_dump_json(indent=2))
    (ART / "review.json").write_text(review.model_dump_json(indent=2))
    (ART / "launch.json").write_text(launch.model_dump_json(indent=2))

    result = {
        "project": "atelier-demo",
        "current_gate": "G5",
        "charter": charter.model_dump(),
        "plan": plan.model_dump(),
        "design": design.model_dump(),
        "review": review.model_dump(),
        "launch": launch.model_dump(),
        "notes": [
            "All 5 gates passed with judge ≥ 8.0",
            "External publish remains dry-run pending human approval",
        ],
    }
    (ART / "result.json").write_text(json.dumps(result, indent=2))

    events = [
        ("run.start", {"project": "atelier-demo"}),
        ("quota.charge", {"dept": "Chief", "frac": 0.012}),
        ("g1.charter.draft", {"dept": "Chief", "role": "Chief of Staff"}),
        ("g1.charter.approve", {"dept": "Chief"}),
        ("quota.charge", {"dept": "Strategy", "frac": 0.018}),
        ("g2.plan.draft", {"dept": "Strategy", "role": "BizDev Lead"}),
        ("g2.plan.review", {"dept": "Product", "role": "PM Lead"}),
        ("quota.charge", {"dept": "Design", "frac": 0.021}),
        ("g3.design.draft", {"dept": "Design", "role": "Design Lead"}),
        ("g3.design.critic", {"dept": "QA"}),
        ("quota.charge", {"dept": "Engineering", "frac": 0.034}),
        ("g4.review.pass", {"dept": "Engineering", "role": "Eng Manager"}),
        ("g4.review.judge", {"dept": "QA", "score": 8.6}),
        ("quota.charge", {"dept": "Marketing", "frac": 0.015}),
        ("g5.launch.dryrun", {"dept": "Marketing", "role": "Mkt Lead"}),
        ("run.done", {"project": "atelier-demo", "gate": "G5"}),
    ]
    base = datetime.now() - timedelta(minutes=len(events))
    with (RUNS / "events.jsonl").open("w", encoding="utf-8") as f:
        for i, (event, fields) in enumerate(events):
            record = {
                "ts": (base + timedelta(seconds=i * 35)).isoformat(timespec="seconds"),
                "event": event,
                **fields,
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"wrote {ART.relative_to(ROOT)}/ and {RUNS.relative_to(ROOT)}/events.jsonl")


if __name__ == "__main__":
    main()
