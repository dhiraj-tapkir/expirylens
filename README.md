# ExpiryLens

[![tests](https://github.com/dhiraj-tapkir/expirylens/actions/workflows/tests.yml/badge.svg)](https://github.com/dhiraj-tapkir/expirylens/actions/workflows/tests.yml)

Measuring how India's index expiry-day closes behave, and how that changed when
settlement moved from a 30-minute VWAP to a closing auction in August 2026.
Built only on public market data.

## Key findings so far

Late move = how far the index moves from the 15:14 candle (the last minute
before the closing auction freezes the index) to the day's final close.
Median absolute late move, in basis points:

| Index | Settlement regime | Normal days | Expiry days | Gap | p-value |
|---|---|---|---|---|---|
| Nifty 50 | VWAP (Sep 2025 to Jul 2026) | 4.3 | 7.7 | +3.3 | 0.0012 |
| Nifty 50 | Closing auction (Aug to Nov 2026) | 11.8 | 14.3 | +2.5 | 0.27 |
| Sensex | VWAP (Sep 2025 to Jul 2026) | 5.1 | 6.1 | +0.9 | 0.18 |
| Sensex | Closing auction (Aug to Nov 2026) | 9.1 | 18.4 | +9.4 | 0.0084 |

p-values come from permutation tests (10,000 shuffles, fixed seed). With five
tests the bar is p < 0.01.

- **Nifty** shows a clear expiry effect under VWAP settlement that fades after
  the auction started.
- **Sensex** shows the opposite: a weak effect before, roughly double after.
- Leaving out 13 Aug 2026, the Sensex expiry in SEBI's Copthall interim order,
  barely moves the Sensex result (9.4 to 8.9 bps). One day is not driving it.
- During the closing auction the displayed index freezes from 15:15 to about
  15:28, then jumps once. Any "last 30 minutes" metric has to account for this.

These are statistical patterns, not evidence of manipulation. Hedging flows
and differences between the two exchanges' auctions could explain them.
Full notes, dates and open questions: [docs/findings.md](docs/findings.md).

## What's built

- **Ingestion:** a small Upstox client that pulls 1-minute candles a month at a
  time, saves them as Parquet, and loads them into TimescaleDB through a
  staging table. Re-running it never creates duplicates.
- **Data quality:** out-of-session prints on normal days go to a quarantine
  table with a reason, instead of being loaded or deleted. Every row is
  accounted for (rows read = inserted + quarantined).
- **Expiry calendar:** derived in SQL from the days that actually traded, so
  holidays shift expiries automatically. Weeks the data doesn't fully cover yet
  are skipped.
- **Research:** a late-move view, permutation tests per index and regime, and a
  leave-one-out robustness check.
- **Tests:** 5 unit tests that run anywhere, plus 7 data tests against the real
  database (known expiry days, no duplicates, OHLC sanity). CI runs on every
  push.

| | |
|---|---|
| Candles | 221,510 (Nifty 50 and Sensex, Sep 2025 to Nov 2026) |
| Trading days | 297 per index, including 2 Muhurat sessions |
| Expiries | 125 (63 Nifty, 62 Sensex) |
| Quarantined prints | 2 |
| TimescaleDB chunks | 63 weekly chunks |

## Architecture

![ExpiryLens architecture](docs/images/expirylens_architecture.png)

## Data workflow

![ExpiryLens data workflow](docs/images/expirylens_daily_workflow.png)

## Run it yourself

You need Docker, [uv](https://docs.astral.sh/uv/), and a free Upstox account
for an Analytics (read-only) token.

```bash
git clone https://github.com/dhiraj-tapkir/expirylens.git
cd expirylens
uv sync

# secrets live in .env, which git ignores
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > .env
echo "UPSTOX_ACCESS_TOKEN=<your analytics token>" >> .env

# database
docker compose up -d
docker exec -i expirylens-db psql -U expiry -d expirylens < infra/sql/001_init.sql

# data
uv run python -m pipelines.backfill "NSE_INDEX|Nifty 50" 2025-09-01 2026-11-11
uv run python -m pipelines.backfill "BSE_INDEX|SENSEX" 2025-09-01 2026-11-11
uv run python -m pipelines.load_candles data/raw/candles/nse_index_nifty_50.parquet
uv run python -m pipelines.load_candles data/raw/candles/bse_index_sensex.parquet

# calendar, metrics, tests, results
docker exec -i expirylens-db psql -U expiry -d expirylens < infra/sql/002_expiry_calendar.sql
docker exec -i expirylens-db psql -U expiry -d expirylens < infra/sql/003_late_move.sql
uv run pytest -v
uv run python -m research.late_move_test
```

## Repo layout

| Folder | What's in it |
|---|---|
| `pipelines/` | Upstox client, backfill, loader with quarantine, DB helper |
| `infra/sql/` | Schema, expiry calendar, late-move view |
| `research/` | Statistical tests |
| `tests/` | Unit and data tests |
| `docs/` | Findings log and diagrams |
| `api/`, `web/` | Backend and dashboard (coming) |

## Limitations

- 1-minute candles can't show what happens inside the closing auction.
- The last candle of the day is used as the close. Official settlement values
  are not in yet.
- Only 14 to 15 closing-auction expiries per index so far, so the CAS results
  carry wide uncertainty.
- Holidays are inferred from missing trading days and still need checking
  against NSE's official list.
- SEBI's orders referenced here are interim, not final findings.

## Roadmap

- Dagster orchestration and Pandera data contracts
- Official settlement values and Bank Nifty
- Closing-auction depth per exchange, to test why Nifty and Sensex differ
- ExpiryLab: an agent-based simulator with known manipulations, to measure how
  well the detectors actually work
- Counterfactual settlement and rupee-transfer estimates
- FastAPI backend and a public dashboard on GitHub Pages
- Re-run everything once expiries settle on the 30-minute VWAP again (from
  7 Dec 2026)

## Data note

Market data comes from the Upstox API and stays local. Only code and derived
results are published here. This is independent research for learning, not
investment advice.