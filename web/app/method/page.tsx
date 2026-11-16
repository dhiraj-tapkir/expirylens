"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Brand from "@/components/Brand";

type Stage = {
  id: string;
  kicker: string;
  title: string;
  text: string;
  stats: [string, string][];
  tools: string[];
};

const STAGES: Stage[] = [
  {
    id: "source",
    kicker: "Source",
    title: "Upstox API",
    text: "One minute candles for Nifty 50 and Sensex, pulled one month per request with a read only analytics token.",
    stats: [["2", "indices"], ["14 months", "of history"]],
    tools: ["httpx", "Polars"],
  },
  {
    id: "raw",
    kicker: "Land",
    title: "Raw files",
    text: "Every pull lands as a Parquet file before anything touches the database, so a bad load can always be replayed. Raw market data stays on my machine and never goes to GitHub.",
    stats: [["Parquet", "format"], ["0", "raw files published"]],
    tools: ["Parquet", "Polars"],
  },
  {
    id: "contract",
    kicker: "Audit",
    title: "Contract check",
    text: "A Pandera schema checks every candle: unique timestamps, positive prices, a high above the low. It runs as a blocking check, so bad data cannot reach the database. Prints outside market hours go to a quarantine table instead of being deleted.",
    stats: [["2", "prints quarantined"], ["Blocking", "check"]],
    tools: ["Pandera", "Dagster"],
  },
  {
    id: "db",
    kicker: "Store",
    title: "TimescaleDB",
    text: "Candles load through a staging table and an idempotent upsert, so running the pipeline twice changes nothing. The hypertable splits time into weekly chunks.",
    stats: [["221,510", "candles"], ["63", "weekly chunks"]],
    tools: ["PostgreSQL 17", "TimescaleDB", "Docker"],
  },
  {
    id: "sql",
    kicker: "Derive",
    title: "SQL views",
    text: "The expiry calendar is derived from the data itself, so a holiday moves an expiry automatically. A view measures each day's late move from the 15:14 candle to the close.",
    stats: [["125", "expiries"], ["590", "trading days"]],
    tools: ["SQL", "Dagster"],
  },
  {
    id: "research",
    kicker: "Test",
    title: "Research",
    text: "Permutation tests compare median late moves on expiry and normal days in each era. Five tests run in total, so a result needs p below 0.01 to count (Bonferroni).",
    stats: [["10,000", "shuffles per test"], ["2 of 4", "results pass"]],
    tools: ["Python", "Polars"],
  },
  {
    id: "serve",
    kicker: "Serve",
    title: "API and export",
    text: "A read only FastAPI service with validated, parameterised queries, plus a small export of derived results for this site. The test suite runs on every push.",
    stats: [["4", "endpoints"], ["25", "tests"]],
    tools: ["FastAPI", "pytest", "GitHub Actions"],
  },
  {
    id: "site",
    kicker: "Show",
    title: "This dashboard",
    text: "A static Next.js site with D3 charts, built from the exported JSON. No server and no raw market data, only derived results.",
    stats: [["5", "pages"], ["3", "JSON files"]],
    tools: ["Next.js", "D3", "Motion"],
  },
];

// snake layout: left to right on top, right to left below
const W = 190;
const H = 88;
const SPOTS = [
  [30, 80], [280, 80], [530, 80], [780, 80],
  [780, 290], [530, 290], [280, 290], [30, 290],
];

function edge(i: number) {
  const [ax, ay] = SPOTS[i];
  const [bx, by] = SPOTS[i + 1];
  if (ay !== by) return `M ${ax + W / 2} ${ay + H} L ${bx + W / 2} ${by - 6}`;
  return bx > ax
    ? `M ${ax + W} ${ay + H / 2} L ${bx - 6} ${by + H / 2}`
    : `M ${ax} ${ay + H / 2} L ${bx + W + 6} ${by + H / 2}`;
}

const LIMITS = [
  "Patterns, not proof. A big expiry move is consistent with manipulation but also with ordinary hedging flow.",
  "SEBI orders cited here are interim, not final findings.",
  "One minute candles, not tick data or auction order books, so the auction itself is only seen from the outside.",
  "Only 14 to 15 auction era expiries per index so far, which limits how much the tests can detect.",
];

export default function MethodPage() {
  const [active, setActive] = useState("db");
  const calm = useReducedMotion();
  const stage = STAGES.find((s) => s.id === active) ?? STAGES[0];
  const index = STAGES.indexOf(stage);

  return (
    <main className="mx-auto max-w-6xl px-5 pb-40 pt-10">
      <Brand />

      <h1 className="font-display mt-12 text-4xl font-extrabold leading-tight sm:text-6xl">From raw ticks to a finding.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Eight steps turn an API response into the charts on this site. Every number below comes from the real pipeline.
        Click a step to see what it does.
      </p>

      {/* wide screens: the flow diagram */}
      <div className="mt-10 hidden rounded-3xl border border-line bg-surface p-4 md:block">
        <svg viewBox="0 0 1000 400" className="block w-full" role="group" aria-label="Pipeline, eight steps">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" style={{ fill: "var(--muted)" }} />
            </marker>
          </defs>

          <path d="M 30 50 L 30 40 L 970 40 L 970 50" style={{ fill: "none", stroke: "var(--line)" }} />
          <text x="500" y="30" textAnchor="middle" style={{ fill: "var(--muted)", fontSize: 13 }}>
            Steps 1 to 5 run as Dagster assets: 6 assets, 2 blocking checks
          </text>

          {STAGES.slice(0, -1).map((_, i) => (
            <g key={i}>
              <path
                id={`edge-${i}`}
                d={edge(i)}
                markerEnd="url(#arrow)"
                style={{ fill: "none", stroke: "var(--muted)", strokeOpacity: 0.6, strokeWidth: 1.5 }}
              />
              {!calm && (
                <circle r="3.5" style={{ fill: i < 5 ? "var(--teal)" : "var(--orchid)" }}>
                  <animateMotion dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite">
                    <mpath href={`#edge-${i}`} />
                  </animateMotion>
                </circle>
              )}
            </g>
          ))}

          {STAGES.map((s, i) => {
            const [x, y] = SPOTS[i];
            const on = s.id === active;
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`Step ${i + 1}: ${s.title}`}
                onClick={() => setActive(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActive(s.id);
                  }
                }}
                style={{
                  transform: on ? "translateY(-5px)" : "none",
                  transition: "transform 0.25s ease",
                  outline: "none",
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={W}
                  height={H}
                  rx={18}
                  style={{
                    fill: on ? "var(--raised)" : "var(--bg)",
                    stroke: on ? "var(--amber)" : "var(--line)",
                    strokeWidth: on ? 2.5 : 1.5,
                    filter: on ? "drop-shadow(0 10px 18px rgba(0,0,0,0.25))" : "none",
                  }}
                />
                <text x={x + 20} y={y + 32} style={{ fill: on ? "var(--amber)" : "var(--muted)", fontSize: 13, fontWeight: 600 }}>
                  {String(i + 1).padStart(2, "0")} {s.kicker}
                </text>
                <text x={x + 20} y={y + 62} className="font-display" style={{ fill: "var(--text)", fontSize: 19, fontWeight: 700 }}>
                  {s.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* small screens: the same steps as a list */}
      <ol className="mt-10 grid gap-2 md:hidden">
        {STAGES.map((s, i) => (
          <li key={s.id}>
            <button
              onClick={() => setActive(s.id)}
              aria-pressed={s.id === active}
              className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left ${
                s.id === active ? "border-amber bg-raised" : "border-line bg-surface"
              }`}
            >
              <span className="text-sm font-semibold text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-display text-lg font-bold">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.section
          key={stage.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22 }}
          aria-live="polite"
          className="mt-6 grid gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]"
        >
          <div>
            <p className="text-sm font-semibold text-amber">
              Step {String(index + 1).padStart(2, "0")}, {stage.kicker}
            </p>
            <h2 className="font-display mt-1 text-3xl font-extrabold">{stage.title}</h2>
            <p className="mt-4 leading-relaxed text-muted">{stage.text}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {stage.tools.map((t) => (
                <span key={t} className="rounded-full border border-line px-3 py-1 text-sm text-muted">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-start">
            {stage.stats.map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-raised p-4">
                <p className="font-display text-2xl font-extrabold">{value}</p>
                <p className="mt-1 text-sm text-muted">{label}</p>
              </div>
            ))}
          </div>
        </motion.section>
      </AnimatePresence>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">What this can and cannot say</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {LIMITS.map((l) => (
            <li key={l} className="rounded-2xl border border-line bg-surface p-5 leading-relaxed text-muted">
              {l}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
