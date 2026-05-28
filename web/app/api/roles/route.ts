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
  const re = /\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*\n?\s*"([^"]+)"\s*,\s*\[([^\]]*)\]\s*\)/g;
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

export async function GET() {
  const specialists = await readSpecialists();
  const roles = [...LEADS, ...specialists];
  const byDept: Record<string, Role[]> = {};
  for (const r of roles) {
    (byDept[r.dept] ??= []).push(r);
  }
  return Response.json({
    total: roles.length,
    leads: LEADS.length,
    specialists: specialists.length,
    departments: Object.keys(byDept).length,
    roles,
    byDept,
  });
}
