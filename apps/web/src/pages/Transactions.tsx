import { useState } from 'react';
import {
  Avatar,
  PageHeader,
  ReadOnlyPill,
  SearchButton,
} from '../components/header';
import {
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
} from '../components/icons';
import { TransactionTable } from '../components/TransactionTable';
import { Card, Skeleton } from '../components/ui';
import { useHealth, useTransactions } from '../lib/queries';

const PAGE_SIZES = [50, 100, 200];

export function Transactions() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const query = useTransactions({
    from: from || undefined,
    to: to || undefined,
    limit,
    offset,
  });
  const health = useHealth();
  const currency = health.data?.currency ?? 'EUR';

  const total = query.data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);
  const canGoBack = offset > 0;
  const canGoForward = offset + limit < total;

  return (
    <div>
      <PageHeader
        eyebrow="Ledger"
        title="Movimientos"
        subtitle="Todos los apuntes del presupuesto, ordenados por fecha."
      >
        <ReadOnlyPill />
        <SearchButton />
        <Avatar />
      </PageHeader>

      <Card className="mt-6 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a1a39a]">
              Desde
            </span>
            <input
              type="date"
              value={from}
              onChange={event => {
                setFrom(event.target.value);
                setOffset(0);
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] text-ink-soft transition hover:border-[#d8d4c9]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a1a39a]">
              Hasta
            </span>
            <input
              type="date"
              value={to}
              onChange={event => {
                setTo(event.target.value);
                setOffset(0);
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] text-ink-soft transition hover:border-[#d8d4c9]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a1a39a]">
              Por página
            </span>
            <select
              value={limit}
              onChange={event => {
                setLimit(Number(event.target.value));
                setOffset(0);
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-ink-soft"
            >
              {PAGE_SIZES.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setFrom('');
              setTo('');
              setOffset(0);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-ink-soft transition hover:border-[#d8d4c9]"
          >
            <IconRefresh className="h-3.5 w-3.5" />
            Limpiar
          </button>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-[19px]">
          <div>
            <div className="text-[14.5px] font-semibold tracking-[-0.012em]">
              Movimientos
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted">
              {query.isLoading
                ? 'Cargando…'
                : `${total} ${total === 1 ? 'movimiento' : 'movimientos'}`}
              {from || to ? ' · filtrado' : ''}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11.5px] tabular-nums text-muted">
              {pageStart}–{pageEnd} de {total}
            </span>
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              aria-label="Página anterior"
              className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-ink-soft transition enabled:hover:border-[#d8d4c9] disabled:opacity-40"
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canGoForward}
              onClick={() => setOffset(offset + limit)}
              aria-label="Página siguiente"
              className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-ink-soft transition enabled:hover:border-[#d8d4c9] disabled:opacity-40"
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {query.isLoading ? (
          <div className="space-y-2 px-5 py-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-[10px]" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <div className="flex items-start gap-3 px-5 py-8">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-terra-soft text-terra">
              <IconAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold">
                No se pudieron cargar los movimientos
              </h2>
              <p className="mt-1 text-[12.5px] text-muted">
                {query.error instanceof Error
                  ? query.error.message
                  : 'Inténtalo de nuevo.'}
              </p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-white"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          <TransactionTable
            transactions={query.data?.items ?? []}
            currency={currency}
            showAccount
            showNotes
          />
        )}

        <div className="flex items-center justify-between border-t border-[#f2f0ea] px-5 py-3 text-[11px] text-muted">
          <span>
            {query.isFetching && !query.isLoading ? 'Actualizando…' : ' '}
          </span>
          <span>
            Página {Math.floor(offset / limit) + 1} de{' '}
            {Math.max(1, Math.ceil(total / limit))}
          </span>
        </div>
      </Card>
    </div>
  );
}
