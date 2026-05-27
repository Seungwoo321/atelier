import Link from "next/link";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

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
interface Result {
  current_gate?: string;
  charter?: Charter;
  plan?: Plan;
  design?: Design;
  review?: Review;
  launch?: Launch;
  notes?: string[];
}
interface EventRow {
  ts: string;
  event: string;
  dept?: string;
  frac?: number;
  score?: number;
  gate?: string;
  project?: string;
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

function gateScores(events: EventRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
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

export default async function DashboardPage() {
  const [results, events] = await Promise.all([loadResults(), loadEvents()]);
  const recent = events.slice(-12).reverse();
  const quota = quotaTotal(events);
  const quotaPct = Math.min(100, Math.round((quota / 0.2) * 100));
  const deptQuota = quotaByDept(events);
  const timings = gateTimings(events);
  const scores = gateScores(events);
  const ranges = gateRanges(events);
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
        <Link href="/" className="text-sm text-neutral-400 hover:text-white">
          ← back
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6">
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
                    return (
                      <li
                        key={g.id}
                        className={
                          "relative flex-1 rounded px-2 py-1.5 text-center ring-1 " +
                          (current
                            ? "bg-purple-500/15 text-purple-200 ring-purple-400/60 shadow-[0_0_12px_-2px_rgba(168,85,247,0.6)]"
                            : passed
                            ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                            : "bg-neutral-900 text-neutral-500 ring-neutral-800")
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
                              className={
                                "rounded px-1 py-px tabular-nums " +
                                (scores[g.id] >= 8
                                  ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                                  : "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30")
                              }
                            >
                              judge {scores[g.id].toFixed(1)}
                            </span>
                          )}
                        </div>
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
                    <Card title="G1 · Charter" subtitle={data.charter.title}>
                      {data.charter.problem && <P label="problem">{data.charter.problem}</P>}
                      {data.charter.target_user && <P label="user">{data.charter.target_user}</P>}
                      <Bullets label="success metrics" items={data.charter.success_metrics} />
                    </Card>
                  )}
                  {data.plan && (
                    <Card title="G2 · Plan" subtitle={data.plan.title}>
                      <Bullets label="milestones" items={data.plan.milestones} />
                      <Bullets label="risks" items={data.plan.risks} tone="danger" />
                    </Card>
                  )}
                  {data.design && (
                    <Card title="G3 · Design" subtitle={data.design.feature}>
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
                    <Card title="G4 · Build" subtitle={data.review.summary}>
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
                      title="G5 · Launch"
                      subtitle={data.launch.feature}
                      badge={data.launch.dry_run ? "dry-run" : "live"}
                    >
                      <Bullets label="channels" items={data.launch.channels} />
                      <Bullets label="success metrics" items={data.launch.success_metrics} />
                    </Card>
                  )}
                </div>
              </article>
            ))
          )}
        </section>

        <aside className="space-y-4">
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
                className="h-full bg-gradient-to-r from-amber-300 to-rose-300"
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
                            className="absolute inset-y-0 left-0 bg-amber-300/70"
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
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-4">
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
