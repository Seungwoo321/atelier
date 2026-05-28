import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const ATELIER_BIN = process.env.ATELIER_BIN
  ? path.resolve(process.env.ATELIER_BIN)
  : path.join(REPO_ROOT, ".venv/bin/atelier");

export async function POST(req: Request) {
  const data = await req.json().catch(() => ({}));
  const request = String(data.request ?? "").trim();
  const projectId = String(data.project_id ?? "web-run").trim();
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

  return Response.json({
    ok: true,
    pid: child.pid,
    project_id: projectId,
    request,
  });
}
