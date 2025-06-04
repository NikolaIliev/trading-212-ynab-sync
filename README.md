# What is this?
A script which imports debit card transactions from your Trading 212 account into your YNAB budget.

# Requirements
- Bun (https://bun.sh)
- .env file with `T212_API_KEY=your_key`, `YNAB_API_KEY=your_key` and `YNAB_TARGET_ACCOUNT_NAME="T212 Account Name"`.
- Make sure your Trading 212 API key has the `History - Transactions` permission.
- Make sure you have a dedicated unlinked account @ YNAB for T212 and set its name in .env under `YNAB_TARGET_ACCOUNT_NAME`.

# How to run
- `bun install`
- `bun run main.ts`

# Notes
- Trading 212 transactions are imported up to 30 days in the past.
- If you wish to set a specific start date which is not more than 30 days in the past, use e.g. `T212_IMPORT_START_DATE=2025-02-01` in `.env`.
Useful if you're just starting your budget and wish to ignore the previous month's transactions.
- Transactions are only returned by the T212 API if they're cleared (appear as Completed in the t212 app). If they're still pending, they won't be returned by the API and will not be imported into YNAB.
