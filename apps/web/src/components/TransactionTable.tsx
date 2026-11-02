import type { Transaction } from '@uiab/contracts';
import {
  avatarColor,
  chartColor,
  formatDay,
  formatMoney,
  initial,
} from '../lib/format';

export function TransactionTable({
  transactions,
  currency,
  showAccount = false,
  showNotes = false,
}: {
  transactions: Transaction[];
  currency: string;
  showAccount?: boolean;
  showNotes?: boolean;
}) {
  if (transactions.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-[12.5px] text-muted">
        No hay movimientos en este periodo.
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border-y border-[#f2f0ea] px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a1a39a]">
              Movimiento
            </th>
            <th className="hidden border-y border-[#f2f0ea] px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a1a39a] sm:table-cell">
              Fecha
            </th>
            {showAccount ? (
              <th className="hidden border-y border-[#f2f0ea] px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a1a39a] md:table-cell">
                Cuenta
              </th>
            ) : null}
            {showNotes ? (
              <th className="hidden border-y border-[#f2f0ea] px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a1a39a] lg:table-cell">
                Notas
              </th>
            ) : null}
            <th className="border-y border-[#f2f0ea] px-5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a1a39a]">
              Importe
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(transaction => {
            const avatar = avatarColor(transaction.payeeName);
            const dot = chartColor(
              transaction.categoryId ?? transaction.categoryName,
            );

            return (
              <tr
                key={transaction.id}
                className="transition-colors hover:bg-[#fbfaf7]"
              >
                <td className="border-b border-[#f6f4ef] px-5 py-[9px] align-middle last:border-b-0">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[10px] text-[11px] font-semibold"
                      style={{ background: avatar.bg, color: avatar.fg }}
                      aria-hidden="true"
                    >
                      {initial(transaction.payeeName)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-medium leading-tight">
                        {transaction.payeeName}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted">
                        <i
                          className="h-[5px] w-[5px] shrink-0 rounded-full"
                          style={{ background: dot }}
                        />
                        <span className="truncate">
                          {transaction.categoryName}
                        </span>
                        {transaction.isSplit ? (
                          <span className="rounded bg-[#f3f1ea] px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-[#9a9c92]">
                            split
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="hidden whitespace-nowrap border-b border-[#f6f4ef] px-5 py-[9px] text-[11.5px] text-muted sm:table-cell">
                  {formatDay(transaction.date)}
                </td>

                {showAccount ? (
                  <td className="hidden whitespace-nowrap border-b border-[#f6f4ef] px-5 py-[9px] text-[11.5px] text-muted md:table-cell">
                    {transaction.accountName}
                  </td>
                ) : null}

                {showNotes ? (
                  <td className="hidden max-w-[220px] truncate border-b border-[#f6f4ef] px-5 py-[9px] text-[11.5px] text-muted lg:table-cell">
                    {transaction.notes || '—'}
                  </td>
                ) : null}

                <td
                  className={[
                    'whitespace-nowrap border-b border-[#f6f4ef] px-5 py-[9px] text-right text-[12.5px] font-semibold tabular-nums',
                    transaction.amount > 0 ? 'text-brand-2' : 'text-ink',
                  ].join(' ')}
                >
                  {formatMoney(transaction.amount, currency, {
                    sign: transaction.amount > 0,
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
