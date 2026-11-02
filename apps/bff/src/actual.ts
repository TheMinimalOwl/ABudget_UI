import { mkdir } from 'node:fs/promises';
import * as api from '@actual-app/api';
import type {
  ActualAccount,
  ActualBudgetMonth,
  ActualCategory,
  ActualCategoryGroup,
  ActualInternal,
  ActualPayee,
} from '@actual-app/api';
import type {
  Account,
  CategorySpend,
  Health,
  MonthlyPoint,
  Overview,
  Totals,
  Transaction,
  TransactionsQuery,
  TransactionsResponse,
} from '@uiab/contracts';
import { env } from './env.js';

interface RawTransaction {
  id: string;
  date: string;
  amount: number;
  payee: string | null;
  category: string | null;
  account: string;
  notes: string | null;
  cleared: boolean | number;
  transfer_id: string | null;
  parent_id: string | null;
  is_parent: boolean | number;
  is_child: boolean | number;
}

interface Snapshot {
  accounts: Account[];
  categoryById: Map<string, ActualCategory>;
  groupById: Map<string, ActualCategoryGroup>;
  payeeById: Map<string, string>;
  transactions: RawTransaction[];
  activityMonths: string[];
  currentMonth: string;
  budgetName: string;
  serverVersion: string;
  startingBalanceCategoryIds: Set<string>;
  incomeCategoryIds: Set<string>;
}

type SnapshotCache = {
  version: number;
  at: number;
  value: Snapshot;
};

let internal: ActualInternal | null = null;
let state: 'starting' | 'ready' | 'error' = 'starting';
let lastError: string | null = null;
let lastSyncAt: string | null = null;
let budgetName = '';
let serverVersion = '';
let bootPromise: Promise<void> | null = null;
let syncPromise: Promise<void> | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;
let dataVersion = 0;
let snapshotCache: SnapshotCache | null = null;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Fecha de hoy en la zona configurada, como YYYY-MM-DD. */
function todayInTz(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${pad(nextMonth)}`;
}

function monthRange(start: string, end: string, limit = 240): string[] {
  const months: string[] = [];
  let cursor = start;
  while (cursor <= end && months.length < limit) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function bumpVersion() {
  dataVersion += 1;
}

export async function ensureReady(): Promise<void> {
  if (state === 'ready') return;
  if (bootPromise) return bootPromise;

  bootPromise = boot()
    .catch(error => {
      state = 'error';
      lastError = errorMessage(error);
      throw error;
    })
    .finally(() => {
      bootPromise = null;
    });

  return bootPromise;
}

async function boot(): Promise<void> {
  state = 'starting';
  lastError = null;

  await mkdir(env.dataDir, { recursive: true });

  if (!internal) {
    internal = await api.init({
      dataDir: env.dataDir,
      serverURL: env.ACTUAL_SERVER_URL,
      password: env.ACTUAL_PASSWORD,
    });
  }

  serverVersion = (await api.getServerVersion()).version;

  const budgets = await api.getBudgets();
  const local = budgets.find(
    budget => budget.groupId === env.ACTUAL_BUDGET_SYNC_ID && budget.id,
  );

  if (local?.id) {
    await api.loadBudget(local.id);
    budgetName = local.name ?? budgetName;
  } else {
    await api.downloadBudget(
      env.ACTUAL_BUDGET_SYNC_ID,
      env.ACTUAL_BUDGET_PASSWORD
        ? { password: env.ACTUAL_BUDGET_PASSWORD }
        : {},
    );
    budgetName = local?.name ?? 'Presupuesto';
  }

  if (!budgetName) {
    budgetName = local?.name ?? 'Presupuesto';
  }

  state = 'ready';
  bumpVersion();

  if (env.SYNC_INTERVAL_SECONDS > 0) {
    if (!syncTimer) {
      syncTimer = setInterval(() => {
        void syncNow();
      }, env.SYNC_INTERVAL_SECONDS * 1_000);
      syncTimer.unref?.();
    }
    // Primer sync en segundo plano: si falla, servimos la copia local.
    void syncNow();
  }
}

export async function syncNow(): Promise<void> {
  if (!internal || state !== 'ready') return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      await api.sync();
      lastSyncAt = new Date().toISOString();
      lastError = null;
      bumpVersion();
    } catch (error) {
      lastError = errorMessage(error);
      console.error('[actual] sync fallido:', lastError);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

async function buildSnapshot(): Promise<Snapshot> {
  if (!internal) throw new Error('Actual no está inicializado');

  const [accountsRaw, groups, categories, payees, txResult] = await Promise.all([
    api.getAccounts(),
    api.getCategoryGroups(),
    api.getCategories(),
    api.getPayees(),
    api.aqlQuery<RawTransaction>(
      api
        .q('transactions')
        .select([
          'id',
          'date',
          'amount',
          'payee',
          'category',
          'account',
          'notes',
          'cleared',
          'transfer_id',
          'parent_id',
          'is_parent',
          'is_child',
        ])
        .orderBy({ date: 'desc' }),
    ),
  ]);

  const balances = await Promise.all(
    accountsRaw.map(async (account: ActualAccount) => {
      try {
        return await api.getAccountBalance(account.id);
      } catch (error) {
        console.error(`[actual] saldo de ${account.name}:`, errorMessage(error));
        return 0;
      }
    }),
  );

  const accounts: Account[] = accountsRaw.map((account, index) => ({
    id: account.id,
    name: account.name,
    offBudget: Boolean(account.offbudget),
    closed: Boolean(account.closed),
    balance: balances[index] ?? 0,
  }));

  const categoryById = new Map(categories.map(category => [category.id, category]));
  const groupById = new Map(groups.map(group => [group.id, group]));
  const payeeById = new Map(payees.map((payee: ActualPayee) => [payee.id, payee.name]));

  const incomeCategoryIds = new Set<string>();
  for (const category of categories) {
    const group = groupById.get(category.group_id);
    if (category.is_income || group?.is_income) incomeCategoryIds.add(category.id);
  }

  const startingBalanceCategoryIds = new Set(
    categories
      .filter(category => category.name === 'Starting Balances')
      .map(category => category.id),
  );

  const transactions = (txResult.data ?? []).filter(
    transaction => !Boolean(transaction.is_parent),
  );

  const activity = new Set<string>();
  for (const transaction of transactions) {
    activity.add(monthOf(transaction.date));
  }

  const activityMonths = [...activity].sort();
  const currentMonth = monthOf(todayInTz(env.TZ));

  return {
    accounts,
    categoryById,
    groupById,
    payeeById,
    transactions,
    activityMonths,
    currentMonth,
    budgetName,
    serverVersion,
    startingBalanceCategoryIds,
    incomeCategoryIds,
  };
}

async function getSnapshot(): Promise<Snapshot> {
  await ensureReady();

  if (
    snapshotCache &&
    snapshotCache.version === dataVersion &&
    Date.now() - snapshotCache.at < 15_000
  ) {
    return snapshotCache.value;
  }

  const value = await buildSnapshot();
  snapshotCache = { version: dataVersion, at: Date.now(), value };
  return value;
}

function mapTransaction(transaction: RawTransaction, snapshot: Snapshot): Transaction {
  const category = transaction.category
    ? snapshot.categoryById.get(transaction.category)
    : undefined;
  const isTransfer = Boolean(transaction.transfer_id);

  return {
    id: transaction.id,
    date: transaction.date,
    amount: transaction.amount,
    payeeId: transaction.payee,
    payeeName:
      snapshot.payeeById.get(transaction.payee ?? '') ?? 'Sin pagador',
    categoryId: transaction.category,
    categoryName: category?.name ?? (isTransfer ? 'Transferencia' : 'Sin categoría'),
    accountId: transaction.account,
    accountName:
      snapshot.accounts.find(account => account.id === transaction.account)?.name ??
      'Cuenta',
    notes: transaction.notes,
    cleared: Boolean(transaction.cleared),
    isTransfer,
    isSplit: Boolean(transaction.parent_id) || Boolean(transaction.is_child),
  };
}

interface MonthTotals {
  income: number;
  expenses: number;
  net: number;
}

function totalsForMonth(transactions: RawTransaction[], month: string, snapshot: Snapshot): MonthTotals {
  let income = 0;
  let expenses = 0;

  for (const transaction of transactions) {
    if (monthOf(transaction.date) !== month) continue;
    if (transaction.transfer_id) continue;

    if (transaction.amount > 0) {
      if (
        transaction.category &&
        snapshot.startingBalanceCategoryIds.has(transaction.category)
      ) {
        continue;
      }
      income += transaction.amount;
    } else {
      expenses += transaction.amount;
    }
  }

  return { income, expenses, net: income + expenses };
}

function spendByCategory(
  transactions: RawTransaction[],
  month: string,
  snapshot: Snapshot,
): CategorySpend[] {
  const rows = new Map<
    string,
    { categoryId: string | null; amount: number; transactions: number }
  >();

  for (const transaction of transactions) {
    if (monthOf(transaction.date) !== month) continue;
    if (transaction.transfer_id) continue;
    if (transaction.amount >= 0) continue;

    const categoryId = transaction.category;
    if (categoryId && snapshot.incomeCategoryIds.has(categoryId)) continue;

    const key = categoryId ?? '__uncategorized__';
    const row = rows.get(key) ?? {
      categoryId,
      amount: 0,
      transactions: 0,
    };
    row.amount += Math.abs(transaction.amount);
    row.transactions += 1;
    rows.set(key, row);
  }

  const total = [...rows.values()].reduce((sum, row) => sum + row.amount, 0);

  return [...rows.values()]
    .map(row => {
      const category = row.categoryId
        ? snapshot.categoryById.get(row.categoryId)
        : undefined;
      const group = category ? snapshot.groupById.get(category.group_id) : undefined;

      return {
        categoryId: row.categoryId,
        categoryName: category?.name ?? 'Sin categoría',
        groupId: category?.group_id ?? null,
        groupName: group?.name ?? null,
        isIncome: Boolean(
          category &&
            (category.is_income || group?.is_income) &&
            snapshot.incomeCategoryIds.has(category.id),
        ),
        amount: row.amount,
        share: total > 0 ? row.amount / total : 0,
        transactions: row.transactions,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

function buildSeries(
  transactions: RawTransaction[],
  selectedMonth: string,
  snapshot: Snapshot,
): MonthlyPoint[] {
  const earliest = snapshot.activityMonths[0] ?? selectedMonth;
  const cappedStart = addMonths(selectedMonth, -11);
  const start = earliest > cappedStart ? earliest : cappedStart;
  const end = selectedMonth >= start ? selectedMonth : start;

  return monthRange(start, end).map(month => {
    const totals = totalsForMonth(transactions, month, snapshot);
    return {
      month,
      income: totals.income,
      expenses: totals.expenses,
      net: totals.net,
    };
  });
}

export async function getOverview(month?: string): Promise<Overview> {
  const snapshot = await getSnapshot();
  const selected =
    month ??
    snapshot.activityMonths.at(-1) ??
    snapshot.currentMonth;

  let budgetMonth: ActualBudgetMonth | null = null;
  try {
    budgetMonth = await api.getBudgetMonth(selected);
  } catch (error) {
    console.error(`[actual] mes ${selected}:`, errorMessage(error));
  }

  const totals = totalsForMonth(snapshot.transactions, selected, snapshot);
  const balance = snapshot.accounts
    .filter(account => !account.offBudget && !account.closed)
    .reduce((sum, account) => sum + account.balance, 0);

  const monthTotals: Totals = {
    balance,
    toBudget: budgetMonth?.toBudget ?? 0,
    income: totals.income,
    expenses: totals.expenses,
    net: totals.net,
    assigned: budgetMonth?.totalBudgeted ?? 0,
    savingsRate: totals.income > 0 ? totals.net / totals.income : null,
  };

  const recentTransactions = snapshot.transactions
    .filter(transaction => monthOf(transaction.date) === selected)
    .slice()
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    )
    .slice(0, 8)
    .map(transaction => mapTransaction(transaction, snapshot));

  return {
    generatedAt: new Date().toISOString(),
    serverVersion: snapshot.serverVersion,
    budgetName: snapshot.budgetName,
    currency: env.CURRENCY,
    month: selected,
    currentMonth: snapshot.currentMonth,
    lastSyncAt,
    readOnly: env.readOnly,
    availableMonths: availableMonths(snapshot),
    accounts: snapshot.accounts,
    totals: monthTotals,
    series: buildSeries(snapshot.transactions, selected, snapshot),
    categories: spendByCategory(snapshot.transactions, selected, snapshot),
    recentTransactions,
  };
}

function availableMonths(snapshot: Snapshot): string[] {
  const months = new Set(snapshot.activityMonths);
  months.add(snapshot.currentMonth);
  return [...months].sort();
}

export async function getMonths(): Promise<{
  currentMonth: string;
  months: string[];
}> {
  const snapshot = await getSnapshot();
  return {
    currentMonth: snapshot.currentMonth,
    months: availableMonths(snapshot),
  };
}

export async function getTransactions(
  query: TransactionsQuery,
): Promise<TransactionsResponse> {
  const snapshot = await getSnapshot();

  let filtered = snapshot.transactions;
  if (query.from) {
    filtered = filtered.filter(transaction => transaction.date >= query.from!);
  }
  if (query.to) {
    filtered = filtered.filter(transaction => transaction.date <= query.to!);
  }

  filtered = filtered
    .slice()
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    );

  const items = filtered
    .slice(query.offset, query.offset + query.limit)
    .map(transaction => mapTransaction(transaction, snapshot));

  return {
    total: filtered.length,
    items,
  };
}

export function getHealth(): Health {
  return {
    status: state,
    serverVersion,
    budgetName,
    currency: env.CURRENCY,
    lastSyncAt,
    lastError,
    uptimeSeconds: Math.floor(process.uptime()),
    readOnly: env.readOnly,
  };
}

export async function closeActual(): Promise<void> {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  if (internal) {
    try {
      // Cierra sin llamar a shutdown(): shutdown() hace sync() y podría
      // publicar programadas. En solo lectura preferimos no escribir nada.
      await internal.send('close-budget');
      await sleep(400);
    } catch (error) {
      console.error('[actual] al cerrar:', errorMessage(error));
    } finally {
      internal = null;
      state = 'starting';
      snapshotCache = null;
    }
  }
}
