import OfficeView from "./OfficeView";
import Link from "next/link";

export default function OfficePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-purple-400">
            Live office
          </p>
          <h1 className="mt-1 text-3xl font-bold">The Atelier floor</h1>
        </div>
        <Link href="/" className="text-sm text-neutral-400 hover:text-white">
          ← back
        </Link>
      </div>
      <OfficeView />
      <p className="mt-6 text-sm text-neutral-400">
        Rendered with PixiJS v8 on Modern Interiors sprites. Characters animate
        when events arrive on the SSE stream from <code>/api/events</code>.
      </p>
    </main>
  );
}
