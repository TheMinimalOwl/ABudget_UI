import { Link } from 'react-router-dom';
import type { CategorySpend } from '@uiab/contracts';
import { chartColor, formatMoney, formatPercent } from '../lib/format';
import { IconArrowRight } from './icons';

function withOthers(categories: CategorySpend[]): CategorySpend[] {
  const top = categories.slice(0, 5);
  const rest = categories.slice(5);

  if (rest.length === 0) return top;

  const amount = rest.reduce((sum, category) => sum + category.amount, 0);
  const total = categories.reduce((sum, category) => sum + category.amount, 0);

  return [
    ...top,
    {
      categoryId: null,
      categoryName: `Otras (${rest.length})`,
      groupId: null,
      groupName: null,
      isIncome: false,
      amount,
      share: total > 0 ? amount / total : 0,
      transactions: rest.reduce(
        (sum, category) => sum + category.transactions,
        0,
      ),
    },
  ];
}

export function SpendingDonut({
  categories,
  currency,
}: {
  categories: CategorySpend[];
  currency: string;
}) {
  const total = categories.reduce((sum, category) => sum + category.amount, 0);
  const display = withOthers(categories);

  let cursor = 0;
  const stops = display.map(category => {
    const start = cursor;
    cursor += category.share * 100;
    return `${chartColor(
      category.categoryId ?? category.categoryName,
    )} ${start}% ${cursor}%`;
  });

  const background = stops.length
    ? `conic-gradient(${stops.join(', ')})`
    : '#f0eee7';

  return (
    <div className="px-5 pb-5 pt-2.5">
      <div
        className="relative mx-auto my-2 h-[136px] w-[136px] rounded-full shadow-[inset_0_0_0_1px_rgba(31,33,29,0.03)]"
        style={{ background }}
        role="img"
        aria-label={`Gasto del mes: ${formatMoney(total, currency)}`}
      >
        <div className="absolute inset-[17px] rounded-full bg-white" />
        <div className="absolute inset-[17px] z-10 flex flex-col items-center justify-center gap-px">
          <span className="text-[18px] font-[650] tracking-[-0.03em] tabular-nums">
            {formatMoney(total, currency)}
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted">
            gastado
          </span>
        </div>
      </div>

      {display.length === 0 ? (
        <p className="mt-4 text-center text-[12px] text-muted">
          Sin gastos registrados este mes.
        </p>
      ) : (
        <div className="mt-3.5 flex flex-col gap-2.5">
          {display.map(category => (
            <div
              key={category.categoryId ?? category.categoryName}
              className="grid grid-cols-[10px_minmax(0,1fr)_auto_40px] items-center gap-2.5 text-[12px]"
            >
              <i
                className="h-[9px] w-[9px] rounded-[3px]"
                style={{
                  background: chartColor(
                    category.categoryId ?? category.categoryName,
                  ),
                }}
              />
              <span className="truncate text-ink-soft">
                {category.categoryName}
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(category.amount, currency)}
              </span>
              <span className="text-right text-[10.5px] tabular-nums text-[#a1a39a]">
                {formatPercent(category.share)}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link
        to="/informes"
        className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand"
      >
        Ver todas las categorías
        <IconArrowRight className="h-[13px] w-[13px]" />
      </Link>
    </div>
  );
}
