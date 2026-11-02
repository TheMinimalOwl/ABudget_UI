import type { MonthlyPoint } from '@uiab/contracts';
import {
  formatMoney,
  formatMoneyShort,
  formatMonth,
  formatMonthShort,
  niceMax,
} from '../lib/format';

export function MonthlyFlowChart({
  series,
  currency,
}: {
  series: MonthlyPoint[];
  currency: string;
}) {
  if (series.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-[12.5px] text-muted">
        Todavía no hay movimientos para dibujar la evolución.
      </div>
    );
  }

  const peak = Math.max(
    100,
    ...series.flatMap(point => [point.income, Math.abs(point.expenses)]),
  );
  const max = niceMax(peak);
  const ticks = [max, (max * 2) / 3, max / 3, 0];

  const barHeight = (value: number) =>
    value > 0 ? Math.max((value / max) * 100, 1.5) : 0;

  return (
    <div className="px-5 pb-2 pt-4">
      <div className="flex gap-2.5">
        <div className="flex h-[196px] w-11 shrink-0 flex-col justify-between pb-0 pt-px text-right text-[10px] tabular-nums text-[#a1a39a]">
          {ticks.map(tick => (
            <span key={tick}>{formatMoneyShort(tick, currency)}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-[196px]">
            {ticks.map((tick, index) => (
              <div
                key={`${tick}-${index}`}
                className="absolute inset-x-0 border-t border-dashed border-[#eeece5]"
                style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex items-end gap-1">
              {series.map(point => (
                <div
                  key={point.month}
                  className="group flex h-full flex-1 items-end justify-center"
                  title={`${formatMonth(point.month)} · Ingresos ${formatMoney(
                    point.income,
                    currency,
                  )} · Gastos ${formatMoney(point.expenses, currency)}`}
                >
                  <div className="flex h-full w-full items-end justify-center gap-1">
                    <div
                      className="w-2.5 rounded-t-[4px] bg-brand-2/90 transition-opacity group-hover:opacity-100"
                      style={{ height: `${barHeight(point.income)}%` }}
                    />
                    <div
                      className="w-2.5 rounded-t-[4px] bg-[#d08a66]/90 transition-opacity group-hover:opacity-100"
                      style={{ height: `${barHeight(Math.abs(point.expenses))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 flex gap-1 text-[10px] font-medium text-[#9a9c92]">
            {series.map(point => (
              <span key={point.month} className="flex-1 text-center">
                {formatMonthShort(point.month)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
