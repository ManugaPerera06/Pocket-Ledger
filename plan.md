# Pocket Ledger — Implementation Plan

## Product approach

Pocket Ledger is a personal cash-book workspace that turns the user's existing 2023–2026 Excel records into an easy daily operating view: a calm overview for the current month, a searchable ledger for every transaction, and lightweight visual analytics that make spending patterns obvious.

The repository will use a decoupled structure: a React + Tailwind CSS + Recharts frontend in `frontend/`, and a modular Flask + SQLite API in `backend/`. In production, Flask serves the compiled React app and the API from one container; in development, Vite proxies `/api` calls to Flask. SQLite stores monetary values as integer cents and keeps source-sheet metadata so historical imports remain traceable.

## Data and backend decisions

- `transactions` is the canonical normalized table: ISO date, description, category, `INCOME`/`EXPENSE`, positive integer cents, timestamps, and optional import provenance.
- The importer handles the workbook's actual layouts: 2023's signed Amount column, 2024–2025 split Income/Expenditures columns, and 2026's compact split columns. It forward-fills blank dates, ignores summary rows, preserves the original description, and maps descriptions into stable categories.
- API contracts are JSON-first and validation errors are explicit. Filters cover free-text search, type, category, and inclusive date bounds. Summary calculations are generated from the same transaction table, not duplicated in the frontend.
- A committed seeded SQLite database is created from the supplied workbook so Preview opens with real cash-book data. The import script remains repeatable with `--replace` and can be run against a new workbook.

## Page and interaction design

### Considered movements

- Editorial command center — 0.07
- Soft neo-bank workspace — 0.06
- Quiet data atelier — 0.04

### Chosen movement: Editorial command center

**Design Movement:** A restrained editorial-finance dashboard: generous dark canvas, compact information hierarchy, and chart-led sections that feel like a personal control room rather than an accounting form.

**Core Principles:** Show the financial signal before the mechanics; use contrast for meaning, not decoration; keep editing close to the ledger; make every state legible on a narrow screen.

**Color Philosophy:** Deep slate grounds the workspace and reduces glare. Indigo is the ownable action color for navigation and primary controls; mint and coral are reserved for income and expense meaning so the numbers remain scannable.

**Layout Paradigm:** A left rail and asymmetric two-column overview create a persistent sense of place. The balance card spans the wide canvas, while trend and category panels share a responsive row that collapses into a deliberate vertical reading order on mobile.

**Signature Elements:** A small “PL” mark in a rounded indigo tile; metric cards with thin top signal lines; pill-shaped category labels and quiet, hairline gridlines on charts.

**Interaction Philosophy:** Add/edit is a focused modal, filters are immediate and reversible, delete asks for a clear confirmation, and loading/error states occupy the same visual space as the content they replace.

**Animation:** Use short 160–220ms ease-out transitions for cards, filter changes, modal entry, and hover states. Avoid continuous motion; chart tooltips and row hover are the only ambient feedback.

**Typography System:** Use Inter for the interface and a slightly tighter weight contrast for amounts. Uppercase eyebrow labels are 11px with tracked lettering; page titles are 30–38px and metric values are tabular, 26–34px.

**Brand Essence:** Personal money clarity for everyday decisions — grounded, useful, quietly confident.

**Brand Voice:** Direct and encouraging. Example lines: “Keep the small picture in view.” and “Every rupee has a place.”

**Wordmark & Logo:** A compact “PL” monogram in a rounded square paired with the Pocket Ledger wordmark; the mark doubles as the mobile rail icon.

**Signature Brand Color:** Pocket Indigo `#6366F1`, used for actions, selected states, and the thin accent line on the balance card.

## Project structure

```text
Pocket Ledger/
├── backend/
│   ├── app.py                 # Flask app, REST resources, summary queries, SPA serving
│   ├── db.py                  # SQLite path, connections, schema initialization, serializers
│   ├── import_cash_book.py    # Workbook parser and repeatable historical import
│   ├── schema.sql             # Canonical table and indexes
│   └── tests/test_api.py      # API and import-focused regression tests
├── frontend/
│   ├── src/App.tsx            # Dashboard shell, state, filters, modal workflows
│   ├── src/main.tsx           # React entry point
│   ├── src/index.css          # Tailwind layers and editorial dashboard styling
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.ts
├── data/My Cash Book.xlsx     # Supplied workbook used to seed the local SQLite file
├── Dockerfile                 # Production image: frontend build + Gunicorn Flask runtime
├── requirements.txt           # Backend install entry point
├── package.json               # Root convenience scripts
├── manus-routes.json          # WebDev route manifest
└── README.md                  # Setup, API contracts, import notes, and verification commands
```

## Serving model

The Flask app listens on `0.0.0.0:$PORT` (default 3000 for Preview/production). `GET /api/health` is an unauthenticated health check. In a production image, `frontend/dist` is copied into Flask's static root and non-API routes fall back to `index.html`. The frontend's Vite dev server remains available for local UI iteration, proxying API calls to Flask on port 5000.
