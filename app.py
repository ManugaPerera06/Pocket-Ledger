from contextlib import closing
from datetime import date
from decimal import Decimal, InvalidOperation
from flask import Flask, jsonify, request
from db import get_connection, init_db

app = Flask(__name__)
init_db()


def parse_transaction(data):
    """Validate the JSON payload. Returns (values, error)."""
    if not isinstance(data, dict):
        return None, "Request body must be a JSON object."

    tx_type = str(data.get("type", "")).strip().upper()
    if tx_type not in ("INCOME", "EXPENSE"):
        return None, "type must be 'income' or 'expense'."

    raw_amount = data.get("amount")
    if isinstance(raw_amount, bool) or not isinstance(raw_amount, (int, float, str)):
        return None, "amount must be a number."
    try:
        amount = Decimal(str(raw_amount))
    except InvalidOperation:
        return None, "amount must be a number."
    if not amount.is_finite():
        return None, "amount must be a finite number."
    cents = amount * 100
    if cents != cents.to_integral_value():
        return None, "amount can have at most 2 decimal places."
    cents = int(cents)
    if cents <= 0:
        return None, "amount must be greater than 0."

    MAX_CENTS = 10**12  

    if cents > MAX_CENTS:
        return None, "amount is too large."

    category = str(data.get("category", "")).strip()
    if not category:
        return None, "category is required."

    note = data.get("note")
    note = str(note).strip() if note is not None else None

    tx_date = data.get("transaction_date") or date.today().isoformat()
    try:
        tx_date = date.fromisoformat(str(tx_date)).isoformat()
    except ValueError:
        return None, "transaction_date must be in YYYY-MM-DD format."

    return (tx_type, cents, category, note, tx_date), None


@app.route("/")
def index():
    with closing(get_connection()) as conn:
        row = conn.execute(
            """
            SELECT COALESCE(
                SUM(CASE WHEN type = 'INCOME' THEN amount_cents ELSE -amount_cents END),
                0
            ) AS balance
            FROM transactions
            """
        ).fetchone()
        return f"Current Balance : {row['balance'] / 100:.2f}"


@app.route("/transactions", methods=["POST"])
def add_transaction():
    values, error = parse_transaction(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    with closing(get_connection()) as conn, conn:  # inner `conn` commits on success
        cursor = conn.execute(
            """
            INSERT INTO transactions
                (type, amount_cents, category, note, transaction_date)
            VALUES (?, ?, ?, ?, ?)
            """,
            values,
        )
        new_id = cursor.lastrowid

    tx_type, cents, category, note, tx_date = values
    return jsonify(
        {
            "id": new_id,
            "type": tx_type,
            "amount": cents / 100,
            "category": category,
            "note": note,
            "transaction_date": tx_date,
        }
    ), 201


if __name__ == "__main__":
    app.run(debug=True)