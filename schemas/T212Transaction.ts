import z from 'zod'

export const T212TransactionSchema = z.object({
  ID: z.string(),
  Time: z.string(),
  Total: z.string(),
  "Merchant name": z.string(),
}).transform(rawTransaction => ({
  id: rawTransaction.ID,
  date: rawTransaction.Time,
  value: parseFloat(rawTransaction.Total),
  merchantName: rawTransaction["Merchant name"],
}))

export type T212Transaction = z.infer<typeof T212TransactionSchema>
