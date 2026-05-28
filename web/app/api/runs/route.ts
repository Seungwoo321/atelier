import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const ATELIER_BIN = process.env.ATELIER_BIN
  ? path.resolve(process.env.ATELIER_BIN)
  : path.join(REPO_ROOT, ".venv/bin/atelier");

const RUNS_DIR = process.env.ATELIER_RUNS_DIR
  ? path.resolve(process.env.ATELIER_RUNS_DIR)
  : path.join(REPO_ROOT, "runs");
const ACTIVE_DIR = path.join(RUNS_DIR, "active");

interface ActiveRun {
  project_id: string;
  pid: number;
  request: string;
  startedAt: number;
  alive: boolean;
}

function safeProjectId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "web-run";
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    await mkdir(ACTIVE_DIR, { recursive: true });
    const files = await readdir(ACTIVE_DIR);
    const runs: ActiveRun[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const text = await readFile(path.join(ACTIVE_DIR, f), "utf-8");
        const r = JSON.parse(text) as Omit<ActiveRun, "alive">;
        const alive = isAlive(r.pid);
        runs.push({ ...r, alive });
        if (!alive) {
          await unlink(path.join(ACTIVE_DIR, f)).catch(() => {});
        }
      } catch {
        /* skip */
      }
    }
    runs.sort((a, b) => b.startedAt - a.startedAt);
    return Response.json({ runs });
  } catch {
    return Response.json({ runs: [] });
  }
}

export async function POST(req: Request) {
  const data = await req.json().catch(() => ({}));
  const request = String(data.request ?? "").trim();
  const projectId = safeProjectId(String(data.project_id ?? "web-run").trim());
  if (!request) return Response.json({ error: "request required" }, { status: 400 });

  const child = spawn(
    ATELIER_BIN,
    ["start", request, "--project-id", projectId],
    {
      cwd: REPO_ROOT,
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    },
  );
  child.unref();

  await mkdir(ACTIVE_DIR, { recursive: true });
  const record: Omit<ActiveRun, "alive"> = {
    project_id: projectId,
    pid: child.pid ?? -1,
    request,
    startedAt: Date.now(),
  };
  await writeFile(
    path.join(ACTIVE_DIR, `${projectId}.json`),
    JSON.stringify(record, null, 2),
    "utf-8",
  );

  return Response.json({ ok: true, ...record });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const projectId = safeProjectId(url.searchParams.get("project_id") ?? "");
  if (!projectId) return Response.json({ error: "project_id required" }, { status: 400 });
  const file = path.join(ACTIVE_DIR, `${projectId}.json`);
  try {
    const text = await readFile(file, "utf-8");
    const r = JSON.parse(text) as Omit<ActiveRun, "alive">;
    if (isAlive(r.pid)) {
      try {
        process.kill(r.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
    await unlink(file).catch(() => {});
    return Response.json({ ok: true, project_id: projectId, killed: true });
  } catch {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
}
