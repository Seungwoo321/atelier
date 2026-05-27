"use client";

import { useEffect, useState } from "react";

export interface AtelierEvent {
  ts: string;
  event: string;
  [k: string]: unknown;
}

export function useEventStream(url: string): AtelierEvent[] {
  const [events, setEvents] = useState<AtelierEvent[]>([]);
  useEffect(() => {
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents((prev) => [...prev.slice(-49), data]);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [url]);
  return events;
}
