"use client";

import Link from "next/link";
import { useState } from "react";
import Swarm from "@/components/charts/Swarm";
import Brand from "@/components/Brand";
import { IndexName, days, expiries, findings } from "@/lib/data";

function Legend() {
  const items = [
    { label: "VWAP era day", color: "var(--teal)", r: 4 },
    { label: "Closing auction era day", color: "var(--orchid)", r: 4 },
    { label: "Expiry day", color: "var(--amber)", r: 5 },
  ];
  return (
    <div className="flex flex-wrap gap-5 text-sm text-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r={item.r} fill={item.color} />
          </svg>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function Overview() {
  const [index, setIndex] = useState<IndexName>("SENSEX");
  const rows = findings();
  const niftyVwap = rows.find((r) => r.key === "NIFTY|VWAP_PRE");
  const sensexCas = rows.find((r) => r.key === "SENSEX|CAS");

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-10 px-6 pb-40 pt-10 md:px-8">
      <Brand />

      <section className="flex max-w-[900px] flex-col gap-5">
        <h1 className="m-0 whitespace-pre-line text-[clamp(48px,7vw,92px)] font-extrabold leading-[0.95]">
          {`${days.length} trading days.\nTwo ways to settle.`}
        </h1>
        <p className="m-0 max-w-[640px] text-lg leading-relaxed text-muted">
          India moved index expiry settlement from a 30-minute VWAP to a closing auction on 3 Aug 2026.
          Each dot below is one trading day&apos;s late move: how far the index travelled from 15:14 to the
          close. Watch where the expiry days land.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Choose index" className="flex gap-1 rounded-full border border-line p-1">
            {(["SENSEX", "NIFTY"] as IndexName[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === index}
                onClick={() => setIndex(k)}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${
                  k === index ? "bg-text text-bg" : "text-text hover:bg-raised"
                }`}
              >
                {k === "NIFTY" ? "Nifty 50" : "Sensex"}
              </button>
            ))}
          </div>
          <Legend />
        </div>
        <div className="overflow-hidden rounded-3xl border border-line bg-surface p-3">
          <Swarm index={index} />
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/explorer"
          className="inline-flex min-h-12 items-center rounded-full bg-teal px-6 font-semibold text-[var(--on-accent)] no-underline"
        >
          Explore every day
        </Link>
        <Link
          href="/findings"
          className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-semibold text-text no-underline hover:bg-raised"
        >
          Read the findings
        </Link>
      </div>

      <section className="grid gap-8 border-t border-line pt-8 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="font-display text-4xl font-extrabold text-teal">
            {niftyVwap ? (niftyVwap.expiry / niftyVwap.normal).toFixed(1) : "?"}x
          </span>
          <p className="m-0 leading-relaxed">
            Nifty expiry days moved this much more than normal days at the close under VWAP settlement.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-display text-4xl font-extrabold text-orchid">
            {sensexCas ? (sensexCas.expiry / sensexCas.normal).toFixed(1) : "?"}x
          </span>
          <p className="m-0 leading-relaxed">
            Sensex expiry days moved this much more than normal days once the closing auction began.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-display text-4xl font-extrabold text-amber">{expiries.length}</span>
          <p className="m-0 leading-relaxed">Expiries studied across both indices, from September 2025 to November 2026.</p>
        </div>
      </section>
    </main>
  );
}
