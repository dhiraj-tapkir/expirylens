"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Brand from "@/components/Brand";
import Scatter from "@/components/charts/Scatter";
import {
  days,
  formatBps,
  formatDay,
  INDEX_LABEL,
  percentile,
  REGIME_LABEL,
  type Day,
  type IndexName,
  type Regime,
} from "@/lib/data";

type Era = "ALL" | Regime;

const ERAS: Era[] = ["ALL", "VWAP_PRE", "CAS", ...(days.some((d) => d.regime === "VWAP_POST") ? (["VWAP_POST"] as Era[]) : [])];
const sameDay = (a: Day | null, b: Day) => a !== null && a.day === b.day && a.index_name === b.index_name;

// reading the URL needs Suspense when the site is exported as static files
export default function ExplorerPage() {
  return (
    <Suspense fallback={null}>
      <Explorer />
    </Suspense>
  );
}

function Explorer() {
  const params = useSearchParams();
  const [index, setIndex] = useState<IndexName>(params.get("index") === "SENSEX" ? "SENSEX" : "NIFTY");
  const [focus] = useState<Day | null>(
    () => days.find((d) => d.index_name === index && d.day === params.get("day")) ?? null,
  );
  const [selected, setSelected] = useState<Day | null>(focus);
  const [era, setEra] = useState<Era>("ALL");
  const [expiryOnly, setExpiryOnly] = useState(false);

  const data = useMemo(
    () =>
      days.filter(
        (d) => d.index_name === index && (era === "ALL" || d.regime === era) && (!expiryOnly || d.is_expiry),
      ),
    [index, era, expiryOnly],
  );
  const largest = useMemo(
    () => [...data].sort((a, b) => Math.abs(b.late_move_bps) - Math.abs(a.late_move_bps)).slice(0, 8),
    [data],
  );
  const expiryCount = data.filter((d) => d.is_expiry).length;

  // keep the URL shareable without a full page navigation
  const choose = useCallback((d: Day) => {
    setSelected(d);
    window.history.replaceState(null, "", `?index=${d.index_name}&day=${d.day}`);
  }, []);

  const switchIndex = (next: IndexName) => {
    setIndex(next);
    setSelected(null);
    window.history.replaceState(null, "", `?index=${next}`);
  };

  return (
    <main className="mx-auto max-w-6xl px-5 pb-40 pt-10">
      <Brand />

      <h1 className="font-display mt-12 text-4xl font-extrabold leading-tight sm:text-6xl">Every close, up close.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Each dot is one trading day: how far the index moved between 15:14 and the final close. Drag to pan, pinch
        or hold ⌘ while scrolling to zoom, and click any dot for the full story.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Segment
          label="Index"
          value={index}
          onChange={switchIndex}
          options={[
            { id: "NIFTY", text: "Nifty 50" },
            { id: "SENSEX", text: "Sensex" },
          ]}
        />
        <Segment
          label="Era"
          value={era}
          onChange={setEra}
          options={ERAS.map((e) => ({ id: e, text: e === "ALL" ? "All eras" : REGIME_LABEL[e] }))}
        />
        <button
          aria-pressed={expiryOnly}
          onClick={() => setExpiryOnly((v) => !v)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            expiryOnly ? "border-amber bg-amber text-bg" : "border-line bg-surface text-muted hover:text-text"
          }`}
        >
          Expiry days only
        </button>
        <span className="ml-auto text-sm text-muted">
          {data.length} days, {expiryCount} expiries
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 rounded-3xl border border-line bg-surface p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap gap-5 text-sm text-muted">
            <Key colour="var(--teal)" text="Normal day, VWAP era" />
            <Key colour="var(--orchid)" text="Normal day, auction era" />
            <Key colour="var(--amber)" text="Expiry day" />
          </div>
          <Scatter data={data} selected={selected} focus={focus} onSelect={choose} />
        </div>
        <Detail day={selected} />
      </div>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Largest late moves in view</h2>
        <p className="mt-1 text-muted">Ranked by size in either direction. Click one to pin it on the chart.</p>
        <ol className="mt-6 grid gap-2 sm:grid-cols-2">
          {largest.map((d, i) => (
            <li key={d.day}>
              <button
                onClick={() => choose(d)}
                className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  sameDay(selected, d) ? "border-text bg-raised" : "border-line bg-surface hover:border-muted"
                }`}
              >
                <span className="w-5 text-sm text-muted">{i + 1}</span>
                <span className="flex-1">
                  <span className="block font-medium">{formatDay(d.day)}</span>
                  <span className="text-xs text-muted">
                    {REGIME_LABEL[d.regime]}
                    {d.is_expiry ? ", expiry" : ""}
                  </span>
                </span>
                <span
                  className="font-display text-lg font-bold"
                  style={{ color: d.is_expiry ? "var(--amber)" : "var(--text)" }}
                >
                  {formatBps(d.late_move_bps)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Segment<T extends string>(props: {
  label: string;
  value: T;
  options: { id: T; text: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={props.label} className="flex rounded-full border border-line bg-surface p-1">
      {props.options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={props.value === o.id}
          onClick={() => props.onChange(o.id)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            props.value === o.id ? "bg-text text-bg" : "text-muted hover:text-text"
          }`}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

function Key({ colour, text }: { colour: string; text: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
      {text}
    </span>
  );
}

function Detail({ day }: { day: Day | null }) {
  if (!day) {
    return (
      <aside className="rounded-3xl border border-line bg-surface p-6 lg:sticky lg:top-8 lg:self-start">
        <p className="font-display text-xl font-bold">Pick a day</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Click any dot, or a row in the list below, to see how that close played out.
        </p>
      </aside>
    );
  }

  const share = percentile(day);
  const accent = day.regime === "CAS" ? "var(--orchid)" : "var(--teal)";
  const rule =
    day.regime === "CAS"
      ? "Closing auction: orders were collected from 15:15 and the close was set by a call auction ending at a random moment near 15:30."
      : "VWAP settlement: the close was the volume weighted average price of the last 30 minutes of trading.";

  return (
    <aside
      aria-live="polite"
      className="rounded-3xl border-2 bg-surface p-6 lg:sticky lg:top-8 lg:self-start"
      style={{ borderColor: accent }}
    >
      <p className="text-sm font-semibold" style={{ color: accent }}>
        {REGIME_LABEL[day.regime]}
        {day.is_expiry ? ", expiry day" : ""}
      </p>
      <h2 className="font-display mt-1 text-2xl font-extrabold">{formatDay(day.day)}</h2>
      <p className="text-sm text-muted">{INDEX_LABEL[day.index_name]}</p>

      <p className="mt-6 text-sm text-muted">Move from 15:14 to the close</p>
      <p
        className="font-display text-5xl font-extrabold"
        style={{ color: day.is_expiry ? "var(--amber)" : "var(--text)" }}
      >
        {formatBps(day.late_move_bps)}
      </p>

      <p className="mt-6 text-sm text-muted">
        Bigger than {share}% of {REGIME_LABEL[day.regime].replace("Auction", "auction")} days for this index
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised">
        <div className="h-2 rounded-full" style={{ width: `${share}%`, background: accent }} />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted">{rule}</p>
    </aside>
  );
}
