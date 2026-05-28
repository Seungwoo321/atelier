import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

interface Role {
  dept: string;
  name: string;
  tier: "lead" | "specialist";
  mandate: string;
  tools: string[];
}

const LEADS: Role[] = [
  {
    dept: "Chief",
    name: "Chief of Staff",
    tier: "lead",
    mandate:
      "Orchestrate lifecycle progression across all 8 departments. Facilitate Cross-Dept Council. Surface G1~G5 gate cards to the human. Escalate blocked decisions.",
    tools: ["all read-only", "inbox", "gate-card-builder"],
  },
  {
    dept: "Strategy",
    name: "BizDev Lead",
    tier: "lead",
    mandate: "Decide market, business model, and partnership direction.",
    tools: ["Notion-MCP", "Crunchbase-MCP"],
  },
  {
    dept: "Product",
    name: "PM Lead",
    tier: "lead",
    mandate: "Own product priorities and roadmap.",
    tools: ["Linear-MCP", "Notion-MCP"],
  },
  {
    dept: "Design",
    name: "Design Lead",
    tier: "lead",
    mandate: "Direct visual and UX language; own the design system.",
    tools: ["Figma-MCP"],
  },
  {
    dept: "Engineering",
    name: "Eng Manager",
    tier: "lead",
    mandate:
      "Manage schedule, headcount, and risk. Pair with Tech Lead for tech decisions.",
    tools: ["Linear-MCP", "Calendar-MCP"],
  },
  {
    dept: "QA",
    name: "QA Lead",
    tier: "lead",
    mandate: "Own test strategy and quality gates.",
    tools: ["Linear-MCP"],
  },
  {
    dept: "Marketing",
    name: "Mkt Lead",
    tier: "lead",
    mandate: "Set messaging strategy and campaign direction.",
    tools: ["Notion-MCP", "Resend-MCP"],
  },
  {
    dept: "Operations",
    name: "Ops Lead",
    tier: "lead",
    mandate: "Own operational SOPs and support workflows.",
    tools: ["Notion-MCP"],
  },
  {
    dept: "Analytics",
    name: "Analytics Lead",
    tier: "lead",
    mandate: "Own measurement, KPIs, OKR tracking, and financial modeling.",
    tools: ["Posthog-MCP", "Sheets-MCP"],
  },
];

async function readSpecialists(): Promise<Role[]> {
  const repoRoot = path.resolve(process.cwd(), "..");
  const file = path.join(repoRoot, "atelier/roles/specialists.py");
  let text: string;
  try {
    text = await readFile(file, "utf-8");
  } catch {
    return [];
  }
  const re =
    /\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*\n?\s*"([^"]+)"\s*,\s*\[([^\]]*)\]\s*\)/g;
  const out: Role[] = [];
  for (const m of text.matchAll(re)) {
    const tools = m[4]
      .split(",")
      .map((t) => t.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    out.push({
      dept: m[1],
      name: m[2],
      tier: "specialist",
      mandate: m[3],
      tools,
    });
  }
  return out;
}

const DEPT_ORDER = [
  "Chief",
  "Strategy",
  "Product",
  "Design",
  "Engineering",
  "QA",
  "Marketing",
  "Operations",
  "Analytics",
];

const DEPT_ACCENT: Record<string, string> = {
  Chief: "border-purple-400/40 bg-purple-500/5",
  Strategy: "border-amber-400/40 bg-amber-500/5",
  Product: "border-emerald-400/40 bg-emerald-500/5",
  Design: "border-pink-400/40 bg-pink-500/5",
  Engineering: "border-sky-400/40 bg-sky-500/5",
  QA: "border-rose-400/40 bg-rose-500/5",
  Marketing: "border-orange-400/40 bg-orange-500/5",
  Operations: "border-teal-400/40 bg-teal-500/5",
  Analytics: "border-violet-400/40 bg-violet-500/5",
};

export default async function RosterPage() {
  const specialists = await readSpecialists();
  const all = [...LEADS, ...specialists];
  const byDept: Record<string, Role[]> = {};
  for (const r of all) {
    (byDept[r.dept] ??= []).push(r);
  }
  const total = all.length;
  const departments = Object.keys(byDept).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-purple-400">
            Org chart
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {total} roles across {departments} departments
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {LEADS.length} leads (Opus tier) · {specialists.length} specialists
            (Sonnet tier). Source of truth is{" "}
            <code className="rounded bg-neutral-900 px-1 py-0.5 text-xs">
              atelier/roles/specialists.py
            </code>
            .
          </p>
        </div>
        <Link href="/" className="text-sm text-neutral-400 hover:text-white">
          ← back
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DEPT_ORDER.filter((d) => byDept[d]).map((dept) => {
          const roles = byDept[dept];
          const leads = roles.filter((r) => r.tier === "lead");
          const specs = roles.filter((r) => r.tier === "specialist");
          return (
            <section
              key={dept}
              className={
                "rounded-xl border p-4 " +
                (DEPT_ACCENT[dept] ?? "border-neutral-800 bg-neutral-950")
              }
            >
              <header className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-200">
                  {dept}
                </h2>
                <span className="text-[10px] tabular-nums text-neutral-500">
                  {roles.length} role{roles.length === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="mt-3 space-y-2">
                {leads.map((r) => (
                  <li
                    key={r.name}
                    className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-neutral-100">
                        {r.name}
                      </div>
                      <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-purple-300 ring-1 ring-purple-400/30">
                        lead · Opus
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                      {r.mandate}
                    </p>
                    {r.tools.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.tools.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 ring-1 ring-neutral-800"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
                {specs.map((r) => (
                  <li
                    key={r.name}
                    className="rounded-lg border border-neutral-800/70 bg-neutral-900/40 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-neutral-200">
                        {r.name}
                      </div>
                      <span className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-[10px] text-neutral-400 ring-1 ring-neutral-700">
                        Sonnet
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-neutral-400">
                      {r.mandate}
                    </p>
                    {r.tools.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.tools.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-neutral-950 px-1 py-0.5 font-mono text-[9px] text-neutral-500 ring-1 ring-neutral-800"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
