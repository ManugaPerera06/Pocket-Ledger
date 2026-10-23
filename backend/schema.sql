PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS transactions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_date  TEXT NOT NULL,
    description       TEXT NOT NULL,
    category          TEXT NOT NULL,
    type              TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
    source_file       TEXT,
    source_sheet      TEXT,
    source_row        INTEGER,
    source_raw_date   TEXT,
    created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_date_type ON transactions (transaction_date, type);
