"use client";

import { useEffect, useRef, useState } from "react";

export type CursorMode = "cross" | "dot" | "arrow";
export const CURSOR_EVENT = "expirylens-cursor";
const STORAGE_KEY = "expirylens-cursor";

export function readCursorMode(): CursorMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "cross" || saved === "dot" || saved === "arrow") return saved;
  } catch {
    // storage blocked, fall back to the default
  }
  return "cross";
}

export function setCursorMode(mode: CursorMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // the choice still applies for this visit
  }
  window.dispatchEvent(new CustomEvent<CursorMode>(CURSOR_EVENT, { detail: mode }));
}

// Chart-terminal cursor, like TradingView or Kite: dashed lines through the
// pointer with a cross or dot at the centre, or the normal arrow.
export default function Crosshair() {
  const [mode, setMode] = useState<CursorMode>("cross");
  const vLine = useRef<HTMLDivElement>(null);
  const hLine = useRef<HTMLDivElement>(null);
  const centre = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(readCursorMode());
    const onChange = (e: Event) => setMode((e as CustomEvent<CursorMode>).detail);
    window.addEventListener(CURSOR_EVENT, onChange);
    return () => window.removeEventListener(CURSOR_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (mode === "arrow" || !window.matchMedia("(pointer: fine)").matches) return;

    document.documentElement.classList.add("has-reticle");
    let x = -100, y = -100, frame = 0;

    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const target = e.target as Element | null;
      const hot = !!target?.closest("a, button, input, label, [data-reticle]");
      layer.current?.classList.toggle("crosshair-off", hot);
    };

    const draw = () => {
      if (vLine.current) vLine.current.style.transform = `translateX(${x}px)`;
      if (hLine.current) hLine.current.style.transform = `translateY(${y}px)`;
      if (centre.current) centre.current.style.transform = `translate(${x}px, ${y}px)`;
      frame = requestAnimationFrame(draw);
    };

    const hide = () => layer.current?.classList.add("crosshair-off");

    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", hide);
    frame = requestAnimationFrame(draw);

    return () => {
      document.documentElement.classList.remove("has-reticle");
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", hide);
      cancelAnimationFrame(frame);
    };
  }, [mode]);

  if (mode === "arrow") return null;

  return (
    <div ref={layer} aria-hidden="true" className="crosshair pointer-events-none fixed inset-0 z-50">
      <div ref={vLine} className="crosshair-v absolute left-0 top-0 h-full" />
      <div ref={hLine} className="crosshair-h absolute left-0 top-0 w-full" />
      <div ref={centre} className="absolute left-0 top-0">
        {mode === "dot" ? (
          <div className="-ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-amber" />
        ) : (
          <svg className="-ml-[9px] -mt-[9px]" width="18" height="18" viewBox="0 0 18 18" stroke="var(--text)" strokeWidth="1.4">
            <path d="M9 0v18M0 9h18" />
          </svg>
        )}
      </div>
      <style>{`
        .crosshair { transition: opacity 0.15s ease; }
        .crosshair-off { opacity: 0; }
        .crosshair-v { width: 0; border-left: 1px dashed var(--muted); opacity: 0.5; }
        .crosshair-h { height: 0; border-top: 1px dashed var(--muted); opacity: 0.5; }
      `}</style>
    </div>
  );
}
