import { NavLink } from 'react-router-dom';
import { relativeTime } from '../lib/format';
import { useHealth } from '../lib/queries';
import {
  IconChart,
  IconCompass,
  IconHome,
  IconList,
  IconSettings,
  IconWallet,
} from './icons';

const navigation = [
  { to: '/', label: 'Resumen', icon: IconHome, end: true },
  { to: '/movimientos', label: 'Movimientos', icon: IconList, end: false },
  { to: '/presupuesto', label: 'Presupuesto', icon: IconWallet, end: false },
  { to: '/informes', label: 'Informes', icon: IconChart, end: false },
];

const systemNavigation = [
  { to: '/ajustes', label: 'Ajustes', icon: IconSettings, end: false },
];

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[13.5px] transition',
    'min-[900px]:max-[1179px]:justify-center min-[900px]:max-[1179px]:px-[11px] min-[900px]:max-[1179px]:py-[11px]',
    isActive
      ? 'bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(31,33,29,0.05)]'
      : 'font-medium text-[#5e6157] hover:bg-white/60 hover:text-ink',
  ].join(' ');
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2 min-[900px]:max-[1179px]:px-0">
      <div className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-brand text-white shadow-[0_6px_14px_rgba(31,111,92,0.22)]">
        <IconCompass className="h-[19px] w-[19px]" />
      </div>
      <div className="hidden min-[1180px]:block">
        <div className="text-[17px] font-[650] leading-none tracking-[-0.02em]">
          Norte
        </div>
        <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted">
          Finanzas
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const health = useHealth();
  const status = health.data;
  const hasError = Boolean(status?.lastError);
  const stale = !status || status.status !== 'ready';

  return (
    <aside className="sticky top-0 hidden h-screen shrink-0 flex-col gap-6 border-r border-black/[0.045] bg-sidebar py-[22px] min-[900px]:flex min-[900px]:w-[76px] min-[900px]:items-center min-[900px]:px-2.5 min-[1180px]:w-[236px] min-[1180px]:items-stretch min-[1180px]:px-3.5">
      <Brand />

      <nav className="flex w-full flex-col gap-[3px]" aria-label="Principal">
        <div className="mx-3 mb-[7px] hidden text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[#9a9c92] min-[1180px]:block">
          Espacio
        </div>
        {navigation.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
            <item.icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
            <span className="hidden min-[1180px]:inline">{item.label}</span>
          </NavLink>
        ))}

        <div className="mx-3 mb-[7px] mt-[18px] hidden text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[#9a9c92] min-[1180px]:block">
          Sistema
        </div>
        {systemNavigation.map(item => (
          <NavLink key={item.to} to={item.to} className={navClass}>
            <item.icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
            <span className="hidden min-[1180px]:inline">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto hidden w-full min-[1180px]:block">
        <div className="rounded-[14px] border border-line bg-white p-3">
          <div className="text-[12.5px] font-semibold">
            {status?.budgetName || 'Presupuesto'}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
            <span
              className={[
                'h-1.5 w-1.5 rounded-full',
                hasError || stale
                  ? 'bg-[#c98a5e] ring-[3px] ring-[#f6e8e1]'
                  : 'bg-[#3e9b74] ring-[3px] ring-brand-soft',
              ].join(' ')}
            />
            {health.isLoading
              ? 'Conectando…'
              : status?.lastSyncAt
                ? `Sincronizado ${relativeTime(status.lastSyncAt)}`
                : 'Sin sincronizar'}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur min-[900px]:hidden"
      aria-label="Navegación principal"
    >
      {[...navigation, ...systemNavigation].map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            [
              'flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition',
              isActive ? 'text-brand' : 'text-muted hover:text-ink',
            ].join(' ')
          }
        >
          <item.icon className="h-[19px] w-[19px]" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
