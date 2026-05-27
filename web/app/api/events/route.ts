import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const RUNS_DIR = process.env.ATELIER_RUNS_DIR
  ? path.resolve(process.env.ATELIER_RUNS_DIR)
  : path.resolve(process.cwd(), "..", "runs");
const EVENTS_PATH = path.join(RUNS_DIR, "events.jsonl");

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let cursor = 0;
      const tick = async () => {
        try {
          const text = await readFile(EVENTS_PATH, "utf-8");
          if (text.length > cursor) {
            const chunk = text.slice(cursor);
            cursor = text.length;
            for (const line of chunk.split("\n")) {
              if (!line.trim()) continue;
              controller.enqueue(encoder.encode(`data: ${line}\n\n`));
            }
          }
        } catch {
          // file not yet created — keep polling
        }
      };
      const iv = setInterval(tick, 1000);
      await tick();
      // @ts-expect-error - controller does not expose abort
      controller._cleanup = () => clearInterval(iv);
    },
    cancel(reason) {
      // controller cleanup
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
