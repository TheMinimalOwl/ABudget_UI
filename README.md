# Norte — UI propia sobre Actual Budget

Interfaz web para un servidor [Actual Budget](https://actualbudget.org/) self-hosted. Reutiliza el motor de Actual mediante `@actual-app/api`; no reimplementa la contabilidad.

> **Norte** es el nombre de trabajo de la UI. El presupuesto sigue siendo el de Actual.

## Estado

**v1 en solo lectura, funcionando con datos reales.**

- Dashboard con saldo, gasto, ahorro, flujo mensual, reparto por categorías, últimos movimientos y resumen de presupuesto.
- Página de movimientos con filtros por fecha y paginación.
- Selector de mes y estado de sincronización visibles.
- Sin mutaciones: no se crean, editan ni borran datos.
- Servidor: Actual **26.10.0** en Docker (LXC `192.168.10.48`), presupuesto **"My Finances"** con cifrado E2E.
- `@actual-app/api` fijado a **26.10.0**, la misma versión que el servidor.

## Stack

| Capa | Tecnología |
|---|---|
| SPA | React 19, Vite 7, TypeScript, Tailwind 4, TanStack Query, React Router |
| BFF | Node 22, Hono, Zod, `@actual-app/api` 26.10.0 |
| Contrato | Paquete `@uiab/contracts` con esquemas Zod compartidos |
| Monorepo | npm workspaces |

```
apps/
  bff/            API REST + cliente de Actual + caché/sync
  web/            SPA (Norte)
packages/
  contracts/      DTOs y esquemas Zod compartidos
docs/             arquitectura y decisiones
design/           mockup aprobado
scripts/          spike, exploración, inspección y preview
```

## Puesta en marcha

Requiere Node ≥ 22. En este equipo hay un Node portátil en `.tools/node`; el wrapper `dev.cmd` lo usa automáticamente.

```bat
npm install
dev.cmd
```

O con Node/npm en el `PATH`:

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>. El BFF escucha en `127.0.0.1:5007` y Vite proxya `/api`.

El arranque compila primero `@uiab/contracts` y luego levanta BFF y SPA con `concurrently`.

### Configuración

Copia `.env.example` a `.env` y rellena:

| Variable | Uso |
|---|---|
| `ACTUAL_SERVER_URL` | URL del servidor de Actual |
| `ACTUAL_PASSWORD` | Contraseña del servidor |
| `ACTUAL_BUDGET_SYNC_ID` | Sync ID del presupuesto (Ajustes → Avanzado) |
| `ACTUAL_BUDGET_PASSWORD` | Contraseña E2E del presupuesto |
| `DATA_DIR` | Copia local de SQLite (por defecto `./.data`) |
| `PORT` / `HOST` | Escucha del BFF (`5007` / `127.0.0.1`) |
| `APP_ORIGIN` | Origen permitido para CORS |
| `CURRENCY` | Moneda de presentación (`EUR`) |
| `TZ` | Zona para calcular el mes actual |
| `READ_ONLY` | `true` en v1 |
| `SYNC_INTERVAL_SECONDS` | Sync automático; `0` lo desactiva |

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Compila contratos y arranca BFF + SPA |
| `npm run dev:bff` | Solo BFF (`tsx watch`) |
| `npm run dev:web` | Solo SPA (Vite) |
| `npm run build` | Build de contratos, BFF y SPA |
| `npm run typecheck` | Typecheck de los tres paquetes |
| `npm run spike` | Spike de solo lectura contra Actual |
| `npm run explore` | Volcado detallado para diseño |
| `npm run inspect:db` | Inspección de la copia local SQLite |
| `npm run preview` | Sirve `design/mockup-dashboard.html` |

## API del BFF

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/health` | Estado, versión, presupuesto, último sync, error |
| GET | `/api/v1/overview?month=YYYY-MM` | Todo el dashboard de un mes |
| GET | `/api/v1/transactions?from=&to=&limit=&offset=` | Listado paginado |
| GET | `/api/v1/months` | Meses disponibles y mes actual |

Convenciones: dinero en **unidades menores enteras** (céntimos), fechas `YYYY-MM-DD`, meses `YYYY-MM`. Errores con `{ error: { code, message } }`.

## Criterios de datos

- El mes por defecto es el **último con actividad**, no necesariamente el mes en curso.
- `availableMonths` incluye los meses con movimientos y el mes actual.
- Ingresos = suma de importes positivos, excluyendo saldos iniciales y transferencias.
- Gastos = suma de importes negativos, excluyendo transferencias.
- El reparto por categoría usa el **gasto bruto** (solo negativos). Los reembolsos no se netean en v1; Actual puede mostrar un `totalSpent` distinto.
- `toBudget`, `assigned` y los totales del mes salen de `getBudgetMonth`, que es la fuente de verdad.
- Los padres de splits se ocultan; se muestran las líneas hijas.

## Sincronización y solo lectura

- El BFF sincroniza al arrancar y cada `SYNC_INTERVAL_SECONDS` (300 s por defecto).
- Un `sync()` puede publicar transacciones programadas vencidas (una vez al día). Hoy el presupuesto tiene **0 programadas**, pero conviene tenerlo presente.
- Para un modo estrictamente sin escrituras, pon `SYNC_INTERVAL_SECONDS=0`; se servirá la copia local.
- El cierre del BFF usa `close-budget`, **no** `shutdown()`, porque `shutdown()` hace `sync()`.
- No hay endpoint de escritura en v1.

## Seguridad

- `.env`, `.data/`, `backups/` y `.tools/` están fuera de git.
- El navegador nunca habla con Actual ni ve secretos.
- El BFF escucha solo en `127.0.0.1`; **no hay auth de UI todavía**. No exponerlo a la LAN/Internet en este estado.
- Antes de habilitar escrituras: backup verificado, retención y prueba de restauración.

## Documentación

- [Diseño de arquitectura](docs/arquitectura.md) — API de Actual, opciones, contrato, modelo de datos, seguridad, operación y roadmap.
- [Decisiones y pendientes](docs/arquitectura.md#14-decisiones-tomadas-y-pendientes)
- [Mockup aprobado](design/mockup-dashboard.html)
