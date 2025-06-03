require("dotenv").config()
import * as csv from "@fast-csv/parse"
import * as ynab from "ynab"
import {
  T212TransactionSchema,
  type T212Transaction,
} from "./schemas/T212Transaction"
import z from "zod"
import { delay } from "./utils/delay"

const T212ApiKey = z.string().parse(process.env.T212_API_KEY)
const T212ImportStartDate = z
  .string()
  .optional()
  .parse(process.env.T212_IMPORT_START_DATE)
const YnabApiKey = z.string().parse(process.env.YNAB_API_KEY)

const t212Headers = {
  "Content-Type": "application/json",
  Authorization: T212ApiKey,
}

const ynabAPI = new ynab.API(YnabApiKey)

console.log("[YNAB] Fetching budgets...")
const ynabBudget = (await ynabAPI.budgets.getBudgets(true)).data.budgets[0]

if (!ynabBudget) {
  throw new Error("[YNAB] Could not find default budget!")
}

const ynabAccount = ynabBudget.accounts?.find(
  (account) => account.type === "checking" && account.name === "T212 (Cash)",
)

if (!ynabAccount || ynabAccount.deleted) {
  throw new Error('[YNAB] Could not find "T212 (Cash)" account!')
}

async function requestTrading212Report(): Promise<number> {
  const timeFrom = new Date(
    Math.max(
      T212ImportStartDate ? new Date(T212ImportStartDate).getTime() : 0,
      // 30 days ago
      new Date().getTime() - 1000 * 60 * 60 * 24 * 30,
    ),
  ).toISOString()

  console.log(`[T212] Generating report from ${timeFrom} until today...`)
  const res = await fetch(
    "https://live.trading212.com/api/v0/history/exports",
    {
      method: "POST",
      body: JSON.stringify({
        dataIncluded: {
          includeTransactions: true,
        },
        timeFrom,
        timeTo: new Date().toISOString(),
      }),
      headers: t212Headers,
    },
  )

  const data: any = await res.json()

  if (!("reportId" in data)) {
    console.log("[T212] Could not generate report:", data)
    process.exit(1)
  }

  return data.reportId
}

const reportId = await requestTrading212Report()

async function findReportDownloadLink(reportId: number): Promise<string> {
  while (true) {
    const res = await fetch(
      "https://live.trading212.com/api/v0/history/exports",
      {
        method: "GET",
        headers: t212Headers,
      },
    )

    const data: any = await res.json()

    if (!Array.isArray(data)) {
      console.log("Data is not array...", data)
      process.exit(1)
    } else {
      const report = data.find((report: any) => report.reportId === reportId)

      if (!report) {
        console.log(`[T212] Could not find report with id ${reportId}!`)
        process.exit(1)
      }

      return report.downloadLink
    }
  }
}

console.log(`[T212] Report generated! Id: ${reportId}`)
console.log("[T212] Waiting 10 seconds for report to appear...")

await delay(10000)

const downloadLink = await findReportDownloadLink(reportId)

console.log(`[T212] Downloading report CSV: ${downloadLink}`)

const csvRes = await fetch(downloadLink)
const csvStr = await csvRes.text()

const transactions: T212Transaction[] = []

console.log(`[T212] Parsing CSV...`)
csv
  .parseString(csvStr, { headers: true })
  .on("data", (rawTransaction) => {
    if (!("Action" in rawTransaction)) {
      throw new Error(
        `Expected rawTransaction to have "Action" field: ${rawTransaction}`,
      )
    }

    if (rawTransaction.Action === "Card debit") {
      const transaction = T212TransactionSchema.safeParse(rawTransaction)

      if (!transaction.success) {
        throw new Error(
          `Failed to parse Card debit transaction: ${rawTransaction} ${transaction}`,
        )
      }

      transactions.push(transaction.data)
    }
  })
  .on("data-invalid", (row, rowNumber) => {
    console.log(`Row ${rowNumber} contains invalid data: ${row}`)
  })
  .on("error", (error) => {
    console.log("CSV parse error:", error)
  })
  .on("end", async (rows: number) => {
    console.log(`[T212] Done, parsed ${rows} transactions!`)

    console.log("[YNAB] Creating transactions...")

    const res = await ynabAPI.transactions.createTransactions(ynabBudget.id, {
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
        account_id: ynabAccount.id,
      })),
    })

    console.log("[YNAB] Created transactions", res)
    console.log("Done!")
  })
