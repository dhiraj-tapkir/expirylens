"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Brand from "@/components/Brand";
import PushChart from "@/components/charts/PushChart";
import { footprint, type Rule } from "@/lib/lab";

const DEPTHS = [1, 2, 3, 5, 10];
const SAMPLES = {
  vwapEra: { label: "48 expiries", hint: "like the VWAP era", nNormal: 178, nExpiry: 48 },
  auctionEra: { label: "15 expiries", hint: "like the auction era", nNormal: 54, nExpiry: 15 },
};
type SampleKey = keyof typeof SAMPLES;
type Rates = Record<Rule, { size: number; sign: number } | undefined>;

const clock = (minute: number) => `15:${String(minute).padStart(2, "0")}`;

export default function LabPage() {
  const [budget, setBudget] = useState(30);
  const [start, setStart] = useState(15);
  const [depth, setDepth] = useState(3);
  const [sample, setSample] = useState<SampleKey>("vwapEra");
  const [rates, setRates] = useState<Rates>({ vwap: undefined, auction: undefined });
  const [running, setRunning] = useState(false);

  const workers = useRef<Partial<Record<Rule, Worker>>>({});
  const job = useRef(0);

  const f = useMemo(() => footprint({ budget, start, depth }), [budget, start, depth]);

  // one worker per rule, so both studies run side by side off the main thread
  useEffect(() => {
    const onResult = (event: MessageEvent) => {
      const { id, rule, size, sign } = event.data;
      if (id !== job.current) return; // an older run, the settings have changed since
      setRates((r) => {
        const next = { ...r, [rule]: { size, sign } };
        if (next.vwap && next.auction) setRunning(false);
        return next;
      });
    };
    const made: Partial<Record<Rule, Worker>> = {};
    for (const rule of ["vwap", "auction"] as Rule[]) {
      made[rule] = new Worker(new URL("../../lib/lab.worker.ts", import.meta.url));
      made[rule].onmessage = onResult;
    }
    workers.current = made;
    return () => Object.values(made).forEach((w) => w.terminate());
  }, []);

  // any change to the settings makes old detection results stale
  useEffect(() => {
    job.current += 1;
    setRates({ vwap: undefined, auction: undefined });
    setRunning(false);
  }, [budget, start, depth, sample]);

  const run = () => {
    job.current += 1;
    setRates({ vwap: undefined, auction: undefined });
    setRunning(true);
    const { nNormal, nExpiry } = SAMPLES[sample];
    for (const rule of ["vwap", "auction"] as Rule[]) {
      workers.current[rule]?.postMessage({ id: job.current, rule, setup: { budget, start, depth }, nNormal, nExpiry });
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 pb-40 pt-10">
      <Brand />

      <h1 className="font-display mt-12 text-4xl font-extrabold leading-tight sm:text-6xl">Try to rig the close.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        ExpiryLab simulates the last 30 minutes of a Nifty expiry day, calibrated to the real market. You play the
        manipulator: pick a budget and when to start buying, set how deep the closing auction is, and see how far
        each settlement rule moves and whether the tests on this site would catch you.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[340px_1fr]">
        <section className="flex flex-col gap-7 rounded-3xl border border-line bg-surface p-6" aria-label="Settings">
          <Slider
            label="Budget"
            value={budget}
            min={0}
            max={60}
            step={5}
            display={`${budget} units`}
            note="Bought all at once, each unit would lift the index 1 bps."
            onChange={setBudget}
          />
          <Slider
            label="Start buying at"
            value={start}
            min={1}
            max={29}
            step={1}
            display={clock(start)}
            note="Buying is spread evenly from here to 15:30, and each push fades over a few minutes."
            onChange={setStart}
          />
          <div>
            <p className="text-sm font-semibold">Auction depth</p>
            <p className="mt-1 text-xs text-muted">How much deeper the closing auction is than the market.</p>
            <div role="radiogroup" aria-label="Auction depth" className="mt-3 flex rounded-full border border-line p-1">
              {DEPTHS.map((d) => (
                <button
                  key={d}
                  role="radio"
                  aria-checked={depth === d}
                  onClick={() => setDepth(d)}
                  className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
                    depth === d ? "bg-text text-bg" : "text-muted hover:text-text"
                  }`}
                >
                  {d}x
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <p className="text-sm text-muted">What your buying adds to the index, minute by minute (bps)</p>
          <PushChart lift={f.lift} vwapMoved={f.vwapMoved} auctionMoved={f.auctionMoved} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat colour="var(--teal)" label="VWAP settlement moves" value={`+${f.vwapMoved.toFixed(1)} bps`} />
            <Stat
              colour="var(--amber)"
              label="Of that, seen after 15:14"
              value={`${f.vwapSeen >= 0 ? "+" : ""}${f.vwapSeen.toFixed(1)} bps`}
              note={f.vwapSeen < f.vwapMoved / 2 ? "most of the push is invisible to the late-move test" : undefined}
            />
            <Stat colour="var(--orchid)" label="Auction settlement moves" value={`+${f.auctionMoved.toFixed(1)} bps`} />
          </div>
        </section>
      </div>

      <section className="mt-10 rounded-3xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Would you get caught?</h2>
            <p className="mt-1 max-w-2xl text-muted">
              Runs 100 simulated studies of honest and manipulated days, then applies the two tests: the size test
              used on the real data, and a sign test that looks for upward pushes. Caught means p below 0.01.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Sample size" className="flex rounded-full border border-line p-1">
              {(Object.keys(SAMPLES) as SampleKey[]).map((k) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={sample === k}
                  title={SAMPLES[k].hint}
                  onClick={() => setSample(k)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    sample === k ? "bg-text text-bg" : "text-muted hover:text-text"
                  }`}
                >
                  {SAMPLES[k].label}
                </button>
              ))}
            </div>
            <button
              onClick={run}
              disabled={running}
              className="rounded-full bg-amber px-5 py-2 text-sm font-semibold text-bg disabled:opacity-60"
            >
              {running ? "Running..." : "Run the tests"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {(["vwap", "auction"] as Rule[]).map((rule) => (
            <div key={rule} className="rounded-2xl bg-raised p-5" aria-live="polite">
              <p className="text-sm font-semibold" style={{ color: rule === "vwap" ? "var(--teal)" : "var(--orchid)" }}>
                {rule === "vwap" ? "VWAP settlement" : "Closing auction"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Rate label="Size test" value={rates[rule]?.size} running={running} />
                <Rate label="Sign test" value={rates[rule]?.sign} running={running} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        <Lesson title="The blind spot">
          Start buying at 15:01 and VWAP settlement still moves, but the 15:14 level rises with it, so the late-move
          test sees almost nothing.
        </Lesson>
        <Lesson title="Direction matters">
          A push that always goes the same way is far easier to catch with the sign test than with the size test.
        </Lesson>
        <Lesson title="Depth decides the auction">
          A thin auction is much easier to push than VWAP, a deep one much harder. Index candles cannot tell which
          the real one is.
        </Lesson>
      </section>

      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
        Calibrated to real Nifty per-minute volatility near the close, with an auction jump fitted to real late moves.
        The impact numbers are illustrative, because index candles carry no volume. The same model runs in Python in
        research/expirylab.py and research/expirylab_attack.py, and a check script confirms the two agree.
      </p>
    </main>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  note: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{props.label}</span>
        <span className="font-display text-xl font-bold">{props.display}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[var(--amber)]"
      />
      <span className="mt-1 block text-xs text-muted">{props.note}</span>
    </label>
  );
}

function Stat({ colour, label, value, note }: { colour: string; label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-raised p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-extrabold" style={{ color: colour }}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Rate({ label, value, running }: { label: string; value?: number; running: boolean }) {
  const shown = value === undefined ? (running ? "..." : "-") : `${Math.round(value * 100)}%`;
  const colour = value === undefined ? "var(--muted)" : value >= 0.8 ? "var(--teal)" : "var(--amber)";
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-3xl font-extrabold" style={{ color: colour }}>
        {shown}
      </p>
      <p className="text-xs text-muted">caught</p>
    </div>
  );
}

function Lesson({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}
