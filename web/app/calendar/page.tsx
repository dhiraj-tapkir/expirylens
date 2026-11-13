"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Brand from "@/components/Brand";
import Heatmap, { strength } from "@/components/charts/Heatmap";
import {
  days,
  expiries,
  formatBps,
  formatDay,
  INDEX_LABEL,
  percentile,
  REGIME_LABEL,
  type Day,
  type IndexName,
} from "@/lib/data";

const INDICES: IndexName[] = ["NIFTY", "SENSEX"];
const SWATCHES = [0, 5, 10, 20, 30];

export default function CalendarPage() {
  const [selected, setSelected] = useState<Day | null>(null);

  // Escape closes the floating card
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-5 pb-40 pt-10">
      <Brand />

      <h1 className="font-display mt-12 text-4xl font-extrabold leading-tight sm:text-6xl">
        One square for every close.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Stronger squares moved more between 15:14 and the close. Amber outlines mark expiry days, dashed squares are
        weekdays with no session, and the orchid wash is the closing auction era. Click any square.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted">
        <span className="flex items-center gap-2">
          Smaller
          {SWATCHES.map((s) => (
            <span
              key={s}
              className="h-3.5 w-3.5 rounded-[3px] bg-text"
              style={{ opacity: strength(s) }}
              title={`${s} bps`}
            />
          ))}
          Bigger (30+ bps)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-[3px] border-2 border-amber" />
          Expiry day
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-[3px] border border-dashed border-muted" />
          No session
        </span>
      </div>

      {INDICES.map((ix) => (
        <section key={ix} className="mt-8 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold">{INDEX_LABEL[ix]}</h2>
            <span className="text-sm text-muted">
              {days.filter((d) => d.index_name === ix).length} sessions,{" "}
              {expiries.filter((e) => e.index_name === ix).length} expiries
            </span>
          </div>
          <Heatmap index={ix} selected={selected} onSelect={setSelected} />
        </section>
      ))}

      <AnimatePresence>{selected && <DayCard key="card" day={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </main>
  );
}

function DayCard({ day, onClose }: { day: Day; onClose: () => void }) {
  const accent = day.regime === "CAS" ? "var(--orchid)" : "var(--teal)";
  return (
    <motion.aside
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 28, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.65, 0, 0.35, 1] }}
      aria-live="polite"
      className="fixed bottom-28 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-3xl border-2 bg-raised p-5 sm:right-8"
      style={{ borderColor: accent, boxShadow: "var(--shadow)" }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-3 rounded-full px-2 text-xl leading-none text-muted hover:text-text"
      >
        ×
      </button>
      <p className="text-sm font-semibold" style={{ color: accent }}>
        {REGIME_LABEL[day.regime]}
        {day.is_expiry ? ", expiry day" : ""}
      </p>
      <p className="font-display mt-1 text-xl font-extrabold">{formatDay(day.day)}</p>
      <p className="text-sm text-muted">{INDEX_LABEL[day.index_name]}</p>
      <p
        className="font-display mt-4 text-4xl font-extrabold"
        style={{ color: day.is_expiry ? "var(--amber)" : "var(--text)" }}
      >
        {formatBps(day.late_move_bps)}
      </p>
      <p className="mt-1 text-sm text-muted">
        Bigger than {percentile(day)}% of {REGIME_LABEL[day.regime].replace("Auction", "auction")} days
      </p>
      <Link
        href={`/explorer?index=${day.index_name}&day=${day.day}`}
        className="mt-5 inline-flex rounded-full bg-text px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
      >
        Open in Explorer →
      </Link>
    </motion.aside>
  );
}
