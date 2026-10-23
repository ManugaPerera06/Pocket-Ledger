from __future__ import annotations

import os
import sqlite3
from contextlib import closing
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory

try:
    from backend.db import get_connection, init_db, row_to_transaction
except ModuleNotFoundError:  # Allows `python backend/app.py` from the repo root.
    from db import get_connection, init_db, row_to_transaction

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = ROOT / "frontend" / "dist"
FRONTEND_ASSETS = FRONTEND_DIST / "assets"

app = Flask(__name__, static_folder=str(FRONTEND_ASSETS), static_url_path="/assets")
init_db()

CATEGORIES = [
    "Food",
    "Education & Classes",
    "Shopping",
    "Outings & Social",
    "Family",
    "Health",
    "Personal Care",
    "Savings",
    "Loans",
    "Transport",
    "Bills",
    "Uncategorized",
]


def error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def parse_iso_date(value: Any, field: str) -> str:
    try:
        return date.fromisoformat(str(value)).isoformat()
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be in YYYY-MM-DD format.") from exc


def parse_amount(value: Any) -> int:
    if isinstance(value, bool) or value is None:
        raise ValueError("amount must be a positive number with at most 2 decimal places.")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("amount must be a positive number with at most 2 decimal places.") from exc
    exponent = amount.as_tuple().exponent
    if not amount.is_finite() or amount <= 0 or (isinstance(exponent, int) and exponent < -2):
        raise ValueError("amount must be a positive number with at most 2 decimal places.")
    cents = int(amount * 100)
    if cents > 10**12:
        raise ValueError("amount is too large.")
    return cents


def parse_transaction_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    tx_type = str(payload.get("type", "")).strip().upper()
    if tx_type not in {"INCOME", "EXPENSE"}:
        raise ValueError("type must be 'income' or 'expense'.")
    description = str(payload.get("description", payload.get("note", ""))).strip()
    if not description:
        raise ValueError("description is required.")
    if len(description) > 240:
        raise ValueError("description must be 240 characters or fewer.")
    category = str(payload.get("category", "")).strip()
    if not category:
        raise ValueError("category is required.")
    if len(category) > 80:
        raise ValueError("category must be 80 characters or fewer.")
    transaction_date = parse_iso_date(payload.get("transaction_date", payload.get("date", date.today().isoformat())), "transaction_date")
    return {
        "transaction_date": transaction_date,
        "description": description,
        "category": category,
        "type": tx_type,
        "amount_cents": parse_amount(payload.get("amount")),
    }


def transaction_query(filters: dict[str, Any]) -> tuple[str, list[Any]]:
    clauses = ["1 = 1"]
    params: list[Any] = []
    if filters.get("q"):
        clauses.append("(LOWER(description) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?))")
        needle = f"%{filters['q']}%"
        params.extend([needle, needle])
    if filters.get("type"):
        clauses.append("type = ?")
        params.append(filters["type"])
    if filters.get("category"):
        clauses.append("category = ?")
        params.append(filters["category"])
    if filters.get("from"):
        clauses.append("transaction_date >= ?")
        params.append(filters["from"])
    if filters.get("to"):
        clauses.append("transaction_date <= ?")
        params.append(filters["to"])
    return " AND ".join(clauses), params


def read_filters() -> dict[str, Any]:
    tx_type = request.args.get("type", "").strip().upper() or None
    if tx_type and tx_type not in {"INCOME", "EXPENSE"}:
        raise ValueError("type must be 'income' or 'expense'.")
    values: dict[str, Any] = {
        "q": request.args.get("q", "").strip() or None,
        "type": tx_type,
        "category": request.args.get("category", "").strip() or None,
    }
    for key in ("from", "to"):
        raw = request.args.get(key, "").strip() or None
        values[key] = parse_iso_date(raw, key) if raw else None
    if values["from"] and values["to"] and values["from"] > values["to"]:
        raise ValueError("from must be on or before to.")
    return values


@app.get("/api/health")
def health():
    with closing(get_connection()) as conn:
        conn.execute("SELECT 1").fetchone()
    return jsonify({"status": "ok", "database": "sqlite"})


@app.get("/api/transactions")
def list_transactions():
    try:
        filters = read_filters()
    except ValueError as exc:
        return error(str(exc))
    where, params = transaction_query(filters)
    with closing(get_connection()) as conn:
        rows = conn.execute(f"SELECT * FROM transactions WHERE {where} ORDER BY transaction_date DESC, id DESC", params).fetchall()
        categories = [row[0] for row in conn.execute("SELECT DISTINCT category FROM transactions ORDER BY category").fetchall()]
    return jsonify({"transactions": [row_to_transaction(row) for row in rows], "total": len(rows), "categories": categories or CATEGORIES})


@app.post("/api/transactions")
def create_transaction():
    try:
        values = parse_transaction_payload(request.get_json(silent=True))
    except ValueError as exc:
        return error(str(exc))
    with closing(get_connection()) as conn:
        cursor = conn.execute(
            """INSERT INTO transactions (transaction_date, description, category, type, amount_cents)
            VALUES (:transaction_date, :description, :category, :type, :amount_cents)""",
            values,
        )
        conn.commit()
        row = conn.execute("SELECT * FROM transactions WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(row_to_transaction(row)), 201


@app.put("/api/transactions/<int:transaction_id>")
def update_transaction(transaction_id: int):
    try:
        values = parse_transaction_payload(request.get_json(silent=True))
    except ValueError as exc:
        return error(str(exc))
    with closing(get_connection()) as conn:
        existing = conn.execute("SELECT id FROM transactions WHERE id = ?", (transaction_id,)).fetchone()
        if not existing:
            return error("Transaction not found.", 404)
        values["id"] = transaction_id
        conn.execute(
            """UPDATE transactions
            SET transaction_date=:transaction_date, description=:description, category=:category,
                type=:type, amount_cents=:amount_cents, updated_at=CURRENT_TIMESTAMP
            WHERE id=:id""",
            values,
        )
        conn.commit()
        row = conn.execute("SELECT * FROM transactions WHERE id = ?", (transaction_id,)).fetchone()
    return jsonify(row_to_transaction(row))


@app.delete("/api/transactions/<int:transaction_id>")
def delete_transaction(transaction_id: int):
    with closing(get_connection()) as conn:
        cursor = conn.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        conn.commit()
    if cursor.rowcount == 0:
        return error("Transaction not found.", 404)
    return jsonify({"deleted": transaction_id})


def requested_month() -> tuple[str, str]:
    raw = request.args.get("month", "").strip()
    if raw:
        try:
            month_start = datetime.strptime(f"{raw}-01", "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError("month must be in YYYY-MM format.") from exc
    else:
        today = date.today()
        month_start = today.replace(day=1)
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return month_start.isoformat(), next_month.isoformat()


@app.get("/api/summary")
def summary():
    try:
        month_start, next_month = requested_month()
    except ValueError as exc:
        return error(str(exc))
    today = date.today().isoformat()
    trend_start = (date.today() - timedelta(days=89)).isoformat()
    with closing(get_connection()) as conn:
        totals = conn.execute(
            """SELECT
                COALESCE(SUM(CASE WHEN type='INCOME' THEN amount_cents ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount_cents ELSE 0 END), 0) AS expenses
            FROM transactions"""
        ).fetchone()
        month = conn.execute(
            """SELECT
                COALESCE(SUM(CASE WHEN type='INCOME' THEN amount_cents ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount_cents ELSE 0 END), 0) AS expenses
            FROM transactions WHERE transaction_date >= ? AND transaction_date < ?""",
            (month_start, next_month),
        ).fetchone()
        trend_rows = conn.execute(
            """SELECT transaction_date AS date,
                COALESCE(SUM(CASE WHEN type='INCOME' THEN amount_cents ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount_cents ELSE 0 END), 0) AS expenses
            FROM transactions WHERE transaction_date >= ? AND transaction_date <= ?
            GROUP BY transaction_date ORDER BY transaction_date""",
            (trend_start, today),
        ).fetchall()
        category_rows = conn.execute(
            """SELECT category, COALESCE(SUM(amount_cents), 0) AS amount_cents
            FROM transactions WHERE type='EXPENSE' GROUP BY category ORDER BY amount_cents DESC LIMIT 8"""
        ).fetchall()
        recent_rows = conn.execute("SELECT * FROM transactions ORDER BY transaction_date DESC, id DESC LIMIT 6").fetchall()
        categories = [row[0] for row in conn.execute("SELECT DISTINCT category FROM transactions ORDER BY category").fetchall()]

    income = totals["income"]
    expenses = totals["expenses"]
    month_income = month["income"]
    month_expenses = month["expenses"]
    return jsonify({
        "total_balance": round((income - expenses) / 100, 2),
        "total_income": round(income / 100, 2),
        "total_expenses": round(expenses / 100, 2),
        "current_month_income": round(month_income / 100, 2),
        "current_month_expenses": round(month_expenses / 100, 2),
        "net_savings": round((month_income - month_expenses) / 100, 2),
        "month": month_start[:7],
        "trend": [{"date": row["date"], "income": round(row["income"] / 100, 2), "expenses": round(row["expenses"] / 100, 2)} for row in trend_rows],
        "category_breakdown": [{"category": row["category"], "amount": round(row["amount_cents"] / 100, 2)} for row in category_rows],
        "recent_transactions": [row_to_transaction(row) for row in recent_rows],
        "categories": categories or CATEGORIES,
    })


@app.get("/manus-routes.json")
def route_manifest():
    return send_from_directory(ROOT, "manus-routes.json")


@app.errorhandler(404)
def not_found(_exc):
    if request.path.startswith("/api/"):
        return error("Not found.", 404)
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({"status": "ok", "message": "Frontend build not found; run npm --prefix frontend run build."})


@app.get("/")
def index():
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({"status": "ok", "message": "Frontend build not found; run npm --prefix frontend run build."})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "3000")), debug=os.environ.get("FLASK_DEBUG") == "1")
