// ExpiryLab in the browser: the model from research/expirylab.py and
// research/expirylab_attack.py, ported so visitors can run it themselves.
// Nifty calibration. All levels are in bps relative to the 15:00 index level.

export const MINUTES = 30; // 15:00 to 15:30
export const MARK = 14; // the 15:14 candle the late move is measured from
export const VOL = { vwap: 3.55, auction: 2.38 }; // real per-minute volatility, bps
export const AUCTION_JUMP = 14.8; // extra auction noise, fitted to real late moves
export const IMPACT = 1; // bps per unit at the moment it trades
export const DECAY = 5; // minutes for a push to fade to about a third

export type Rule = "vwap" | "auction";
export type Setup = { budget: number; start: number; depth: number };

// seeded random numbers (mulberry32), so the same settings always draw the same days
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// standard normal draw (Box-Muller)
export function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

// relative volume per minute, rising towards the close
export function volumeCurve(): number[] {
  return Array.from({ length: MINUTES }, (_, i) => 1 + 2 * ((i + 1) / MINUTES) ** 2);
}

// extra index level each minute from buying the budget evenly from `start` to 15:30
export function push(budget: number, start: number): number[] {
  const each = budget / (MINUTES - start + 1);
  return Array.from({ length: MINUTES + 1 }, (_, t) => {
    let lift = 0;
    for (let s = start; s <= t; s++) lift += each * Math.exp(-(t - s) / DECAY);
    return IMPACT * lift;
  });
}

export function vwap(path: number[]): number {
  const volume = volumeCurve();
  let paid = 0;
  let traded = 0;
  for (let m = 1; m <= MINUTES; m++) {
    paid += path[m] * volume[m - 1];
    traded += volume[m - 1];
  }
  return paid / traded;
}

// how far each rule's settlement moves, and how much of that the late-move metric can see
export function footprint({ budget, start, depth }: Setup) {
  const lift = push(budget, start);
  const vwapMoved = vwap(lift);
  return {
    lift,
    vwapMoved,
    vwapSeen: vwapMoved - lift[MARK],
    auctionMoved: (IMPACT * budget) / depth,
  };
}

// one simulated day: the honest path, plus the late move under one rule
export function simulateDay(rule: Rule, lift: number[] | null, auctionPush: number, rand: () => number) {
  const vol = VOL[rule];
  const path = [0];
  for (let m = 1; m <= MINUTES; m++) path.push(path[m - 1] + vol * gauss(rand));
  if (rule === "vwap") {
    const pushed = lift ? path.map((p, m) => p + lift[m]) : path;
    return { path: pushed, settle: vwap(pushed) };
  }
  const end = 28 + Math.floor(rand() * 3); // auction ends at 15:28, 15:29 or 15:30
  return { path, settle: path[end] + AUCTION_JUMP * gauss(rand) + auctionPush };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// one-sided permutation test on the median gap, as in research/late_move_test.py
function permutationP(values: number[], isExpiry: boolean[], shuffles: number, rand: () => number) {
  const gap = (labels: boolean[]) =>
    median(values.filter((_, i) => labels[i])) - median(values.filter((_, i) => !labels[i]));
  const observed = gap(isExpiry);
  const labels = [...isExpiry];
  let asBig = 0;
  for (let k = 0; k < shuffles; k++) {
    for (let i = labels.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [labels[i], labels[j]] = [labels[j], labels[i]];
    }
    if (gap(labels) >= observed) asBig++;
  }
  return (asBig + 1) / (shuffles + 1);
}

// how often the size test and the sign test would catch this manipulator
export function catchRates(
  rule: Rule,
  setup: Setup,
  nNormal: number,
  nExpiry: number,
  { trials = 100, shuffles = 499, seed = 42 } = {},
) {
  const rand = seeded(seed);
  const { lift, auctionMoved } = footprint(setup);
  const isExpiry = [...Array(nNormal).fill(false), ...Array(nExpiry).fill(true)];
  let bySize = 0;
  let bySign = 0;
  for (let t = 0; t < trials; t++) {
    const late: number[] = [];
    for (let i = 0; i < nNormal + nExpiry; i++) {
      const attacked = i >= nNormal;
      const day = simulateDay(rule, attacked ? lift : null, attacked ? auctionMoved : 0, rand);
      late.push(day.settle - day.path[MARK]);
    }
    if (permutationP(late.map(Math.abs), isExpiry, shuffles, rand) < 0.01) bySize++;
    if (permutationP(late, isExpiry, shuffles, rand) < 0.01) bySign++;
  }
  return { size: bySize / trials, sign: bySign / trials };
}
