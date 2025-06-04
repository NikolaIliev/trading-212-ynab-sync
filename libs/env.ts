require("dotenv").config()
import { z } from "zod"

function readEnv<T>(name: string, schema: z.ZodSchema<T>): T {
  const res = schema.safeParse(process.env[name])

  if (!res.success) {
    throw new Error(`Missing or incorrect type for env var "${name}"`)
  }

  return res.data
}

export const env = {
  T212ApiKey: readEnv("T212_API_KEY", z.string()),
  T212ImportStartDate: readEnv("T212_IMPORT_START_DATE", z.string().optional()),
  YnabApiKey: readEnv("YNAB_API_KEY", z.string()),
  YnabTargetAccountName: readEnv("YNAB_TARGET_ACCOUNT_NAME", z.string()),
  T212YnabConversionRate: readEnv(
    "T212_YNAB_CONVERSION_RATE",
    z.number().optional(),
  ),
}
