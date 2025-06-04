# What is this?
A script which imports debit card transactions from your Trading 212 account into your YNAB budget.

# Requirements
- Bun (https://bun.sh)
- .env file with `T212_API_KEY=your_key` and `YNAB_API_KEY=your_key`
- Make sure your Trading 212 API key has the `History - Transactions` permission.

# How to run
- `bun install`
- `bun run main.ts`

# Extras
Trading 212 transactions are imported up to 30 days in the past.
If you wish to set a specific start date which is not more than 30 days in the past, use e.g. `T212_IMPORT_START_DATE=2025-02-01` in `.env`.
Useful if you're just starting your budget and wish to ignore the previous month's transactions.
