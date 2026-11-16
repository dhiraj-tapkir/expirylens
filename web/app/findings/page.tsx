"use client";

import { useCallback, useState } from "react";
import Brand from "@/components/Brand";
import GroupedBars from "@/components/charts/GroupedBars";
import Strip from "@/components/charts/Strip";
import { CHECKS, INDEX_LABEL, P_BAR, REGIME_LABEL, ROBUSTNESS, findings } from "@/lib/data";

const rows = findings();

// where a p-value sits on a log scale from 0.0001 to 1
function PMeter({ p, eraColor }: { p: number; eraColor: string }) {
  const W = 300;
  const pos = (v: number) => Math.max(0, Math.min(W, ((Math.log10(v) + 4) / 4) * W));
  const pass = p < P_BAR;
  return (
    <svg viewBox={`0 0 ${W} 48`} className="w-full" role="img" aria-label={`p-value ${p} against the ${P_BAR} threshold`}>
      <rect x="0" y="16" width={W} height="10" rx="5" style={{ fill: "var(--line)" }} />
      <rect x="0" y="16" width={pos(P_BAR)} height="10" rx="5" style={{ fill: eraColor, opacity: 0.3 }} />
      <line x1={pos(P_BAR)} x2={pos(P_BAR)} y1="8" y2="34" style={{ stroke: "var(--text)" }} strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx={pos(p)} cy="21" r="8" style={{ fill: pass ? "var(--teal)" : "var(--amber)" }} />
      <text x="0" y="46" style={{ fill: "var(--muted)", fontSize: 11 }}>0.0001</text>
      <text x={pos(P_BAR) - 12} y="46" style={{ fill: "var(--muted)", fontSize: 11 }}>{P_BAR}</text>
      <text x={W - 16} y="46" style={{ fill: "var(--muted)", fontSize: 11 }}>1</text>
    </svg>
  );
}

export default function Findings() {
  const [selected, setSelected] = useState("SENSEX|CAS");
  const onSelect = useCallback((key: string) => setSelected(key), []);
  const f = rows.find((r) => r.key === selected) ?? rows[0];
  const eraColor = f.regime === "CAS" ? "var(--orchid)" : "var(--teal)";
  const pass = f.p < P_BAR;

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-10 px-6 pb-40 pt-10 md:px-8">
      <Brand />

      <section className="flex max-w-[820px] flex-col gap-4">
        <h1 className="m-0 text-[clamp(40px,5.5vw,68px)] font-extrabold leading-none">
          The two indices reacted in opposite ways.
        </h1>
        <p className="m-0 max-w-[680px] text-lg leading-relaxed text-muted">
          Median size of the move from 15:14 to the close, in basis points. Click any pair of bars to see its
          test result and every day behind it.
        </p>
      </section>

      <div className="flex flex-wrap items-stretch gap-6">
        <div className="min-w-0 flex-[999_1_560px] rounded-3xl border border-line bg-surface p-5">
          <div className="mb-3 flex flex-wrap gap-5 text-sm text-muted">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: "var(--neutral-bar)" }} />Normal days
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-amber" />Expiry days
            </span>
          </div>
          <GroupedBars rows={rows} selected={selected} onSelect={onSelect} />
        </div>

        <aside
          aria-live="polite"
          className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 rounded-3xl border bg-raised p-7"
          style={{ borderColor: eraColor, boxShadow: "var(--shadow)" }}
        >
          <div>
            <p className="m-0 text-sm font-semibold" style={{ color: eraColor }}>{REGIME_LABEL[f.regime]}</p>
            <h2 className="m-0 text-3xl font-extrabold">{INDEX_LABEL[f.index]}</h2>
          </div>
          <dl className="m-0 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted">Expiry vs normal</dt>
              <dd className="m-0 font-display text-4xl font-extrabold text-amber">{(f.expiry / f.normal).toFixed(1)}x</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Gap</dt>
              <dd className="m-0 font-display text-4xl font-extrabold">+{(f.expiry - f.normal).toFixed(1)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Expiries in sample</dt>
              <dd className="m-0 text-xl font-semibold">{f.expiries}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">p-value</dt>
              <dd className="m-0 text-xl font-semibold">{f.p}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2">
            <p className="m-0 text-sm text-muted">Where p sits against the {P_BAR} bar</p>
            <PMeter p={f.p} eraColor={eraColor} />
          </div>
          <p
            className="m-0 rounded-xl bg-bg px-4 py-3 font-semibold"
            style={{ color: pass ? "var(--teal)" : "var(--amber)" }}
          >
            {pass ? `Significant: passes the ${P_BAR} bar.` : `Not significant at the ${P_BAR} bar.`}
          </p>
          <p className="m-0 leading-relaxed text-muted">{f.note}</p>
        </aside>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-2xl font-bold">
          Every day behind {INDEX_LABEL[f.index]}, {REGIME_LABEL[f.regime].replace("Auction", "auction")}
        </h2>
        <p className="m-0 text-muted">Each dot is one day. Hover for details, click to open it in Explorer.</p>
        <div className="rounded-3xl border border-line bg-surface p-4">
          <Strip finding={f} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-2xl font-bold">How solid is each result?</h2>
        <p className="m-0 max-w-[760px] text-muted">
          The same test, rerun with the shakiest days taken out. A result worth trusting keeps passing. Click a test
          to select it above.
        </p>
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="text-sm text-muted">
                <th className="px-5 py-4 font-medium">Test</th>
                {CHECKS.map((c) => (
                  <th key={c.id} className="px-5 py-4 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = r.key === selected;
                return (
                  <tr
                    key={r.key}
                    onClick={() => onSelect(r.key)}
                    className={`border-t border-line transition-colors ${on ? "bg-raised" : "hover:bg-raised"}`}
                  >
                    <th scope="row" className="px-5 py-4">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(r.key);
                        }}
                        className="text-left font-semibold"
                      >
                        {INDEX_LABEL[r.index]}
                        <span
                          className="block text-sm font-normal"
                          style={{ color: r.regime === "CAS" ? "var(--orchid)" : "var(--teal)" }}
                        >
                          {REGIME_LABEL[r.regime]}
                        </span>
                      </button>
                    </th>
                    {CHECKS.map((c) => {
                      const check = ROBUSTNESS[r.key]?.[c.id];
                      if (!check) {
                        return (
                          <td key={c.id} className="px-5 py-4 text-sm text-muted">
                            Not applicable
                          </td>
                        );
                      }
                      const ok = check.p < P_BAR;
                      return (
                        <td key={c.id} className="px-5 py-4">
                          <span className="flex items-center gap-2 font-semibold">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: ok ? "var(--teal)" : "var(--amber)" }}
                            />
                            p {check.p.toFixed(4)}
                          </span>
                          <span className="text-sm text-muted">
                            gap {check.gap > 0 ? "+" : ""}
                            {check.gap.toFixed(1)} bps
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="m-0 text-sm text-muted">
          Teal passes the {P_BAR} bar, amber does not. The first-week check only applies to the auction era. Small
          differences in p between runs (around 0.001) are shuffle noise.
        </p>
      </section>

      <p className="m-0 max-w-[760px] text-sm leading-relaxed text-muted">
        Patterns, not proof of manipulation. Hedging flows and differences between the two exchanges&apos; auctions
        could also explain them. Permutation tests use 10,000 shuffles with a fixed seed; with five tests the bar is
        p below {P_BAR}.
      </p>
    </main>
  );
}
