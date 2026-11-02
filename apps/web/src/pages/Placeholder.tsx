import { PageHeader, ReadOnlyPill } from '../components/header';
import { IconInbox } from '../components/icons';
import { Card } from '../components/ui';

export function Placeholder({
  eyebrow,
  title,
  subtitle,
  description,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <ReadOnlyPill />
      </PageHeader>

      <Card className="fade-up mt-7 overflow-hidden">
        <div
          className="relative px-6 py-10 sm:px-10"
          style={{
            background:
              'radial-gradient(90% 120% at 100% 0%, #eef4f0 0%, rgba(255,255,255,0) 60%)',
          }}
        >
          <div className="relative max-w-xl">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
              <IconInbox className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-[20px] font-semibold tracking-[-0.02em]">
              En preparación
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {description}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {['Datos reales', 'Solo lectura', 'Fase 2'].map(label => (
                <span
                  key={label}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-soft"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
