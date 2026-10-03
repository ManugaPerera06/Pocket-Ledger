# Pocket-Ledger

A small Flask + SQLite application for recording my pocket money transactions.

## Features

- Stores income and expense transactions in a local SQLite database
- Shows the current balance (total income minus total expenses)
- Amounts are stored as integer cents to avoid floating-point rounding errors

> **Status:** early development. Only the balance view is implemented so far.

## Tech Stack

- Python 3
- Flask
- SQLite (via Python's built-in `sqlite3` module)

## Project Structure

```
Pocket-Ledger/
├── app.py        # Flask app and routes
├── db.py         # Database connection and initialization
├── schema.sql    # Table and index definitions
└── README.md
```
