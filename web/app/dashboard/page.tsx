import Link from "next/link";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

interface Result {
  current_gate?: string;
  charter?: { title?: string; one_liner?: string };
  plan?: { title?: string; milestones?: string[] };
  notes?: string[];
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
        // skip
      }
    }
    return out;
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const results = await loadResults();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-purple-400">
            Dashboard
          </p>
          <h1 className="mt-1 text-3xl font-bold">Project artifacts</h1>
        </div>
        <Link href="/" className="text-sm text-neutral-400 hover:text-white">
          ← back
        </Link>
      </div>

      {results.length === 0 ? (
        <p className="text-neutral-400">
          No runs yet. Try{" "}
          <code className="rounded bg-neutral-900 px-1.5 py-0.5">
            atelier start &quot;...&quot;
          </code>{" "}
          first.
        </p>
      ) : (
        <ul className="space-y-4">
          {results.map(({ project, data }) => (
            <li
              key={project}
              className="rounded-lg border border-neutral-800 bg-neutral-950 p-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{project}</h2>
                <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs text-purple-300">
                  gate {data.current_gate ?? "?"}
                </span>
              </div>
              {data.charter?.title && (
                <p className="mt-2 text-sm text-neutral-300">
                  <span className="text-neutral-500">charter:</span>{" "}
                  {data.charter.title}
                </p>
              )}
              {data.plan?.milestones && (
                <ul className="mt-2 list-disc pl-5 text-sm text-neutral-400">
                  {data.plan.milestones.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
