from sqlite3 import Row
from contextlib import closing
from flask import Flask
from db import get_connection, init_db

app = Flask(__name__)
init_db

@app.route('/')
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


if __name__ == "__main__":
    app.run(debug=True)