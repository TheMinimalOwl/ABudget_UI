import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MonthlyFlowChart } from '../components/MonthlyFlowChart';
import { SpendingDonut } from '../components/SpendingDonut';
import { TransactionTable } from '../components/TransactionTable';
import {
  Avatar,
  MonthSelect,
  PageHeader,
  ReadOnlyPill,
  SearchButton,
} from '../components/header';
import {
  IconAlert,
  IconArrowRight,
  IconChart,
  IconReceipt,
  IconTrendUp,
  IconWallet,
} from '../components/icons';
import { Badge, Card, Skeleton, SoftBadge } from '../components/ui';
import {
  formatDateTime,
  formatMoney,
  formatMonth,
  formatMonthShort,
  formatPercent,
  formatSignedPercent,
  monthName,
} from '../lib/format';
import { useHealth, useOverview } from '../lib/queries';

function KpiCard({
  label,
  value,
  foot,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  foot: ReactNode;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card
      className={[
        'fade-up relative overflow-hidden px-5 pb-[17px] pt-[19px]',
        accent
          ? 'border-transparent text-white shadow-[0_10px_24px_rgba(31,111,92,0.18)]'
          : '',
      ].join(' ')}
    >
      {accent ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 150% at 100% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 55%), linear-gradient(155deg, #1f6f5c 0%, #2a7a66 100%)',
          }}
        />
      ) : null}

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span
            className={[
              'text-[12.5px] font-medium',
              accent ? 'text-white/75' : 'text-muted',
            ].join(' ')}
          >
            {label}
          </span>
          <span
            className={[
              'grid h-[30px] w-[30px] place-items-center rounded-[10px]',
              accent ? 'bg-white/15 text-white' : 'bg-brand-soft text-brand-2',
            ].join(' ')}
          >
            {icon}
          </span>
        </div>

        <div className="mt-[13px] text-[30px] font-[645] leading-[1.1] tracking-[-0.04em] tabular-nums">
          {value}
        </div>

        <div
          className={[
            'mt-[11px] flex flex-wrap items-center gap-1.5 text-[12px]',
            accent ? 'text-white/75' : 'text-muted',
          ].join(' ')}
        >
          {foot}
        </div>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div>
          <Skeleton className="h-3 w-48" />
          <Skeleton className="mt-3 h-9 w-40" />
          <Skeleton className="mt-2 h-3.5 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map(index => (
          <Card key={index} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-40" />
            <Skeleton className="mt-3 h-3 w-28" />
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-5 h-[196px] w-full" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mx-auto mt-6 h-[136px] w-[136px] rounded-full" />
          <Skeleton className="mt-6 h-3 w-full" />
        </Card>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const monthParam = params.get('mes') || undefined;
  const overview = useOverview(monthParam);
  const health = useHealth();

  if (overview.isLoading) return <DashboardSkeleton />;

  if (overview.isError || !overview.data) {
    return (
      <div>
        <PageHeader
          eyebrow="Resumen"
          title="Resumen"
          subtitle="Todo lo importante de tu dinero, sin ruido."
        >
          <ReadOnlyPill />
        </PageHeader>

        <Card className="mt-7 p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-terra-soft text-terra">
              <IconAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold">
                No se pudo cargar el resumen
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                {overview.error instanceof Error
                  ? overview.error.message
                  : 'Comprueba que el BFF está arrancado y que el servidor de Actual responde.'}
              </p>
              <button
                type="button"
                onClick={() => void overview.refetch()}
                className="mt-4 rounded-full bg-brand px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-2"
              >
                Reintentar
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const data = overview.data;
  const months = data.availableMonths.includes(data.month)
    ? data.availableMonths
    : [...data.availableMonths, data.month].sort();

  const onBudgetAccounts = data.accounts.filter(
    account => !account.offBudget && !account.closed,
  );
  const accountLabel =
    onBudgetAccounts.length === 0
      ? 'Sin cuentas'
      : `${onBudgetAccounts.map(account => account.name).join(', ')} · ${
          onBudgetAccounts.length
        } ${onBudgetAccounts.length === 1 ? 'cuenta' : 'cuentas'}`;

  const selectedIndex = data.series.findIndex(
    point => point.month === data.month,
  );
  const previous =
    selectedIndex > 0 ? data.series[selectedIndex - 1] : undefined;
  const expenseChange =
    previous && previous.expenses !== 0
      ? (Math.abs(data.totals.expenses) - Math.abs(previous.expenses)) /
        Math.abs(previous.expenses)
      : null;

  const activeMonths = data.series.filter(
    point => point.income !== 0 || point.expenses !== 0,
  );
  const averageExpenses =
    activeMonths.length > 0
      ? activeMonths.reduce(
          (sum, point) => sum + Math.abs(point.expenses),
          0,
        ) / activeMonths.length
      : 0;

  const expenseMonths = data.series.filter(point => point.expenses !== 0);
  const bestMonth = expenseMonths.reduce<(typeof expenseMonths)[number] | null>(
    (best, point) =>
      best === null || Math.abs(point.expenses) < Math.abs(best.expenses)
        ? point
        : best,
    null,
  );

  const assignedRatio =
    data.totals.income > 0 && data.totals.assigned > 0
      ? Math.min(100, (data.totals.assigned / data.totals.income) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        eyebrow={`${formatMonth(data.month)} · ${
          data.month === data.currentMonth ? 'mes en curso' : 'resumen mensual'
        }`}
        title="Resumen"
        subtitle="Todo lo importante de tu dinero, sin ruido."
      >
        <ReadOnlyPill />
        <MonthSelect
          value={data.month}
          months={months}
          onChange={month => setParams({ mes: month })}
        />
        <SearchButton />
        <Avatar />
      </PageHeader>

      {health.data?.lastError ? (
        <div className="mt-5 flex items-start gap-2 rounded-[14px] border border-[#efd9c8] bg-[#fdf6ef] px-4 py-3 text-[12px] text-[#8a5a37]">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No se pudo sincronizar con Actual: {health.data.lastError}. Se
            muestra la última copia local.
          </span>
        </div>
      ) : null}

      <section
        className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        aria-label="Indicadores"
      >
        <KpiCard
          accent
          label="Saldo total"
          value={formatMoney(data.totals.balance, data.currency)}
          icon={<IconWallet className="h-[15px] w-[15px]" />}
          foot={
            <span>
              {onBudgetAccounts[0]?.name ?? 'Sin cuentas'} ·{' '}
              {onBudgetAccounts.length}{' '}
              {onBudgetAccounts.length === 1 ? 'cuenta' : 'cuentas'}
            </span>
          }
        />

        <KpiCard
          label={`Gasto en ${monthName(data.month)}`}
          value={formatMoney(Math.abs(data.totals.expenses), data.currency)}
          icon={<IconReceipt className="h-[15px] w-[15px]" />}
          foot={
            Math.abs(data.totals.expenses) === 0 ? (
              <span>Sin gastos este mes</span>
            ) : expenseChange === null ? (
              <span>Sin mes anterior con gasto</span>
            ) : (
              <>
                <Badge tone={expenseChange < 0 ? 'down' : 'up'}>
                  {formatSignedPercent(expenseChange)}
                </Badge>
                <span>vs. {formatMonthShort(previous!.month)}</span>
              </>
            )
          }
        />

        <KpiCard
          label={`Ahorro en ${monthName(data.month)}`}
          value={formatMoney(data.totals.net, data.currency, { sign: true })}
          icon={<IconTrendUp className="h-[15px] w-[15px]" />}
          foot={
            data.totals.savingsRate === null ? (
              <span>Sin ingresos este mes</span>
            ) : (
              <>
                <Badge tone={data.totals.net >= 0 ? 'up' : 'down'}>
                  {formatPercent(data.totals.savingsRate)}
                </Badge>
                <span>de tus ingresos</span>
              </>
            )
          }
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
        <Card className="fade-up delay-1">
          <div className="flex items-start justify-between gap-4 px-5 pt-[19px]">
            <div>
              <div className="text-[14.5px] font-semibold tracking-[-0.012em]">
                Flujo mensual
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted">
                Ingresos y gastos · {data.month.slice(0, 4)}
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11.5px] font-medium text-muted">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-[3px] bg-brand-2" />
                Ingresos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-[3px] bg-[#d08a66]" />
                Gastos
              </span>
            </div>
          </div>

          <MonthlyFlowChart series={data.series} currency={data.currency} />

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#f2f0ea] px-5 py-3 text-[11.5px] text-muted">
            <span>
              Media de gasto{' '}
              <b className="font-semibold text-ink-soft">
                {formatMoney(averageExpenses, data.currency)}/mes
              </b>
            </span>
            <span>
              Mejor mes{' '}
              <b className="font-semibold text-ink-soft">
                {bestMonth
                  ? `${monthName(bestMonth.month)} · ${formatMoney(
                      Math.abs(bestMonth.expenses),
                      data.currency,
                    )}`
                  : '—'}
              </b>
            </span>
            <span>
              {formatMonthShort(data.month)}{' '}
              <b className="font-semibold text-ink-soft">
                {Math.abs(data.totals.expenses) === 0
                  ? 'sin gastos'
                  : expenseChange === null
                    ? 'sin comparativa'
                    : `${formatSignedPercent(expenseChange)} vs. ${formatMonthShort(
                        previous!.month,
                      )}`}
              </b>
            </span>
          </div>
        </Card>

        <Card className="fade-up delay-2">
          <div className="flex items-start justify-between gap-4 px-5 pt-[19px]">
            <div>
              <div className="text-[14.5px] font-semibold tracking-[-0.012em]">
                Gasto de {monthName(data.month)}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted">
                Por categoría
              </div>
            </div>
            <SoftBadge>
              {data.categories.length}{' '}
              {data.categories.length === 1 ? 'categoría' : 'categorías'}
            </SoftBadge>
          </div>

          <SpendingDonut
            categories={data.categories}
            currency={data.currency}
          />
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
        <Card className="fade-up delay-3">
          <div className="flex items-start justify-between gap-4 px-5 pt-[19px]">
            <div>
              <div className="text-[14.5px] font-semibold tracking-[-0.012em]">
                Últimos movimientos
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted">
                {formatMonth(data.month)}
              </div>
            </div>
            <Link
              to="/movimientos"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand"
            >
              Ver todos
              <IconArrowRight className="h-[13px] w-[13px]" />
            </Link>
          </div>

          <TransactionTable
            transactions={data.recentTransactions}
            currency={data.currency}
          />
        </Card>

        <Card className="fade-up delay-3">
          <div className="flex items-start justify-between gap-4 px-5 pt-[19px]">
            <div>
              <div className="text-[14.5px] font-semibold tracking-[-0.012em]">
                Presupuesto de {monthName(data.month)}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted">
                Sobres y disponible
              </div>
            </div>
            <SoftBadge>Próximamente</SoftBadge>
          </div>

          <div className="px-5 pb-5 pt-4">
            <div className="mt-1.5 text-[27px] font-[650] leading-[1.1] tracking-[-0.04em] tabular-nums">
              {formatMoney(data.totals.toBudget, data.currency)}
            </div>
            <div className="text-[11.5px] text-muted">
              disponible para presupuestar
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-[#f2f0ea] pt-3.5">
              <div className="flex justify-between gap-3 text-[12px] text-muted">
                <span>Ingresos</span>
                <b className="font-semibold tabular-nums text-ink-soft">
                  {formatMoney(data.totals.income, data.currency)}
                </b>
              </div>
              <div className="flex justify-between gap-3 text-[12px] text-muted">
                <span>Gastado</span>
                <b className="font-semibold tabular-nums text-ink-soft">
                  {formatMoney(data.totals.expenses, data.currency)}
                </b>
              </div>
              <div className="flex justify-between gap-3 text-[12px] text-muted">
                <span>Ahorro</span>
                <b
                  className="font-semibold tabular-nums"
                  style={{
                    color: data.totals.net >= 0 ? '#2e8067' : '#b5643f',
                  }}
                >
                  {formatMoney(data.totals.net, data.currency, { sign: true })}
                </b>
              </div>
              <div className="flex justify-between gap-3 text-[12px] text-muted">
                <span>Asignado a sobres</span>
                <b className="font-semibold tabular-nums text-ink-soft">
                  {formatMoney(data.totals.assigned, data.currency)}
                </b>
              </div>
            </div>

            <div className="mt-4 h-[7px] overflow-hidden rounded-full bg-[#f0eee7]">
              <span
                className="block h-full rounded-full bg-brand-2"
                style={{ width: `${assignedRatio}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-[#a1a39a]">
              <span>
                {formatMoney(data.totals.assigned, data.currency)} de{' '}
                {formatMoney(data.totals.income, data.currency)} asignados
              </span>
              <span>{Math.round(assignedRatio)}%</span>
            </div>

            <p className="mt-4 rounded-[11px] bg-[#f8f7f3] px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
              {data.totals.assigned === 0
                ? 'Aún no usas sobres. Cuando empieces, aquí verás cuánto queda en cada categoría y qué puedes mover.'
                : 'Este mes ya tienes dinero asignado a sobres. La edición llegará en la fase 2.'}
            </p>

            <button
              type="button"
              disabled
              className="mt-3 w-full rounded-[11px] border border-dashed border-[#d8d4c9] px-3 py-2.5 text-[12px] font-semibold text-[#9a9c92]"
            >
              Asignar presupuesto · fase 2
            </button>
          </div>
        </Card>
      </section>

      <div className="mt-5 flex flex-wrap justify-between gap-2.5 px-1 text-[10.5px] text-[#a1a39a]">
        <span>Norte · datos reales de “{data.budgetName}”</span>
        <span>
          Actualizado el {formatDateTime(data.generatedAt)} · modo solo lectura
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 px-1 text-[10.5px] text-[#a1a39a]">
        <span className="inline-flex items-center gap-1">
          <IconChart className="h-3 w-3" />
          {data.series.length} meses en la serie
        </span>
        <span className="inline-flex items-center gap-1">
          <IconWallet className="h-3 w-3" />
          {accountLabel}
        </span>
      </div>
    </div>
  );
}
