// One place for the dashboard's data: the exported JSON plus the test results.
import expiriesJson from "@/public/data/expiries.json";
import lateMovesJson from "@/public/data/late_moves.json";
import summaryJson from "@/public/data/summary.json";

export type IndexName = "NIFTY" | "SENSEX";
export type Regime = "VWAP_PRE" | "CAS" | "VWAP_POST";

export type Day = {
  index_name: IndexName;
  day: string; // yyyy-mm-dd
  late_move_bps: number;
  is_expiry: boolean;
  regime: Regime;
};

export type Expiry = { index_name: IndexName; expiry_date: string; settlement_rule: Regime };

export type SummaryRow = {
  index_name: IndexName;
  regime: Regime;
  is_expiry: boolean;
  days: number;
  median_abs_bps: number;
};

export const days = lateMovesJson as Day[];
export const expiries = expiriesJson as Expiry[];
export const summary = summaryJson as SummaryRow[];

export const AUCTION_START = "2026-08-03";

export const INDEX_LABEL: Record<IndexName, string> = { NIFTY: "Nifty 50", SENSEX: "Sensex" };
export const REGIME_LABEL: Record<Regime, string> = {
  VWAP_PRE: "VWAP era",
  CAS: "Auction era",
  VWAP_POST: "VWAP again",
};

// permutation test results from research/late_move_test.py (10,000 shuffles, seed 42)
export const TESTS: Record<string, { p: number; note: string }> = {
  "NIFTY|VWAP_PRE": {
    p: 0.0012,
    note: "Strong evidence. Under VWAP settlement, Nifty expiry days moved clearly more at the close than normal days.",
  },
  "NIFTY|CAS": {
    p: 0.2716,
    note: "The gap shrank and could be chance. With only 15 auction-era expiries the test has little power, so this is not proof the effect vanished.",
  },
  "SENSEX|VWAP_PRE": {
    p: 0.1786,
    note: "No clear expiry effect for Sensex while settlement used the 30-minute VWAP.",
  },
  "SENSEX|CAS": {
    p: 0.0084,
    note: "Holds up without 13 Aug 2026, the expiry in SEBI's Copthall interim order: the gap only moves from 9.4 to 8.9 bps.",
  },
};
export const P_BAR = 0.01; // five tests, Bonferroni

export type Finding = {
  key: string;
  index: IndexName;
  regime: Regime;
  normal: number;
  expiry: number;
  expiries: number;
  p: number;
  note: string;
};

export function findings(): Finding[] {
  const out: Finding[] = [];
  for (const index of ["NIFTY", "SENSEX"] as IndexName[]) {
    for (const regime of ["VWAP_PRE", "CAS"] as Regime[]) {
      const normal = summary.find((r) => r.index_name === index && r.regime === regime && !r.is_expiry);
      const expiry = summary.find((r) => r.index_name === index && r.regime === regime && r.is_expiry);
      const test = TESTS[`${index}|${regime}`];
      if (!normal || !expiry || !test) continue;
      out.push({
        key: `${index}|${regime}`,
        index,
        regime,
        normal: normal.median_abs_bps,
        expiry: expiry.median_abs_bps,
        expiries: expiry.days,
        p: test.p,
        note: test.note,
      });
    }
  }
  return out;
}

// share of days in the same index and era with a smaller absolute move
export function percentile(target: Day): number {
  const peers = days.filter((d) => d.index_name === target.index_name && d.regime === target.regime);
  const smaller = peers.filter((d) => Math.abs(d.late_move_bps) < Math.abs(target.late_move_bps)).length;
  return Math.round((100 * smaller) / peers.length);
}

export function formatBps(bps: number): string {
  return `${bps > 0 ? "+" : ""}${bps.toFixed(1)} bps`;
}

export function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
