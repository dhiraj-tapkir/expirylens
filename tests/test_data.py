"""Data tests: facts about the real database that must stay true.

These need the local TimescaleDB running. If it isn't reachable (for example
on CI), every test here is skipped rather than failed.
"""
from datetime import date

import psycopg
import pytest

from pipelines.db import connect


@pytest.fixture(scope="module")
def db():
    try:
        conn = connect()
    except (psycopg.OperationalError, SystemExit):
        pytest.skip("local database not available")
    yield conn
    conn.close()


def expiry_rule(db, index_name, day):
    row = db.execute(
        "select settlement_rule from expiry_calendar where index_name = %s and expiry_date = %s",
        (index_name, day),
    ).fetchone()
    return row[0] if row else None


def test_copthall_day_is_a_sensex_cas_expiry(db):
    assert expiry_rule(db, "SENSEX", date(2026, 8, 13)) == "CAS"


def test_copthall_day_is_not_a_nifty_expiry(db):
    assert expiry_rule(db, "NIFTY", date(2026, 8, 13)) is None


def test_holiday_moves_nifty_expiry_to_monday(db):
    # tue 10 nov 2026 had no trading, so that week's expiry is mon 9 nov
    assert expiry_rule(db, "NIFTY", date(2026, 11, 9)) == "CAS"
    assert expiry_rule(db, "NIFTY", date(2026, 11, 10)) is None


def test_incomplete_week_is_not_an_expiry(db):
    # wed 11 nov 2026 was the last downloaded day, not a sensex expiry
    assert expiry_rule(db, "SENSEX", date(2026, 11, 11)) is None


def test_one_expiry_per_index_per_week(db):
    dupes = db.execute(
        """select index_name, date_trunc('week', expiry_date), count(*)
           from expiry_calendar
           group by 1, 2
           having count(*) > 1"""
    ).fetchall()
    assert dupes == []


def test_no_duplicate_candles(db):
    dupes = db.execute(
        """select instrument_key, ts, count(*)
           from candles_1m
           group by 1, 2
           having count(*) > 1
           limit 5"""
    ).fetchall()
    assert dupes == []


def test_prices_are_sane(db):
    bad = db.execute(
        """select count(*) from candles_1m
           where low > high or open <= 0 or close <= 0
              or open not between low and high
              or close not between low and high"""
    ).fetchone()[0]
    assert bad == 0