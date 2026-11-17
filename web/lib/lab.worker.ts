// Runs the ExpiryLab detection studies off the main thread, so sliders stay smooth.
import { catchRates, type Rule, type Setup } from "./lab";

type Job = { id: number; rule: Rule; setup: Setup; nNormal: number; nExpiry: number };

const worker = globalThis as unknown as Worker;

worker.onmessage = (event: MessageEvent<Job>) => {
  const { id, rule, setup, nNormal, nExpiry } = event.data;
  worker.postMessage({ id, rule, ...catchRates(rule, setup, nNormal, nExpiry) });
};
