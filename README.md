# Pocket Ledger

Pocket Ledger is a personal pocket-money and cash-book dashboard built from the supplied `My Cash Book.xlsx` history. It combines a React + Tailwind UI with a Flask + SQLite API and serves a seeded, traceable transaction history out of the box.

## Stack

- React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React
- Python 3.12, Flask, Gunicorn, SQLite
- Integer cents for monetary storage; ISO 8601 dates for filtering and sorting

## Local setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm --prefix frontend install
npm --prefix frontend run build
python backend/import_cash_book.py data/'My Cash Book.xlsx' --replace
PORT=3000 python backend/app.py
```

Open `http://localhost:3000`. For frontend-only iteration, run Flask on port 5000 and `npm --prefix frontend run dev`; Vite proxies `/api` to Flask.

## Historical workbook mapping

The workbook has four year sheets:

| Sheet | Date/details | Money columns | Notes |
| --- | --- | --- | --- |
| 2023 | A/B | H: signed `Amount (Rs.)` | Dates are often blank after the first row and are forward-filled. |
| 2024 | A/B | H: `Incomes`, J: `Expenditures` | Expenses are negative in the source. |
| 2025 | A/B | H: `Income`, J: `Expenditures` | Weekly profit labels are ignored as summary rows. |
| 2026 | A/B | C: `Income`, D: `Expenditure` | Compact layout; dates are forward-filled. |

The importer maps descriptions into Savings, Education & Classes, Food, Shopping, Health, Outings & Social, Family, Loans, Personal Care, or Uncategorized. Each imported row retains `source_file`, `source_sheet`, `source_row`, and `source_raw_date`.

## API

- `GET /api/health`
- `GET /api/transactions?q=&type=INCOME|EXPENSE&category=&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/transactions` with `{ "transaction_date": "2026-10-23", "description": "Lunch", "category": "Food", "type": "EXPENSE", "amount": 850 }`
- `PUT /api/transactions/:id` with the same fields
- `DELETE /api/transactions/:id`
- `GET /api/summary` returns balance cards, trend points, category totals, and recent transactions

## Verification

```bash
npm --prefix frontend run build
python -m unittest discover -s backend/tests -v
curl http://localhost:3000/api/health
curl 'http://localhost:3000/api/summary'
```
