import type { ReactNode } from 'react';
import { IconCalendar, IconChevronDown, IconLock, IconSearch } from './icons';
import { formatMonth } from '../lib/format';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-muted">
          {eyebrow}
        </div>
        <h1 className="mt-1.5 text-[27px] font-[640] leading-[1.1] tracking-[-0.035em] sm:text-[32px]">
          {title}
        </h1>
        <p className="mt-1 max-w-xl text-[13.5px] text-muted">{subtitle}</p>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2 lg:pt-1.5">
          {children}
        </div>
      ) : null}
    </header>
  );
}

export function ReadOnlyPill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#cfe2da] bg-brand-soft px-3 py-2 text-[12.5px] font-semibold text-brand">
      <IconLock className="h-4 w-4" />
      Solo lectura
    </span>
  );
}

export function MonthSelect({
  value,
  months,
  onChange,
}: {
  value: string;
  months: string[];
  onChange: (month: string) => void;
}) {
  return (
    <div className="relative">
      <IconCalendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/70" />
      <select
        aria-label="Mes"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="appearance-none rounded-full border border-line bg-white py-2 pl-9 pr-9 text-[12.5px] font-semibold text-ink-soft transition hover:border-[#d8d4c9]"
      >
        {months.map(month => (
          <option key={month} value={month}>
            {formatMonth(month)}
          </option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/70" />
    </div>
  );
}

export function SearchButton() {
  return (
    <button
      type="button"
      disabled
      title="Búsqueda global · fase 2"
      aria-label="Buscar"
      className="hidden h-[38px] w-[38px] place-items-center rounded-full border border-line bg-white text-[#6b6e64] opacity-60 sm:grid"
    >
      <IconSearch className="h-[17px] w-[17px]" />
    </button>
  );
}

export function Avatar({ label = 'M' }: { label?: string }) {
  return (
    <div
      className="hidden h-[38px] w-[38px] place-items-center rounded-full bg-[#ddd8cb] text-[12.5px] font-semibold text-[#5a564a] sm:grid"
      aria-label="Perfil"
    >
      {label}
    </div>
  );
}
