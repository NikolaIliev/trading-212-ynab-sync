import { T212 } from "./libs/T212"
import { YNAB } from "./libs/YNAB"
import { env } from "./libs/env"

const t212 = new T212({
  apiKey: env.T212ApiKey,
  importStartDate: env.T212ImportStartDate,
})

const ynab = new YNAB({
  apiKey: env.YnabApiKey,
  targetAccountName: env.YnabTargetAccountName,
})

const [transactions] = await Promise.all([t212.getTransactions(), ynab.init()])

await ynab.importT212Transactions(transactions)
