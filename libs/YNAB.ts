import * as ynab from "ynab"
import type { T212Transaction } from "../schemas/T212Transaction"

export class YNAB {
  ynabApi: ynab.api
  accountName: string
  budget?: ynab.BudgetSummary
  account?: ynab.Account

  constructor(opts: { apiKey: string; targetAccountName: string }) {
    this.ynabApi = new ynab.API(opts.apiKey)
    this.accountName = opts.targetAccountName
  }

  async init(): Promise<void> {
    console.log("[YNAB] Fetching budgets...")
    const budget = (await this.ynabApi.budgets.getBudgets(true)).data.budgets[0]

    if (!budget) {
      throw new Error("[YNAB] Could not find default budget!")
    }

    const account = budget.accounts?.find(
      (account) =>
        account.type === "checking" && account.name === this.accountName,
    )

    if (!account || account.deleted) {
      throw new Error(
        `[YNAB] Could not find "${this.accountName}" checking account!`,
      )
    }

    this.budget = budget
    this.account = account
  }

  async importT212Transactions(transactions: T212Transaction[]): Promise<void> {
    const account = this.account
    const budget = this.budget
    if (!budget || !account) {
      throw new Error("[YNAB] Instance not initialised!")
    }

    const res = await this.ynabApi.transactions.createTransactions(budget.id, {
      transactions: transactions.map((transaction) => ({
        import_id: transaction.id,
        date: transaction.date,
        amount: parseInt(
          (
            transaction.value *
            // convert to BGN
            1.95583 *
            // YNAB takes milliunits format
            1000
          ).toFixed(0),
        ),
        payee_name: transaction.merchantName,
        approved: true,
        cleared: "cleared",
        account_id: account.id,
      })),
    })

    if (!res.data.transactions?.length) {
      console.log("[YNAB] No new transactions found")
    } else {
      console.log("[YNAB] Imported transactions", res)
    }
  }
}
