"use client";

import { useEffect, useRef } from "react";
import { Application, Assets, Sprite, Container } from "pixi.js";
import { useEventStream } from "@/lib/useEventStream";

const CHARACTERS = [
  "Adam",
  "Alex",
  "Amelia",
  "Bob",
  "Lucy",
  "Olivia",
  "Asuna",
  "Conan",
  "Hiro",
];

export default function OfficeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const events = useEventStream("/api/events");

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const app = new Application();
    let destroyed = false;
    const sprites = new Map<string, Sprite>();

    (async () => {
      await app.init({
        width: 960,
        height: 540,
        backgroundColor: 0x141420,
        antialias: false,
      });
      if (destroyed) return;
      host.appendChild(app.canvas);

      const room = await Assets.load(
        "/assets/modern-interiors/interiors/16x16/Room_Builder_free_16x16.png",
      );
      const roomSprite = new Sprite(room);
      roomSprite.scale.set(2);
      app.stage.addChild(roomSprite);

      const group = new Container();
      app.stage.addChild(group);

      for (let i = 0; i < CHARACTERS.length; i++) {
        const tex = await Assets.load(
          `/assets/modern-interiors/characters/${CHARACTERS[i]}_idle_16x16.png`,
        );
        const sp = new Sprite(tex);
        sp.scale.set(2);
        sp.x = 80 + (i % 5) * 120;
        sp.y = 220 + Math.floor(i / 5) * 100;
        group.addChild(sp);
        sprites.set(CHARACTERS[i], sp);
      }
    })();

    return () => {
      destroyed = true;
      app.destroy(true, { children: true });
      while (host.firstChild) host.removeChild(host.firstChild);
    };
  }, []);

  // Visual nudge: bump a character on each new event.
  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;
    const host = containerRef.current;
    if (!host) return;
    host.animate(
      [{ filter: "brightness(1)" }, { filter: "brightness(1.15)" }, { filter: "brightness(1)" }],
      { duration: 400 },
    );
  }, [events]);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800">
      <div ref={containerRef} className="bg-neutral-950" />
      <div className="border-t border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-400">
        events received: {events.length}
      </div>
    </div>
  );
}
