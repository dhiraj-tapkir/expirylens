"""API tests. The first three need no database; the rest skip without one."""
import psycopg
import pytest
from fastapi.testclient import TestClient

from api.main import app
from pipelines.db import connect

client = TestClient(app)


@pytest.fixture
def db():
    try:
        connect().close()
    except (psycopg.OperationalError, SystemExit):
        pytest.skip("local database not available")


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_unknown_index_is_rejected():
    r = client.get("/expiries", params={"index": "BANKNIFTY"})
    assert r.status_code == 422


def test_index_is_required():
    r = client.get("/expiries")
    assert r.status_code == 422


def test_sensex_expiries_include_the_copthall_day(db):
    r = client.get("/expiries", params={"index": "SENSEX"})
    assert r.status_code == 200
    dates = {row["expiry_date"] for row in r.json()}
    assert "2026-08-13" in dates


def test_expiry_only_filter_returns_only_expiries(db):
    r = client.get("/late-moves", params={"index": "NIFTY", "expiry_only": True})
    assert r.status_code == 200
    rows = r.json()
    assert rows and all(row["is_expiry"] for row in rows)


def test_summary_has_one_row_per_group(db):
    r = client.get("/summary")
    assert r.status_code == 200
    assert len(r.json()) == 8  # 2 indices x 2 regimes x expiry or not