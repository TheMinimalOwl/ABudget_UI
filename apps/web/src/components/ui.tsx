import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-[20px] border border-line bg-card shadow-[0_1px_2px_rgba(31,33,29,0.03)] ${className}`}
    >
      {children}
    </article>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[#eeece5] ${className}`}
      aria-hidden="true"
    />
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'up' | 'down';
}) {
  const tones = {
    neutral: 'bg-[#f3f1ea] text-[#9a9c92]',
    up: 'bg-brand-soft text-brand',
    down: 'bg-terra-soft text-terra',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11.5px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function SoftBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[#f3f1ea] px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.05em] text-[#9a9c92]">
      {children}
    </span>
  );
}
