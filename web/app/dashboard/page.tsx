import Link from "next/link";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ActiveRunsPanel } from "./ActiveRunsPanel";
import { AutoRefresh } from "./AutoRefresh";
import { InboxPanel } from "./InboxPanel";

export const dynamic = "force-dynamic";

interface Charter {
  title?: string;
  one_liner?: string;
  problem?: string;
  target_user?: string;
  success_metrics?: string[];
  non_goals?: string[];
}
interface Plan {
  title?: string;
  milestones?: string[];
  risks?: string[];
  owners?: Record<string, string>;
}
interface Design {
  feature?: string;
  information_architecture?: string[];
  wireframe_notes?: string;
}
interface Review {
  summary?: string;
  passed_checks?: string[];
  outstanding_risks?: string[];
}
interface Launch {
  feature?: string;
  channels?: string[];
  success_metrics?: string[];
  dry_run?: boolean;
}
interface Council {
  decision?: string;
  rationale?: string;
  votes?: Record<string, string>;
  deciding_vote_used?: boolean;
}
interface Result {
  current_gate?: string;
  charter?: Charter;
  plan?: Plan;
  design?: Design;
  review?: Review;
  launch?: Launch;
  council?: Council;
  notes?: string[];
}
interface EventRow {
  ts: string;
  event: string;
  dept?: string;
  frac?: number;
  score?: number;
  scores?: Record<string, number>;
  gate?: string;
  project?: string;
  stage?: string;
  issues?: string[];
  attempt?: number;
  attempts?: number;
  voter?: string;
  choice?: string;
  decision?: string;
  rationale?: string;
  votes?: Record<string, string>;
  deciding_vote_used?: boolean;
  role?: string;
  origin?: string;
  seniority?: string;
  lead?: string;
}

async function loadResults(): Promise<Array<{ project: string; data: Result }>> {
  const root = process.env.ATELIER_ARTIFACTS_DIR
    ? path.resolve(process.env.ATELIER_ARTIFACTS_DIR)
    : path.resolve(process.cwd(), "..", "artifacts");
  try {
    const projects = await readdir(root);
    const out: Array<{ project: string; data: Result }> = [];
    for (const p of projects) {
      try {
        const text = await readFile(path.join(root, p, "result.json"), "utf-8");
        out.push({ project: p, data: JSON.parse(text) as Result });
      } catch {
        /* skip */
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function loadEvents(): Promise<EventRow[]> {
  const runs = process.env.ATELIER_RUNS_DIR
    ? path.resolve(process.env.ATELIER_RUNS_DIR)
    : path.resolve(process.cwd(), "..", "runs");
  try {
    const text = await readFile(path.join(runs, "events.jsonl"), "utf-8");
    return text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as EventRow);
  } catch {
    return [];
  }
}

const GATES = [
  { id: "G1", label: "Charter" },
  { id: "G2", label: "Plan" },
  { id: "G3", label: "Design" },
  { id: "G4", label: "Build" },
  { id: "G5", label: "Launch" },
] as const;

function gatePassed(data: Result, gate: string): boolean {
  const cg = data.current_gate ?? "G0";
  return cg.localeCompare(gate) >= 0;
}

function quotaTotal(events: EventRow[]): number {
  return events.reduce((s, e) => s + (typeof e.frac === "number" ? e.frac : 0), 0);
}

function quotaByDept(events: EventRow[]): Array<{ dept: string; frac: number }> {
  const by: Record<string, number> = {};
  for (const e of events) {
    if (typeof e.frac === "number" && typeof e.dept === "string") {
      by[e.dept] = (by[e.dept] ?? 0) + e.frac;
    }
  }
  return Object.entries(by)
    .map(([dept, frac]) => ({ dept, frac }))
    .sort((a, b) => b.frac - a.frac);
}

interface VerifyState {
  passed: boolean;
  stage: string;
  issues: string[];
}

interface ReflexionStat {
  attempts: number;
  recovered: boolean;
  exhausted: boolean;
}

function reflexionByGate(events: EventRow[]): Record<string, ReflexionStat> {
  const out: Record<string, ReflexionStat> = {};
  for (const e of events) {
    if (typeof e.gate !== "string") continue;
    if (e.event === "reflexion.retry" || e.event === "reflexion.recovered" || e.event === "reflexion.exhausted") {
      const cur = out[e.gate] ?? { attempts: 0, recovered: false, exhausted: false };
      const a = typeof e.attempt === "number" ? e.attempt : (typeof e.attempts === "number" ? e.attempts : 0);
      cur.attempts = Math.max(cur.attempts, a);
      if (e.event === "reflexion.recovered") cur.recovered = true;
      if (e.event === "reflexion.exhausted") cur.exhausted = true;
      out[e.gate] = cur;
    }
  }
  return out;
}

function verifyByGate(events: EventRow[]): Record<string, VerifyState> {
  const out: Record<string, VerifyState> = {};
  for (const e of events) {
    const m = /^verify\.g([1-5])\.(passed|failed)$/.exec(e.event);
    if (!m) continue;
    const key = `G${m[1]}`;
    const passed = m[2] === "passed";
    if (out[key] && out[key].passed && !passed) continue;
    out[key] = {
      passed,
      stage: e.stage ?? (passed ? "passed" : "failed"),
      issues: e.issues ?? [],
    };
  }
  return out;
}

function gateScores(events: EventRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    const v = /^verify\.g([1-5])\.(?:passed|failed)$/.exec(e.event);
    if (v && e.scores && Object.keys(e.scores).length > 0) {
      const vals = Object.values(e.scores);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      out[`G${v[1]}`] = avg;
      continue;
    }
    const m = /^g([1-5])\..*judge/.exec(e.event);
    if (m && typeof e.score === "number") out[`G${m[1]}`] = e.score;
  }
  return out;
}

function gateRanges(events: EventRow[]): {
  start: number;
  end: number;
  spans: Array<{ id: string; lo: number; hi: number }>;
} | null {
  const buckets: Record<string, number[]> = { G1: [], G2: [], G3: [], G4: [], G5: [] };
  for (const e of events) {
    const m = /^g([1-5])\./.exec(e.event);
    if (m) buckets[`G${m[1]}`].push(new Date(e.ts).getTime());
  }
  const spans: Array<{ id: string; lo: number; hi: number }> = [];
  for (const [id, ts] of Object.entries(buckets)) {
    if (ts.length === 0) continue;
    spans.push({ id, lo: Math.min(...ts), hi: Math.max(...ts) });
  }
  if (spans.length === 0) return null;
  const start = Math.min(...spans.map((s) => s.lo));
  const end = Math.max(...spans.map((s) => s.hi));
  return { start, end, spans };
}

function gateTimings(events: EventRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  const buckets: Record<string, Date[]> = { G1: [], G2: [], G3: [], G4: [], G5: [] };
  for (const e of events) {
    const m = /^g([1-5])\./.exec(e.event);
    if (m) buckets[`G${m[1]}`].push(new Date(e.ts));
  }
  for (const [g, dates] of Object.entries(buckets)) {
    if (dates.length === 0) continue;
    const lo = Math.min(...dates.map((d) => d.getTime()));
    const hi = Math.max(...dates.map((d) => d.getTime()));
    const secs = Math.max(1, Math.round((hi - lo) / 1000));
    out[g] = secs >= 60 ? `${Math.round(secs / 60)}m` : `${secs}s`;
  }
  return out;
}

interface FoundryStats {
  requisitions: number;
  cacheHits: number;
  hires: number;
  fallbacks: number;
  judgeFailed: number;
  reuseRate: number;
  recentHires: Array<{ role: string; dept: string; seniority?: string; ts: string }>;
  perGate: Record<string, { reqs: number; hits: number; hires: number; fallbacks: number }>;
}

function foundryStats(events: EventRow[]): FoundryStats {
  const stats: FoundryStats = {
    requisitions: 0,
    cacheHits: 0,
    hires: 0,
    fallbacks: 0,
    judgeFailed: 0,
    reuseRate: 0,
    recentHires: [],
    perGate: {},
  };
  const bucket = (g?: string) => {
    if (!g) return null;
    if (!stats.perGate[g]) stats.perGate[g] = { reqs: 0, hits: 0, hires: 0, fallbacks: 0 };
    return stats.perGate[g];
  };
  for (const e of events) {
    const b = bucket(e.gate);
    if (e.event === "foundry.requisition") {
      stats.requisitions++;
      if (b) b.reqs++;
    } else if (e.event === "foundry.cache_hit") {
      stats.cacheHits++;
      if (b) b.hits++;
    } else if (e.event === "foundry.hire") {
      stats.hires++;
      if (b) b.hires++;
      if (e.role && e.dept) {
        stats.recentHires.push({
          role: e.role,
          dept: e.dept,
          seniority: e.seniority,
          ts: e.ts,
        });
      }
    } else if (e.event === "foundry.fallback") {
      stats.fallbacks++;
      if (b) b.fallbacks++;
    } else if (e.event === "foundry.spec_judge.failed") {
      stats.judgeFailed++;
    }
  }
  const denom = stats.requisitions || 1;
  stats.reuseRate = stats.cacheHits / denom;
  stats.recentHires = stats.recentHires.slice(-5).reverse();
  return stats;
}

function latestCouncilFromEvents(events: EventRow[]): (Council & { ts?: string }) | null {
  let decisionIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event === "council.decision") {
      decisionIdx = i;
      break;
    }
  }
  if (decisionIdx === -1) return null;
  const d = events[decisionIdx];
  const votes: Record<string, string> = d.votes ? { ...d.votes } : {};
  if (Object.keys(votes).length === 0) {
    for (let i = decisionIdx - 1; i >= 0 && i >= decisionIdx - 12; i--) {
      const e = events[i];
      if (e.event === "council.vote" && e.voter && e.choice) votes[e.voter] = e.choice;
    }
  }
  return {
    decision: d.decision,
    rationale: d.rationale,
    votes,
    deciding_vote_used: d.deciding_vote_used,
    ts: d.ts,
  };
}

export default async function DashboardPage() {
  const [results, events] = await Promise.all([loadResults(), loadEvents()]);
  const recent = events.slice(-12).reverse();
  const quota = quotaTotal(events);
  const quotaPct = Math.min(100, Math.round((quota / 0.2) * 100));
  const deptQuota = quotaByDept(events);
  const timings = gateTimings(events);
  const scores = gateScores(events);
  const verify = verifyByGate(events);
  const reflexion = reflexionByGate(events);
  const ranges = gateRanges(events);
  const foundry = foundryStats(events);
  const hasResultCouncil = results.some((r) => r.data.council?.votes);
  const eventCouncil = !hasResultCouncil ? latestCouncilFromEvents(events) : null;
  const gateColor: Record<string, string> = {
    G1: "bg-amber-400/80",
    G2: "bg-purple-400/80",
    G3: "bg-cyan-400/80",
    G4: "bg-emerald-400/80",
    G5: "bg-rose-400/80",
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-purple-400">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold">Project artifacts</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Typed Pydantic outputs from each gate, plus the live event tail from{" "}
            <code className="rounded bg-neutral-900 px-1 py-0.5 text-xs">runs/events.jsonl</code>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefresh intervalMs={4000} />
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">
            ← back
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6">
          {eventCouncil && eventCouncil.votes && Object.keys(eventCouncil.votes).length > 0 && (
            <article className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-300/70">
                    from events.jsonl
                  </p>
                  <h2 className="text-lg font-semibold text-cyan-100">Latest Cross-Dept Council</h2>
                  <p className="mt-1 text-sm text-neutral-300">
                    <span
                      className={
                        "rounded px-1.5 py-px font-mono text-xs " +
                        (eventCouncil.decision === "ship"
                          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
                          : eventCouncil.decision === "rework"
                            ? "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30"
                            : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30")
                      }
                    >
                      {eventCouncil.decision ?? "?"}
                    </span>
                    <span className="ml-2 text-neutral-400">{eventCouncil.rationale}</span>
                  </p>
                </div>
                <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 font-mono text-[10px] text-cyan-200 ring-1 ring-cyan-400/30">
                  {eventCouncil.deciding_vote_used ? "tie-break" : "plurality"}
                </span>
              </header>
              <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                {Object.entries(eventCouncil.votes).map(([voter, choice]) => (
                  <li key={voter} className="flex items-center justify-between">
                    <span className="truncate text-neutral-300">{voter}</span>
                    <span
                      className={
                        "ml-2 rounded px-1.5 py-px font-mono text-[10px] " +
                        (choice === "ship"
                          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
                          : choice === "rework"
                            ? "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30"
                            : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30")
                      }
                    >
                      {choice}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          )}
          {results.length === 0 ? (
            <p className="text-neutral-400">
              No runs yet. Try{" "}
              <code className="rounded bg-neutral-900 px-1.5 py-0.5">
                atelier start &quot;...&quot;
              </code>{" "}
              first.
            </p>
          ) : (
            results.map(({ project, data }) => (
              <article
                key={project}
                className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
              >
                <header className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{project}</h2>
                    {data.charter?.one_liner && (
                      <p className="mt-1 text-sm text-neutral-400">{data.charter.one_liner}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs text-purple-300 ring-1 ring-purple-400/30">
                    {data.current_gate ?? "G?"}
                  </span>
                </header>

                <ol className="mt-5 flex items-stretch gap-1.5 text-[11px] font-mono">
                  {GATES.map((g) => {
                    const passed = gatePassed(data, g.id);
                    const current = data.current_gate === g.id;
                    const t = timings[g.id];
                    const targetId = `g${g.id[1]}`;
                    const reachable = passed || current;
                    return (
                      <li key={g.id} className="contents">
                        <a
                          href={reachable ? `#${targetId}` : undefined}
                          aria-disabled={!reachable}
                          title={reachable ? `Jump to ${g.label} artifact` : `${g.label} not produced yet`}
                          className={
                            "relative flex-1 rounded px-2 py-1.5 text-center ring-1 transition " +
                            (current
                              ? "bg-purple-500/15 text-purple-200 ring-purple-400/60 shadow-[0_0_12px_-2px_rgba(168,85,247,0.6)] hover:bg-purple-500/25"
                              : passed
                              ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-neutral-900 text-neutral-500 ring-neutral-800 cursor-not-allowed")
                          }
                        >
                        {current && (
                          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-purple-300 shadow-[0_0_6px_#d8b4fe] animate-pulse" />
                        )}
                        <div>
                          <span className="opacity-70">{g.id}</span> · {g.label}
                        </div>
                        <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px]">
                          {t && (
                            <span
                              className={
                                current ? "text-purple-200/80" : "text-emerald-200/80"
                              }
                            >
                              {t}
                            </span>
                          )}
                          {scores[g.id] !== undefined && (
                            <span
                              title="LLM-judge rubric average (0–1)"
                              className={
                                "rounded px-1 py-px tabular-nums " +
                                (scores[g.id] >= 0.7
                                  ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                                  : "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30")
                              }
                            >
                              judge {scores[g.id].toFixed(2)}
                            </span>
                          )}
                          {verify[g.id] && (
                            <span
                              title={
                                verify[g.id].passed
                                  ? "verify: passed (schema, critic, guardrails)"
                                  : `verify failed at ${verify[g.id].stage}: ${verify[g.id].issues.join("; ")}`
                              }
                              className={
                                "rounded px-1 py-px font-semibold " +
                                (verify[g.id].passed
                                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
                                  : "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30")
                              }
                            >
                              {verify[g.id].passed ? "✓" : "✗ " + verify[g.id].stage}
                            </span>
                          )}
                          {reflexion[g.id] && reflexion[g.id].attempts > 1 && (
                            <span
                              title={
                                reflexion[g.id].recovered
                                  ? `Reflexion recovered after ${reflexion[g.id].attempts} attempts`
                                  : reflexion[g.id].exhausted
                                    ? `Reflexion exhausted after ${reflexion[g.id].attempts} attempts`
                                    : `Reflexion retried (${reflexion[g.id].attempts} attempts)`
                              }
                              className={
                                "rounded px-1 py-px font-mono " +
                                (reflexion[g.id].recovered
                                  ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30"
                                  : "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/30")
                              }
                            >
                              ↻{reflexion[g.id].attempts}
                            </span>
                          )}
                        </div>
                        </a>
                      </li>
                    );
                  })}
                </ol>

                {ranges && ranges.end > ranges.start && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-neutral-500">
                      <span>timeline</span>
                      <span className="font-mono tabular-nums text-neutral-600">
                        {Math.max(1, Math.round((ranges.end - ranges.start) / 1000))}s total
                      </span>
                    </div>
                    <div className="mt-1.5 relative h-3 rounded-full bg-neutral-900 ring-1 ring-neutral-800 overflow-hidden">
                      {ranges.spans.map((s) => {
                        const span = ranges.end - ranges.start || 1;
                        const left = ((s.lo - ranges.start) / span) * 100;
                        const width = Math.max(2, ((s.hi - s.lo) / span) * 100);
                        return (
                          <span
                            key={s.id}
                            className={`absolute top-0 h-full ${gateColor[s.id]} opacity-90`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${s.id} · ${Math.round((s.hi - s.lo) / 1000)}s`}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] font-mono text-neutral-600 tabular-nums">
                      {ranges.spans.map((s) => (
                        <span key={s.id}>{s.id}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {data.charter && (
                    <Card id="g1" title="G1 · Charter" subtitle={data.charter.title}>
                      {data.charter.problem && <P label="problem">{data.charter.problem}</P>}
                      {data.charter.target_user && <P label="user">{data.charter.target_user}</P>}
                      <Bullets label="success metrics" items={data.charter.success_metrics} />
                    </Card>
                  )}
                  {data.plan && (
                    <Card id="g2" title="G2 · Plan" subtitle={data.plan.title}>
                      <Bullets label="milestones" items={data.plan.milestones} />
                      <Bullets label="risks" items={data.plan.risks} tone="danger" />
                    </Card>
                  )}
                  {data.design && (
                    <Card id="g3" title="G3 · Design" subtitle={data.design.feature}>
                      <Bullets
                        label="information architecture"
                        items={data.design.information_architecture}
                      />
                      {data.design.wireframe_notes && (
                        <P label="wireframe notes">{data.design.wireframe_notes}</P>
                      )}
                    </Card>
                  )}
                  {data.review && (
                    <Card id="g4" title="G4 · Build" subtitle={data.review.summary}>
                      <Bullets label="passed checks" items={data.review.passed_checks} tone="ok" />
                      <Bullets
                        label="outstanding risks"
                        items={data.review.outstanding_risks}
                        tone="danger"
                      />
                    </Card>
                  )}
                  {data.launch && (
                    <Card
                      id="g5"
                      title="G5 · Launch"
                      subtitle={data.launch.feature}
                      badge={data.launch.dry_run ? "dry-run" : "live"}
                    >
                      <Bullets label="channels" items={data.launch.channels} />
                      <Bullets label="success metrics" items={data.launch.success_metrics} />
                    </Card>
                  )}
                  {data.council && data.council.votes && (
                    <Card
                      id="council"
                      title="Cross-Dept Council"
                      subtitle={`${data.council.decision ?? "?"} — ${data.council.rationale ?? ""}`}
                      badge={data.council.deciding_vote_used ? "tie-break" : "plurality"}
                    >
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                          votes
                        </div>
                        <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                          {Object.entries(data.council.votes).map(([voter, choice]) => (
                            <li key={voter} className="flex items-center justify-between">
                              <span className="truncate text-neutral-300">{voter}</span>
                              <span
                                className={
                                  "ml-2 rounded px-1.5 py-px font-mono text-[10px] " +
                                  (choice === "ship"
                                    ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
                                    : choice === "rework"
                                      ? "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30"
                                      : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30")
                                }
                              >
                                {choice}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  )}
                </div>
              </article>
            ))
          )}
        </section>

        <aside className="space-y-4">
          <ActiveRunsPanel />
          <InboxPanel />
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Subscription quota
              </h3>
              <span className="text-xs font-mono text-neutral-500">cap 20%</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-amber-200 tabular-nums">
                {(quota * 100).toFixed(1)}
              </span>
              <span className="text-sm text-neutral-500">% of daily</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-900">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-rose-300 transition-[width] duration-700 ease-out"
                style={{ width: `${quotaPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">
              Accounted as fraction of the Claude subscription, not USD.
            </p>
            {deptQuota.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-[11px]">
                {deptQuota.map((d) => {
                  const w = Math.min(100, Math.round((d.frac / Math.max(0.001, deptQuota[0].frac)) * 100));
                  return (
                    <li key={d.dept}>
                      <Link
                        href={`/office?dept=${encodeURIComponent(d.dept)}`}
                        className="flex items-center gap-2 rounded px-1 -mx-1 hover:bg-neutral-900/70 transition"
                        title={`Filter the office to ${d.dept}`}
                      >
                        <span className="w-20 truncate text-neutral-400 group-hover:text-neutral-200">
                          {d.dept}
                        </span>
                        <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-neutral-900">
                          <span
                            className="absolute inset-y-0 left-0 bg-amber-300/70 transition-[width] duration-700 ease-out"
                            style={{ width: `${w}%` }}
                          />
                        </span>
                        <span className="w-10 text-right font-mono text-neutral-500 tabular-nums">
                          {(d.frac * 100).toFixed(1)}%
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {foundry.requisitions > 0 && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Role Foundry
                </h3>
                <span
                  title="cache_hit / requisitions"
                  className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono text-emerald-200 ring-1 ring-emerald-400/30"
                >
                  reuse {Math.round(foundry.reuseRate * 100)}%
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded bg-neutral-900/80 px-1.5 py-2">
                  <div className="font-mono text-base tabular-nums text-cyan-200">
                    {foundry.cacheHits}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                    reuse
                  </div>
                </div>
                <div className="rounded bg-neutral-900/80 px-1.5 py-2">
                  <div className="font-mono text-base tabular-nums text-amber-200">
                    {foundry.hires}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                    hires
                  </div>
                </div>
                <div className="rounded bg-neutral-900/80 px-1.5 py-2">
                  <div
                    className={
                      "font-mono text-base tabular-nums " +
                      (foundry.fallbacks > 0 ? "text-rose-200" : "text-neutral-400")
                    }
                  >
                    {foundry.fallbacks}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                    fallback
                  </div>
                </div>
              </div>
              {foundry.judgeFailed > 0 && (
                <p
                  className="mt-2 text-[10px] text-amber-200/80"
                  title="Spec Judge rejected at least one hired RoleSpec; Foundry retried with critique."
                >
                  spec_judge rejected {foundry.judgeFailed}, retried with critique
                </p>
              )}
              {foundry.recentHires.length > 0 && (
                <>
                  <div className="mt-4 text-[10px] uppercase tracking-widest text-neutral-500">
                    recent hires
                  </div>
                  <ul className="mt-1.5 space-y-1 text-[11px]">
                    {foundry.recentHires.map((h, i) => (
                      <li
                        key={`${h.role}-${i}`}
                        className="flex items-center justify-between rounded bg-neutral-900/60 px-2 py-1"
                      >
                        <span className="truncate text-neutral-200">{h.role}</span>
                        <span className="ml-2 flex items-center gap-1.5 font-mono text-[10px] text-neutral-500">
                          {h.seniority && (
                            <span className="rounded bg-purple-500/10 px-1 text-purple-200 ring-1 ring-purple-400/20">
                              {h.seniority}
                            </span>
                          )}
                          <span>{h.dept}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {Object.keys(foundry.perGate).length > 0 && (
                <>
                  <div className="mt-4 text-[10px] uppercase tracking-widest text-neutral-500">
                    per gate
                  </div>
                  <ul className="mt-1.5 space-y-1 text-[11px] font-mono">
                    {Object.entries(foundry.perGate)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([g, s]) => (
                        <li
                          key={g}
                          className="flex items-center justify-between rounded bg-neutral-900/60 px-2 py-1"
                        >
                          <span className="text-neutral-300">{g}</span>
                          <span className="flex gap-2 text-neutral-500 tabular-nums">
                            <span title="requisitions">req {s.reqs}</span>
                            <span className="text-cyan-300/90" title="cache_hit">
                              ↻{s.hits}
                            </span>
                            <span className="text-amber-300/90" title="hire">
                              +{s.hires}
                            </span>
                            {s.fallbacks > 0 && (
                              <span className="text-rose-300/90" title="fallback">
                                !{s.fallbacks}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Recent events
            </h3>
            <ul className="mt-3 space-y-1.5 text-[11px] font-mono">
              {recent.length === 0 ? (
                <li className="text-neutral-500">no events yet</li>
              ) : (
                recent.map((e, i) => (
                  <li
                    key={`${e.ts}-${i}`}
                    className="rounded border border-neutral-800/70 bg-neutral-900/60 px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300 truncate">{e.event}</span>
                      <span className="text-neutral-600">
                        {new Date(e.ts).toLocaleTimeString()}
                      </span>
                    </div>
                    {e.dept && <div className="mt-0.5 text-amber-300/90">{e.dept}</div>}
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Card({
  title,
  subtitle,
  badge,
  children,
  id,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-4 target:ring-2 target:ring-purple-400/60 target:shadow-[0_0_20px_-4px_rgba(168,85,247,0.5)] transition scroll-mt-20"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-purple-300">
          {title}
        </h4>
        {badge && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-200 ring-1 ring-amber-500/30">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-sm font-medium text-neutral-100">{subtitle}</p>}
      <div className="mt-3 space-y-3 text-xs text-neutral-300">{children}</div>
    </div>
  );
}

function P({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}

function Bullets({
  label,
  items,
  tone,
}: {
  label: string;
  items?: string[];
  tone?: "ok" | "danger";
}) {
  if (!items || items.length === 0) return null;
  const dot =
    tone === "danger"
      ? "before:bg-rose-400/80"
      : tone === "ok"
        ? "before:bg-emerald-400/80"
        : "before:bg-neutral-500";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <ul className="mt-1 space-y-0.5">
        {items.map((it) => (
          <li
            key={it}
            className={`relative pl-3.5 before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full ${dot}`}
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
