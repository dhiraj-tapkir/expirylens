# Design decisions

Why ExpiryLens is built the way it is, and what each choice costs.

## Data

**TimescaleDB, not plain files or a general database.** Minute candles are
time series; a hypertable splits them into weekly chunks so date-range queries
stay fast as data grows, and it is still PostgreSQL, so plain SQL works.
Trade-off: one more service to run (in Docker).

**Raw files first, database second.** Every API pull lands as Parquet before
loading, so a bad load can be replayed without calling the API again.
Trade-off: some duplicated storage.

**Idempotent loads through a staging table.** Loading the same file twice
changes nothing (insert, skip conflicts). Pipelines get rerun; they should be
safe to rerun. Trade-off: slightly more SQL than a plain insert.

**Quarantine instead of delete.** Prints outside market hours go to a
quarantine table with a reason. Deleting hides evidence; loading them corrupts
the metrics. Trade-off: one more table to explain.

**Data contracts that block.** Pandera checks every candle before it reaches
the database, as a blocking Dagster check. A pipeline that loads bad data
quietly is worse than one that stops. Trade-off: a strict contract can block
on an edge case that turns out to be valid.

**Expiry calendar derived from the data.** Expiries are the last trading day
on or before the scheduled weekday, worked out from the days that actually
traded, so holidays move expiries automatically. Trade-off: it needs checking
against the official holiday list.

## Research

**Medians, not means.** Late moves have fat tails (a few 50+ bps days); one
extreme day can drag a mean, not a median.

**Permutation tests, not t-tests.** They make no assumption about the shape of
the distribution, which suits fat-tailed, small samples. Trade-off: slower,
and the p-value carries a little shuffle noise.

**A strict bar with Bonferroni.** Five main tests, so a result needs p below
0.01, not 0.05. Fewer false discoveries, at the cost of missing small effects.

**Robustness and power checks before claims.** Burn-in, event-day, signed and
power checks are run and published, including those that weaken a headline.
A result that survives them can be trusted; one that does not is reported as
fragile.

**A calibrated simulator to test the detectors.** ExpiryLab plants known
manipulations to measure what each test can and cannot see. It is calibrated
to real volatility, and the VWAP rule matches reality with no tuning.
Trade-off: price impact cannot be measured from index data, so impact numbers
are illustrative.

## Serving

**A static site, not a server.** The dashboard is plain files on GitHub Pages:
free, fast, nothing to hack. Only derived results are published, never raw
market data. Trade-off: data updates need a rebuild and redeploy.

**The simulator runs in the browser.** The model is ported to TypeScript and
checked against Python to four decimals; heavy work runs in Web Workers so the
page never freezes. Trade-off: two implementations to keep in step, guarded by
a check script.

**CI on every push.** Lint, format and 25 tests run on GitHub Actions, and the
site deploys only if its build passes.
