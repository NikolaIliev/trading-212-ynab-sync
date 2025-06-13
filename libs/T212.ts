import {
  T212TransactionSchema,
  type T212Transaction,
} from "../schemas/T212Transaction"
import * as csv from "@fast-csv/parse"
import { delay } from "../utils/delay"
import { time } from "./time"
import { confirm } from "@inquirer/prompts"

export class T212 {
  private headers: Record<string, string>
  private importStartDate?: string

  constructor(opts: { apiKey: string; importStartDate?: string }) {
    this.headers = {
      "Content-Type": "application/json",
      Authorization: opts.apiKey,
    }
    this.importStartDate = opts.importStartDate
  }

  private async requestReport(): Promise<number> {
    const timeFrom = new Date(
      Math.max(
        this.importStartDate ? new Date(this.importStartDate).getTime() : 0,
        new Date().getTime() - 30 * time.Day,
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
        headers: this.headers,
      },
    )

    const data: any = await res.json()

    if (!("reportId" in data)) {
      throw new Error(
        `[T212] Could not generate report: ${JSON.stringify(data)}`,
      )
    }

    return data.reportId
  }

  private async findReportDownloadLink(reportId: number): Promise<string> {
    while (true) {
      const res = await fetch(
        "https://live.trading212.com/api/v0/history/exports",
        {
          method: "GET",
          headers: this.headers,
        },
      )

      const data: any = await res.json()

      if (!Array.isArray(data)) {
        throw new Error(`Data is not an array: ${JSON.stringify(data)}`)
      } else {
        const report = data.find((report: any) => report.reportId === reportId)

        if (!report) {
          throw new Error(`[T212] Could not find report with id ${reportId}!`)
        }

        if (typeof report.downloadLink !== "string") {
          throw new Error(
            `[T212] Report does not have a download link: ${JSON.stringify(report)}`,
          )
        }

        return report.downloadLink
      }
    }
  }

  async getTransactions(): Promise<T212Transaction[]> {
    const reportId = await this.requestReport()
    console.log(`[T212] Report generated! Id: ${reportId}`)
    await confirm({
      message:
        "Please confirm once you've received a notification about the report being generated...",
    })

    const downloadLink = await this.findReportDownloadLink(reportId)
    console.log(`[T212] Downloading report CSV: ${downloadLink}`)

    const csvRes = await fetch(downloadLink)
    const csvStr = await csvRes.text()

    console.log(`[T212] Parsing CSV...`)
    return new Promise<T212Transaction[]>((resolve, reject) => {
      const transactions: T212Transaction[] = []

      csv
        .parseString(csvStr, { headers: true })
        .on("data", (rawTransaction) => {
          if (!("Action" in rawTransaction)) {
            return reject(
              new Error(
                `Expected rawTransaction to have "Action" field: ${rawTransaction}`,
              ),
            )
          }

          if (rawTransaction.Action === "Card debit") {
            const transaction = T212TransactionSchema.safeParse(rawTransaction)

            if (!transaction.success) {
              return reject(
                new Error(
                  `Failed to parse Card debit transaction: ${rawTransaction} ${transaction}`,
                ),
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
          reject(error)
        })
        .on("end", async (rows: number) => {
          console.log(`[T212] Done, parsed ${rows} transactions!`)

          resolve(transactions)
        })
    })
  }
}
