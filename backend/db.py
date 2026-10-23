from __future__ import annotations

import sqlite3
import os
from contextlib import closing
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("POCKET_LEDGER_DB", Path(__file__).resolve().parent.parent / "pocket.db"))
SCHEMA_PATH = BASE_DIR / "schema.sql"


def get_connection() -> sqlite3.Connection:
    """Open a row-aware SQLite connection with foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Create the database schema without destroying existing records."""
    with closing(get_connection()) as conn:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        conn.commit()


def row_to_transaction(row: sqlite3.Row) -> dict[str, Any]:
    """Convert a database row into the stable public JSON shape."""
    return {
        "id": row["id"],
        "transaction_date": row["transaction_date"],
        "date": row["transaction_date"],
        "description": row["description"],
        "note": row["description"],
        "category": row["category"],
        "type": row["type"],
        "amount": round(row["amount_cents"] / 100, 2),
        "amount_cents": row["amount_cents"],
        "source_file": row["source_file"],
        "source_sheet": row["source_sheet"],
        "source_row": row["source_row"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
