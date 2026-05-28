import { readdir, readFile, stat, writeFile, rename } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const INBOX_DIR = process.env.ATELIER_INBOX_DIR
  ? path.resolve(process.env.ATELIER_INBOX_DIR)
  : path.resolve(process.cwd(), "..", "inbox");

interface InboxItem {
  path: string;
  filename: string;
  title: string;
  body: string;
  approved: boolean;
  mtime: number;
}

async function readInbox(): Promise<InboxItem[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(INBOX_DIR);
  } catch {
    return [];
  }
  const items: InboxItem[] = [];
  for (const name of entries) {
    if (!name.endsWith(".md") && !name.endsWith(".md.approved")) continue;
    const full = path.join(INBOX_DIR, name);
    const s = await stat(full);
    const body = await readFile(full, "utf-8").catch(() => "");
    const first = body.split("\n")[0] ?? "";
    items.push({
      path: full,
      filename: name,
      title: first.replace(/^#\s*/, "").trim() || name,
      body,
      approved: name.endsWith(".approved"),
      mtime: s.mtimeMs,
    });
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return items;
}

export async function GET() {
  const items = await readInbox();
  return Response.json({ items, inboxDir: INBOX_DIR });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "create";
  const data = await req.json().catch(() => ({}));

  if (action === "approve") {
    const target = String(data.path ?? "");
    const norm = path.resolve(target);
    if (!norm.startsWith(INBOX_DIR + path.sep) && norm !== INBOX_DIR) {
      return Response.json({ error: "path outside inbox dir" }, { status: 400 });
    }
    const approved = norm + ".approved";
    await rename(norm, approved);
    return Response.json({ ok: true, path: approved });
  }

  if (action === "create") {
    const title = String(data.title ?? "").trim();
    const body = String(data.body ?? "").trim();
    if (!title) return Response.json({ error: "title required" }, { status: 400 });
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "request";
    const ts = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .replace(/\..*$/, "")
      .replace(/(\d{8})(\d{6})/, "$1-$2");
    const filename = `${ts}-${slug}.md`;
    const full = path.join(INBOX_DIR, filename);
    const content = `# ${title}\n\n${body}\n`;
    await writeFile(full, content, "utf-8");
    return Response.json({ ok: true, path: full, filename });
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}
