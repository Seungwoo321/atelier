import Image from "next/image";
import Link from "next/link";
import { CopyButton } from "./CopyButton";

const QUICKSTART = `git clone https://github.com/Seungwoo321/atelier.git
cd atelier
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"

atelier auth login
atelier start "weekly retrospective CLI for solo developers"

cd web && pnpm install && pnpm dev`;

const FEATURES = [
  {
    title: "9 departments, 28 roles",
    body: "Strategy, Product, Design, Engineering, QA, Marketing, Operations, Analytics, Chief — each with one lead and composable specialists.",
  },
  {
    title: "5 strategic gates",
    body: "Charter → Plan → Design → Build → Launch. Every gate emits a typed Pydantic artifact and runs a 4-stage verification pipeline.",
  },
  {
    title: "Two LLM transports",
    body: "Claude Code SDK in-process or Agent Client Protocol (ACP). One LLMProvider Protocol, two implementations, no other paths.",
  },
  {
    title: "Quota-aware",
    body: "Cost model is a fraction of your daily Claude subscription quota — not USD per token. Default cap 20%.",
  },
  {
    title: "Decision protocols",
    body: "Reflexion (cap 3, ≥10%), Bounded Debate (N=2, ≥30%), Cross-Dept Council with PM Lead deciding vote, Janitor Memo.",
  },
  {
    title: "Live office view",
    body: "Watch the company at work — a PixiJS office rendered on Modern Interiors sprites, animated by streamed events.",
  },
];

const GATES: ReadonlyArray<readonly [string, string, string]> = [
  ["G1", "Charter", "Chief of Staff"],
  ["G2", "Plan", "PM Lead + Eng Manager"],
  ["G3", "Design", "Design Lead + PM"],
  ["G4", "Build", "Eng Manager + QA Lead"],
  ["G5", "Launch", "Mkt + Ops + Analytics"],
];

const STATS: ReadonlyArray<readonly [string, string]> = [
  ["28", "role-specialized agents"],
  ["9", "departments with one lead each"],
  ["5", "strategic gates · G1 → G5"],
  ["4", "verification stages per gate"],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-purple-300 ring-1 ring-purple-400/30">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-300 shadow-[0_0_8px_#d8b4fe] animate-pulse" />
            Atelier · v1.0
          </div>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight">
            A virtual company of <br />
            <span className="bg-gradient-to-br from-amber-200 via-purple-200 to-purple-400 bg-clip-text text-transparent">
              role-specialized agents.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-neutral-300">
            Drop a request. Watch 28 roles across 9 departments collaborate through 5
            strategic gates. Ship typed artifacts on every run.
          </p>
          <p className="mt-3 max-w-xl text-sm text-neutral-500">
            Powered by Claude — runs in-process via the{" "}
            <span className="text-neutral-300">Claude Code SDK</span> or over stdio via{" "}
            <span className="text-neutral-300">ACP</span>. One Protocol, two transports,
            no third-party LLM clients.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/office"
              className="rounded-md bg-purple-500 px-5 py-3 font-medium text-white shadow-[0_6px_20px_-6px_rgba(168,85,247,0.55)] hover:bg-purple-400"
            >
              Enter the office →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-neutral-700 px-5 py-3 font-medium hover:bg-neutral-900"
            >
              Open dashboard
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {STATS.map(([num, label]) => (
              <div key={label}>
                <dt className="text-3xl font-semibold tabular-nums text-amber-200">{num}</dt>
                <dd className="mt-1 text-[11px] uppercase tracking-widest text-neutral-500">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-purple-500/20 via-amber-400/10 to-transparent blur-2xl" />
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-[0_25px_60px_-30px_rgba(168,85,247,0.4)]">
            <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2 text-[11px] font-mono text-neutral-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400/70" />
                <span className="h-2 w-2 rounded-full bg-amber-300/70" />
                <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                <span className="ml-2">atelier://office</span>
              </div>
              <span className="text-emerald-300/80">live</span>
            </div>
            <div className="relative">
              <Image
                src="/office-bg.png"
                alt="Office preview"
                width={960}
                height={540}
                className="block w-full"
                priority
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
                <div className="flex justify-end gap-1.5">
                  <span className="rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-mono text-amber-200 ring-1 ring-amber-500/30 backdrop-blur-sm">
                    SDK in-process
                  </span>
                  <span className="rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-mono text-cyan-200 ring-1 ring-cyan-500/30 backdrop-blur-sm">
                    ACP
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-300">
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200 ring-1 ring-emerald-500/30">
                    G4 · review
                  </span>
                  <span className="text-neutral-500">quota 10.0% · 9 leads</span>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-neutral-500">
            PixiJS · Modern Interiors sprites · animated by SSE events
          </p>
        </div>
      </header>

      <section className="mt-20">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Drop a request",
              body: (
                <>
                  <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs text-amber-200">
                    atelier start &quot;…&quot;
                  </code>{" "}
                  spins up the Chief of Staff and routes the brief through the org.
                </>
              ),
            },
            {
              step: "02",
              title: "Run the gates",
              body: (
                <>
                  G1 → G5 with 4-stage verification (Schema → Critic → Judge → Guardrails).
                  Reflexion, Bounded Debate, and Cross-Dept Council resolve disagreements.
                </>
              ),
            },
            {
              step: "03",
              title: "Ship typed artifacts",
              body: (
                <>
                  Every gate writes a Pydantic model to{" "}
                  <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs">
                    artifacts/&lt;project&gt;/
                  </code>{" "}
                  with SSE events streamed to the office.
                </>
              ),
            },
          ].map(({ step, title, body }, i, arr) => (
            <div
              key={step}
              className="relative rounded-lg border border-neutral-800 bg-neutral-950 p-5"
            >
              <div className="font-mono text-[11px] text-purple-400">{step}</div>
              <div className="mt-1 font-semibold">{title}</div>
              <p className="mt-2 text-sm text-neutral-400">{body}</p>
              {i < arr.length - 1 && (
                <span className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-neutral-700 md:block">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">The 5 gates</h2>
          <span className="text-xs text-neutral-500">G1 → G5 · typed Pydantic outputs</span>
        </div>
        <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5">
          {GATES.map(([id, name, owner], i) => (
            <li
              key={id}
              className="relative rounded-lg border border-neutral-800 bg-neutral-950 p-4"
            >
              <div className="flex items-center gap-2 text-xs text-purple-400">
                <span className="rounded bg-purple-500/15 px-1.5 py-0.5 font-mono ring-1 ring-purple-500/30">
                  {id}
                </span>
                {i < GATES.length - 1 && (
                  <span className="ml-auto text-neutral-600">→</span>
                )}
              </div>
              <div className="mt-2 font-semibold">{name}</div>
              <div className="mt-1 text-xs text-neutral-400">{owner}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20">
        <h2 className="text-2xl font-semibold">What it does</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-lg border border-neutral-800 bg-neutral-950 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-purple-500/50 hover:bg-neutral-900/60 hover:shadow-[0_18px_40px_-22px_rgba(168,85,247,0.45)]"
            >
              <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <h3 className="font-semibold text-neutral-100">{f.title}</h3>
              <p className="mt-2 text-sm text-neutral-400 group-hover:text-neutral-300">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">Get started</h2>
          <span className="text-xs text-neutral-500">
            pnpm for <code className="rounded bg-neutral-900 px-1 py-0.5">web/</code> · uv for Python
          </span>
        </div>
        <div className="relative mt-5">
          <div className="absolute right-3 top-3 z-10">
            <CopyButton text={QUICKSTART} label="copy" />
          </div>
        <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-5 pr-20 text-sm leading-relaxed">
          <code>
            <span className="text-neutral-500"># clone &amp; bootstrap</span>
            {"\n"}
            git clone https://github.com/Seungwoo321/atelier.git
            {"\n"}
            cd atelier
            {"\n"}
            uv venv && source .venv/bin/activate
            {"\n"}
            uv pip install -e &quot;.[dev]&quot;
            {"\n"}
            {"\n"}
            <span className="text-neutral-500"># run the company on a request</span>
            {"\n"}
            atelier auth login
            {"\n"}
            atelier start &quot;weekly retrospective CLI for solo developers&quot;
            {"\n"}
            {"\n"}
            <span className="text-neutral-500"># open the live office</span>
            {"\n"}
            cd web && pnpm install && pnpm dev
          </code>
        </pre>
        </div>
      </section>

      <footer className="mt-24 flex items-center justify-between border-t border-neutral-800 pt-6 text-sm text-neutral-500">
        <span>Sprites © LimeZu — Modern Interiors (free, non-commercial).</span>
        <span>
          <Link href="/office" className="hover:text-white">
            office
          </Link>{" "}
          ·{" "}
          <Link href="/dashboard" className="hover:text-white">
            dashboard
          </Link>
        </span>
      </footer>
    </main>
  );
}
