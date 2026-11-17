// Checks that the browser port of ExpiryLab matches the Python model.
// Run with: node web/scripts/check-lab.mjs
import { catchRates, footprint } from "../lib/lab.ts";

// exact values from research/expirylab_attack.py
const expected = [
  { start: 1, moved: 4.9728, seen: -0.2084 },
  { start: 15, moved: 5.4498, seen: 5.4498 },
  { start: 25, moved: 4.2502, seen: 4.2502 },
];

let ok = true;
for (const { start, moved, seen } of expected) {
  const f = footprint({ budget: 30, start, depth: 1 });
  const match = Math.abs(f.vwapMoved - moved) < 1e-3 && Math.abs(f.vwapSeen - seen) < 1e-3;
  ok &&= match;
  console.log(
    `buy from minute ${start}: moved ${f.vwapMoved.toFixed(4)} (python ${moved}),`,
    `seen ${f.vwapSeen.toFixed(4)} (python ${seen}) ${match ? "ok" : "MISMATCH"}`,
  );
}

const t0 = performance.now();
const rates = catchRates("vwap", { budget: 30, start: 15, depth: 1 }, 178, 48);
const ms = Math.round(performance.now() - t0);
console.log(`VWAP push from 15:15, 48 expiries: size ${rates.size}, sign ${rates.sign} (${ms} ms)`);
console.log("python said about: size 0.31, sign 0.96");

process.exit(ok ? 0 : 1);
