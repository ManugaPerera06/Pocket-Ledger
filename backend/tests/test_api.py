from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

# Set the test DB before importing the Flask app and database module.
TEST_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
TEST_DB.close()
os.environ["POCKET_LEDGER_DB"] = TEST_DB.name

from backend.app import app  # noqa: E402
from backend.db import get_connection, init_db  # noqa: E402


class PocketLedgerApiTests(unittest.TestCase):
    def setUp(self):
        init_db()
        with get_connection() as conn:
            conn.execute("DELETE FROM transactions")
            conn.executemany(
                """INSERT INTO transactions (transaction_date, description, category, type, amount_cents)
                VALUES (?, ?, ?, ?, ?)""",
                [
                    ("2026-10-01", "Pocket money", "Family", "INCOME", 10000),
                    ("2026-10-02", "Lunch", "Food", "EXPENSE", 850),
                ],
            )
            conn.commit()
        self.client = app.test_client()

    def test_health_and_summary(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.get_json()["database"], "sqlite")
        summary = self.client.get("/api/summary?month=2026-10")
        self.assertEqual(summary.status_code, 200)
        payload = summary.get_json()
        self.assertEqual(payload["total_balance"], 91.5)
        self.assertEqual(payload["current_month_income"], 100.0)
        self.assertEqual(payload["current_month_expenses"], 8.5)
        self.assertEqual(payload["net_savings"], 91.5)
        self.assertEqual(payload["category_breakdown"][0]["category"], "Food")

    def test_filter_and_crud(self):
        response = self.client.get("/api/transactions?type=expense&category=Food")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["total"], 1)

        created = self.client.post("/api/transactions", json={
            "transaction_date": "2026-10-03",
            "description": "Bus fare",
            "category": "Transport",
            "type": "EXPENSE",
            "amount": 250,
        })
        self.assertEqual(created.status_code, 201)
        transaction_id = created.get_json()["id"]

        updated = self.client.put(f"/api/transactions/{transaction_id}", json={
            "transaction_date": "2026-10-03",
            "description": "Train fare",
            "category": "Transport",
            "type": "EXPENSE",
            "amount": 300,
        })
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["description"], "Train fare")
        self.assertEqual(updated.get_json()["amount"], 300.0)

        deleted = self.client.delete(f"/api/transactions/{transaction_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.delete(f"/api/transactions/{transaction_id}").status_code, 404)

    def test_validation(self):
        response = self.client.post("/api/transactions", json={"amount": -1})
        self.assertEqual(response.status_code, 400)
        self.assertIn("type", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
