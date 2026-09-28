CREATE TABLE IF NOT EXISTS transactions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    type             TEXT    NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    amount_cents     INTEGER NOT NULL CHECK (amount_cents > 0),
    category         TEXT    NOT NULL,
    note             TEXT,
    transaction_date TEXT    NOT NULL,
    created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON transactions (transaction_date);