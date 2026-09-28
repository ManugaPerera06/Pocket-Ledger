import sqlite3
from contextlib import closing
from pathlib import Path

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "pocket.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # access columns by name: row["amount_cents"]
    return conn


def init_db():
    with closing(get_connection()) as conn:
        conn.executescript(SCHEMA_PATH.read_text())