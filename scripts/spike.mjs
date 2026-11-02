/**
 * Spike de solo lectura contra un servidor Actual.
 *
 * Importante: `api.shutdown()` sincroniza automáticamente, y un `sync()` puede
 * postear transacciones programadas. Para que este script no escriba nada en el
 * servidor:
 *   - si el presupuesto ya está en local, usa `loadBudget` (no sincroniza);
 *   - si no está, usa `downloadBudget` (descarga sin sync);
 *   - cierra con el handler `close-budget` en vez de `shutdown()`.
 *
 * Para forzar un sync (y aceptar sus efectos), ejecutar con `--sync`.
 */
import * as api from '@actual-app/api';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const env = process.env;
const required = ['ACTUAL_SERVER_URL', 'ACTUAL_PASSWORD', 'ACTUAL_BUDGET_SYNC_ID'];
const missing = required.filter(key => !env[key]);

if (missing.length > 0) {
  console.error(`Faltan variables de entorno: ${missing.join(', ')}`);
  console.error('Copia .env.example a .env y rellena los valores.');
  process.exit(1);
}

const dataDir = path.resolve(env.ACTUAL_DATA_DIR ?? './.data');
await mkdir(dataDir, { recursive: true });

let lib;
let budgetLoaded = false;

try {
  lib = await api.init({
    dataDir,
    serverURL: env.ACTUAL_SERVER_URL,
    password: env.ACTUAL_PASSWORD,
  });

  console.log('Servidor:', await api.getServerVersion());

  const budgets = await api.getBudgets();
  console.log(
    'Presupuestos:',
    budgets.map(b => ({
      name: b.name,
      syncId: b.groupId,
      local: Boolean(b.id),
      hasKey: b.hasKey,
    })),
  );

  const local = budgets.find(
    b => b.groupId === env.ACTUAL_BUDGET_SYNC_ID && b.id,
  );

  if (local) {
    console.log(`Cargando copia local ${local.id} (sin sync)...`);
    await api.loadBudget(local.id);
  } else {
    console.log('Descargando copia del presupuesto (sin sync)...');
    await api.downloadBudget(
      env.ACTUAL_BUDGET_SYNC_ID,
      env.ACTUAL_BUDGET_PASSWORD ? { password: env.ACTUAL_BUDGET_PASSWORD } : {},
    );
  }
  budgetLoaded = true;

  const accounts = await api.getAccounts();
  console.log(
    'Cuentas:',
    accounts.map(a => ({
      name: a.name,
      id: a.id,
      offbudget: a.offbudget,
      closed: a.closed,
      balanceCurrent: a.balance_current,
    })),
  );

  const months = await api.getBudgetMonths();
  console.log(`Meses (${months.length}):`, months.slice(-12));

  const lastMonth = months.at(-1);
  if (lastMonth) {
    const month = await api.getBudgetMonth(lastMonth);
    console.log('Presupuesto del mes:', {
      month: month.month,
      toBudget: month.toBudget,
      incomeAvailable: month.incomeAvailable,
      totalBudgeted: month.totalBudgeted,
      categoryGroups: month.categoryGroups?.length,
    });
  }

  const { data: transactions } = await api.aqlQuery(
    api
      .q('transactions')
      .select([
        'id',
        'date',
        'amount',
        'payee',
        'category',
        'account',
        'cleared',
        'transfer_id',
      ])
      .orderBy({ date: 'desc' })
      .limit(10),
  );
  console.log('Últimas transacciones:', transactions);

  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: byCategory } = await api.aqlQuery(
    api
      .q('transactions')
      .filter({ date: { $gte: sinceStr } })
      .groupBy('category')
      .select(['category', { total: { $sum: '$amount' } }]),
  );
  console.log(`Gasto por categoría desde ${sinceStr}:`, byCategory);

  if (process.argv.includes('--sync')) {
    console.log('Sync solicitado explícitamente...');
    await api.sync();
    console.log('Sync completado.');
  } else {
    console.log('Sin sync: no se ha escrito nada en el servidor.');
  }
} catch (error) {
  console.error('Error:', error?.code ?? '', error?.message ?? error);
  process.exitCode = 1;
} finally {
  if (lib && budgetLoaded) {
    try {
      // Cierre sin sync (shutdown() llamaría a sync()).
      await lib.send('close-budget');
      // Deja que el volcado de metadata.json termine antes de salir.
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Presupuesto cerrado sin sincronizar.');
    } catch (error) {
      console.error('No se pudo cerrar el presupuesto:', error?.message ?? error);
    }
  }
  // Evita que queden handles abiertos (SQLite, timers del motor).
  process.exit(process.exitCode ?? 0);
}
