/**
 * Explorador de solo lectura: vuelca las formas reales del presupuesto para
 * diseñar el contrato del BFF y las pantallas de la UI.
 *
 * No llama a sync() ni a shutdown().
 */
import * as api from '@actual-app/api';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const env = process.env;
const dataDir = path.resolve(env.DATA_DIR ?? './.data');
await mkdir(dataDir, { recursive: true });

const money = n => (n == null ? null : (n / 100).toFixed(2));

const lib = await api.init({
  dataDir,
  serverURL: env.ACTUAL_SERVER_URL,
  password: env.ACTUAL_PASSWORD,
});

let loaded = false;
try {
  const budgets = await api.getBudgets();
  const local = budgets.find(
    b => b.groupId === env.ACTUAL_BUDGET_SYNC_ID && b.id,
  );

  if (local) {
    await api.loadBudget(local.id);
  } else {
    await api.downloadBudget(
      env.ACTUAL_BUDGET_SYNC_ID,
      env.ACTUAL_BUDGET_PASSWORD
        ? { password: env.ACTUAL_BUDGET_PASSWORD }
        : {},
    );
  }
  loaded = true;

  console.log('## Servidor', await api.getServerVersion());

  const accounts = await api.getAccounts();
  console.log('\n## Cuentas');
  for (const account of accounts) {
    const balance = await api.getAccountBalance(account.id);
    console.log({
      id: account.id,
      name: account.name,
      offbudget: account.offbudget,
      closed: account.closed,
      balance: money(balance),
    });
  }

  console.log('\n## Grupos de cuentas', await api.getAccountGroups());

  const groups = await api.getCategoryGroups();
  const categories = await api.getCategories();
  const payees = await api.getPayees();
  const byId = new Map(categories.map(c => [c.id, c]));
  const payeeById = new Map(payees.map(p => [p.id, p.name]));
  const startingBalanceIds = new Set(
    categories.filter(c => c.name === 'Starting Balances').map(c => c.id),
  );

  console.log('\n## Grupos de categorías');
  for (const group of groups) {
    const cats = categories.filter(c => c.group_id === group.id);
    console.log({
      id: group.id,
      name: group.name,
      is_income: group.is_income,
      hidden: group.hidden,
      categories: cats.map(c => c.name),
    });
  }

  console.log('\n## Preferencias');
  console.log(await api.getPreferences());

  console.log('\n## Programadas');
  const schedules = await api.getSchedules();
  console.log('total:', schedules.length);

  for (const month of ['2026-10', '2026-11', '2026-12']) {
    const bm = await api.getBudgetMonth(month);
    console.log(`\n## Presupuesto ${month}`);
    console.log({
      toBudget: money(bm.toBudget),
      incomeAvailable: money(bm.incomeAvailable),
      totalBudgeted: money(bm.totalBudgeted),
      totalSpent: money(bm.totalSpent),
      buffered: money(bm.buffered),
    });
    for (const group of bm.categoryGroups ?? []) {
      const rows = (group.categories ?? [])
        .filter(c => c.budgeted !== 0 || c.spent !== 0 || c.balance !== 0)
        .map(c => ({
          category: c.name,
          budgeted: money(c.budgeted),
          spent: money(c.spent),
          balance: money(c.balance),
        }));
      if (rows.length > 0 || group.is_income) {
        console.log(` ${group.name}:`, rows);
      }
    }
  }

  console.log('\n## Transacciones (desde 2025-11)');
  const { data: txs } = await api.aqlQuery(
    api
      .q('transactions')
      .filter({ date: { $gte: '2025-11-01' } })
      .select([
        'id',
        'date',
        'amount',
        'payee',
        'category',
        'account',
        'transfer_id',
        'cleared',
      ])
      .orderBy({ date: 'asc' }),
  );
  console.log('total:', txs.length, '| transfers:', txs.filter(t => t.transfer_id).length);

  console.log('\n## Últimas 12 transacciones');
  for (const t of txs.slice(-12).reverse()) {
    console.log({
      date: t.date,
      amount: money(t.amount),
      payee: payeeById.get(t.payee) ?? '(sin pagador)',
      category: byId.get(t.category)?.name ?? '(sin categoría)',
      cleared: Boolean(t.cleared),
    });
  }

  const byMonth = new Map();
  for (const t of txs) {
    const month = t.date.slice(0, 7);
    const row = byMonth.get(month) ?? { n: 0, income: 0, expenses: 0 };
    row.n += 1;
    if (t.amount > 0) {
      if (!startingBalanceIds.has(t.category)) row.income += t.amount;
    } else {
      row.expenses += t.amount;
    }
    byMonth.set(month, row);
  }

  console.log('\n## Resumen mensual (ingresos sin saldos iniciales)');
  const months = [...byMonth.keys()].sort();
  for (const month of months) {
    const row = byMonth.get(month);
    const bm = await api.getBudgetMonth(month);
    console.log({
      month,
      transactions: row.n,
      income: money(row.income),
      expenses: money(row.expenses),
      net: money(row.income + row.expenses),
      budgeted: money(bm.totalBudgeted),
      toBudget: money(bm.toBudget),
    });
  }

  console.log('\n## Gasto por categoría (2026-08-01 .. hoy)');
  const recent = txs.filter(t => t.date >= '2026-08-01' && t.amount < 0);
  const catTotals = new Map();
  for (const t of recent) {
    const row = catTotals.get(t.category) ?? { total: 0, n: 0 };
    row.total += t.amount;
    row.n += 1;
    catTotals.set(t.category, row);
  }
  for (const [category, row] of [...catTotals].sort((a, b) => a[1].total - b[1].total)) {
    console.log({
      category: byId.get(category)?.name ?? '(sin categoría)',
      total: money(row.total),
      transactions: row.n,
    });
  }

  console.log('\n## Top pagadores (2026-08-01 .. hoy)');
  const payeeTotals = new Map();
  for (const t of recent) {
    const row = payeeTotals.get(t.payee) ?? { total: 0, n: 0 };
    row.total += t.amount;
    row.n += 1;
    payeeTotals.set(t.payee, row);
  }
  for (const [payee, row] of [...payeeTotals]
    .sort((a, b) => a[1].total - b[1].total)
    .slice(0, 10)) {
    console.log({
      payee: payeeById.get(payee) ?? '(desconocido)',
      total: money(row.total),
      transactions: row.n,
    });
  }
} catch (error) {
  console.error('Error:', error?.message ?? error);
  process.exitCode = 1;
} finally {
  if (loaded) {
    try {
      await lib.send('close-budget');
      // Deja que el volcado de metadata.json termine antes de salir.
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch {}
  }
  process.exit(process.exitCode ?? 0);
}

function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m, 1));
  return date.toISOString().slice(0, 10);
}
