require("dotenv").config()
import z from "zod"
import { T212 } from "./libs/T212"
import { YNAB } from "./libs/YNAB"

const T212ApiKey = z.string().parse(process.env.T212_API_KEY)
const T212ImportStartDate = z
  .string()
  .optional()
  .parse(process.env.T212_IMPORT_START_DATE)
const YnabApiKey = z.string().parse(process.env.YNAB_API_KEY)

const t212 = new T212({
  apiKey: T212ApiKey,
  importStartDate: T212ImportStartDate,
})

const ynab = new YNAB({
  apiKey: YnabApiKey,
  targetAccountName: "T212 (Cash)",
})

const [transactions] = await Promise.all([t212.getTransactions(), ynab.init()])

await ynab.importT212Transactions(transactions)
