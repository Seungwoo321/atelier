import Link from "next/link";

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

const GATES = [
  ["G1", "Charter", "Chief of Staff"],
  ["G2", "Plan", "PM Lead + Eng Manager"],
  ["G3", "Design", "Design Lead + PM"],
  ["G4", "Build", "Eng Manager + QA Lead"],
  ["G5", "Launch", "Mkt + Ops + Analytics"],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-16">
        <p className="text-sm uppercase tracking-widest text-purple-400">
          Atelier · v1.0
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-tight">
          A virtual company of <br />
          role-specialized agents.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-neutral-300">
          Drop a request. Watch 28 roles across 9 departments collaborate
          through 5 strategic gates. Ship typed artifacts on every run.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/office"
            className="rounded-md bg-purple-500 px-5 py-3 font-medium hover:bg-purple-400"
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
      </header>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold">The 5 gates</h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {GATES.map(([id, name, owner]) => (
            <li
              key={id}
              className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
            >
              <div className="text-xs text-purple-400">{id}</div>
              <div className="mt-1 font-semibold">{name}</div>
              <div className="mt-2 text-xs text-neutral-400">{owner}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold">What it does</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-neutral-800 bg-neutral-950 p-5"
            >
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-neutral-300">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-4 text-2xl font-semibold">Get started</h2>
        <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-5 text-sm">
{`git clone https://github.com/Seungwoo321/atelier.git
cd atelier
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
atelier auth login
atelier start "weekly retrospective CLI for solo developers"`}
        </pre>
      </section>

      <footer className="mt-24 border-t border-neutral-800 pt-6 text-sm text-neutral-500">
        Sprites © LimeZu — Modern Interiors (free, non-commercial).
      </footer>
    </main>
  );
}
