"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CursorMode, readCursorMode, setCursorMode } from "@/components/Reticle";

const PAGES = [
  { href: "/", label: "Overview" },
  { href: "/findings", label: "Findings" },
  { href: "/explorer", label: "Explorer" },
  { href: "/calendar", label: "Calendar" },
  { href: "/method", label: "Method" },
];

type Theme = "night" | "day";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("expirylens-theme", theme);
  } catch {
    // private windows can block storage; the theme still applies for this visit
  }
}

function CursorIcon({ mode }: { mode: CursorMode }) {
  if (mode === "arrow") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 3l14 8-6 1.5L10 19z" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 2v20M2 12h20" strokeDasharray={mode === "dot" ? "2 2" : undefined} />
      {mode === "dot" && <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />}
    </svg>
  );
}

const CURSOR_OPTIONS: { mode: CursorMode; label: string }[] = [
  { mode: "cross", label: "Cross" },
  { mode: "dot", label: "Dot" },
  { mode: "arrow", label: "Arrow" },
];

export default function Dock() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("night");
  const [cursor, setCursor] = useState<CursorMode>("cross");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "day" ? "day" : "night");
    setCursor(readCursorMode());
  }, []);

  // close the cursor menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const toggleTheme = () => {
    const next = theme === "night" ? "day" : "night";
    applyTheme(next);
    setTheme(next);
  };

  const chooseCursor = (mode: CursorMode) => {
    setCursorMode(mode);
    setCursor(mode);
    setMenuOpen(false);
  };

  return (
    <nav data-reticle
      aria-label="Main"
      className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1 rounded-full border border-line p-1.5 backdrop-blur-md"
      style={{ background: "var(--dock)", boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-center gap-1 overflow-x-auto">
        {PAGES.map((page) => {
          const active = page.href === "/" ? pathname === "/" : pathname.startsWith(page.href);
          return (
            <Link
              key={page.href}
              href={page.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm transition-colors ${
                active ? "bg-text font-semibold text-bg" : "font-medium text-text hover:bg-raised"
              }`}
            >
              {page.label}
            </Link>
          );
        })}
      </div>

      <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-line" />

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Cursor: ${cursor}. Change cursor`}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-text hover:bg-raised"
        >
          <CursorIcon mode={cursor} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            aria-label="Cursor"
            className="absolute bottom-[calc(100%+12px)] right-0 flex w-44 flex-col gap-1 rounded-2xl border border-line bg-raised p-1.5"
            style={{ boxShadow: "var(--shadow)" }}
          >
            {CURSOR_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                role="menuitemradio"
                aria-checked={cursor === option.mode}
                onClick={() => chooseCursor(option.mode)}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-text ${
                  cursor === option.mode ? "bg-bg font-semibold" : "hover:bg-bg"
                }`}
              >
                <CursorIcon mode={option.mode} />
                {option.label}
                {option.mode === "cross" && <span className="ml-auto text-xs text-muted">Default</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "night" ? "Switch to day session" : "Switch to night session"}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-text hover:bg-raised"
      >
        {theme === "night" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
          </svg>
        )}
      </button>
    </nav>
  );
}
