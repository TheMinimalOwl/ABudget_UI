import { z } from 'zod';

/** Month in `YYYY-MM` format. */
export const MonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Esperado YYYY-MM');

/** Calendar date in `YYYY-MM-DD` format. */
export const DateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Esperado YYYY-MM-DD');

/** Money in minor units (cents). Never floats in transport. */
export const MoneySchema = z.number().int();

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  offBudget: z.boolean(),
  closed: z.boolean(),
  balance: MoneySchema,
});

export const TransactionSchema = z.object({
  id: z.string(),
  date: DateSchema,
  amount: MoneySchema,
  payeeId: z.string().nullable(),
  payeeName: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  notes: z.string().nullable(),
  cleared: z.boolean(),
  isTransfer: z.boolean(),
  isSplit: z.boolean(),
});

export const CategorySpendSchema = z.object({
  categoryId: z.string().nullable(),
  categoryName: z.string(),
  groupId: z.string().nullable(),
  groupName: z.string().nullable(),
  isIncome: z.boolean(),
  amount: MoneySchema,
  share: z.number().min(0).max(1),
  transactions: z.number().int(),
});

export const MonthlyPointSchema = z.object({
  month: MonthSchema,
  income: MoneySchema,
  expenses: MoneySchema,
  net: MoneySchema,
});

export const TotalsSchema = z.object({
  balance: MoneySchema,
  toBudget: MoneySchema,
  income: MoneySchema,
  expenses: MoneySchema,
  net: MoneySchema,
  assigned: MoneySchema,
  savingsRate: z.number().nullable(),
});

export const OverviewSchema = z.object({
  generatedAt: z.string(),
  serverVersion: z.string(),
  budgetName: z.string(),
  currency: z.string(),
  month: MonthSchema,
  currentMonth: MonthSchema,
  lastSyncAt: z.string().nullable(),
  readOnly: z.boolean(),
  availableMonths: z.array(MonthSchema),
  accounts: z.array(AccountSchema),
  totals: TotalsSchema,
  series: z.array(MonthlyPointSchema),
  categories: z.array(CategorySpendSchema),
  recentTransactions: z.array(TransactionSchema),
});

export const OverviewQuerySchema = z.object({
  month: MonthSchema.optional(),
});

export const TransactionsQuerySchema = z.object({
  from: DateSchema.optional(),
  to: DateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export const TransactionsResponseSchema = z.object({
  total: z.number().int(),
  items: z.array(TransactionSchema),
});

export const MonthsResponseSchema = z.object({
  currentMonth: MonthSchema,
  months: z.array(MonthSchema),
});

export const HealthSchema = z.object({
  status: z.enum(['starting', 'ready', 'error']),
  serverVersion: z.string(),
  budgetName: z.string(),
  currency: z.string(),
  lastSyncAt: z.string().nullable(),
  lastError: z.string().nullable(),
  uptimeSeconds: z.number(),
  readOnly: z.boolean(),
});

export type Account = z.infer<typeof AccountSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type CategorySpend = z.infer<typeof CategorySpendSchema>;
export type MonthlyPoint = z.infer<typeof MonthlyPointSchema>;
export type Totals = z.infer<typeof TotalsSchema>;
export type Overview = z.infer<typeof OverviewSchema>;
export type OverviewQuery = z.infer<typeof OverviewQuerySchema>;
export type TransactionsQuery = z.infer<typeof TransactionsQuerySchema>;
export type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>;
export type MonthsResponse = z.infer<typeof MonthsResponseSchema>;
export type Health = z.infer<typeof HealthSchema>;
