"""Dagster pipeline for expirylens.

The asset graph:

    raw_candles_nifty  -> loaded_candles_nifty  \
                                                  -> expiry_calendar -> late_move_view
    raw_candles_sensex -> loaded_candles_sensex /

Each raw_candles asset has a blocking contract check: if a downloaded file
breaks the candle contract, it is not loaded into the database.

run the UI with:
    uv run dagster dev -m pipelines.definitions
"""
from datetime import date, timedelta
from pathlib import Path

import dagster as dg
import pandera.errors
import polars as pl

from pipelines.backfill import RAW_DIR, backfill, slug
from pipelines.contracts import CANDLES
from pipelines.db import connect
from pipelines.load_candles import load_file

INDICES = {
    "nifty": "NSE_INDEX|Nifty 50",
    "sensex": "BSE_INDEX|SENSEX",
}
START = date(2025, 9, 1)  # first month of tuesday nifty expiries
SQL_DIR = Path("infra/sql")


def run_sql_file(name):
    sql = (SQL_DIR / name).read_text()
    with connect() as conn:
        conn.autocommit = True  # the sql files manage their own transactions
        conn.execute(sql)


def make_index_assets(name, instrument_key):
    """Build the download asset, its contract check, and the load asset for one index."""
    path = RAW_DIR / f"{slug(instrument_key)}.parquet"

    @dg.asset(name=f"raw_candles_{name}", group_name="ingest")
    def raw_candles() -> dg.MaterializeResult:
        end = date.today() - timedelta(days=1)
        result = backfill(instrument_key, START, end)
        if result is None:
            raise dg.Failure(f"no candles returned for {instrument_key}")
        saved_path, candles, days = result
        return dg.MaterializeResult(
            metadata={"path": str(saved_path), "candles": candles, "trading_days": days}
        )

    @dg.asset_check(asset=raw_candles, name="matches_candle_contract", blocking=True)
    def contract_check() -> dg.AssetCheckResult:
        df = pl.read_parquet(path)
        try:
            CANDLES.validate(df, lazy=True)
        except pandera.errors.SchemaErrors as err:
            return dg.AssetCheckResult(
                passed=False,
                metadata={"rows": df.height, "failures": len(err.failure_cases)},
            )
        return dg.AssetCheckResult(passed=True, metadata={"rows": df.height})

    @dg.asset(name=f"loaded_candles_{name}", deps=[raw_candles], group_name="ingest")
    def loaded_candles() -> dg.MaterializeResult:
        rows, inserted, quarantined = load_file(path)
        return dg.MaterializeResult(
            metadata={"rows_read": rows, "inserted": inserted, "quarantined": quarantined}
        )

    return [raw_candles, loaded_candles], [contract_check]


ingest_assets, ingest_checks = [], []
for name, key in INDICES.items():
    assets, checks = make_index_assets(name, key)
    ingest_assets += assets
    ingest_checks += checks


@dg.asset(deps=[f"loaded_candles_{name}" for name in INDICES], group_name="derive")
def expiry_calendar() -> dg.MaterializeResult:
    run_sql_file("002_expiry_calendar.sql")
    with connect() as conn:
        rows = conn.execute(
            "select index_name, count(*) from expiry_calendar group by 1 order by 1"
        ).fetchall()
    return dg.MaterializeResult(metadata={f"{idx}_expiries": n for idx, n in rows})


@dg.asset(deps=[expiry_calendar], group_name="derive")
def late_move_view() -> dg.MaterializeResult:
    run_sql_file("003_late_move.sql")
    with connect() as conn:
        days = conn.execute("select count(*) from daily_late_move").fetchone()[0]
    return dg.MaterializeResult(metadata={"days": days})


defs = dg.Definitions(
    assets=[*ingest_assets, expiry_calendar, late_move_view],
    asset_checks=ingest_checks,
)