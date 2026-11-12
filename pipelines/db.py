"""One place that knows how to connect to the local database."""
import os

import psycopg
from dotenv import load_dotenv

load_dotenv()


def connect():
    password = os.environ.get("POSTGRES_PASSWORD")
    if not password:
        raise SystemExit("POSTGRES_PASSWORD is missing from .env")
    return psycopg.connect(
        host="127.0.0.1",
        port=5432,
        dbname="expirylens",
        user="expiry",
        password=password,
    )