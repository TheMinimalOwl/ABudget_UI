# Diseño de una UI propia sobre Actual Budget

> Estado: **v1 solo lectura implementada** (dashboard + movimientos con datos reales).
> Fecha: 2026-11-02
> Objetivo: una UI más bonita y enfocada, usando la lógica de negocio de un Actual Budget self-hosted (LXC) sin reimplementar la contabilidad.

---

## 1. Resumen ejecutivo

Actual Budget **no expone una API HTTP de negocio**. Su servidor solo autentica y sincroniza mensajes CRDT binarios; toda la lógica (reglas, presupuesto, splits, informes) vive en el cliente. El acceso programático oficial es el paquete Node `@actual-app/api`, que ejecuta ese mismo motor en modo headless sobre una copia local en SQLite.

Por tanto, la arquitectura correcta es:

```
Navegador  ──HTTPS/JSON+SSE──▶  BFF propio (Node 22)  ──HTTPS/sync──▶  Actual en el LXC
   SPA                            @actual-app/api
                                  dataDir persistente
```

- **BFF** (Backend-for-Frontend): única pieza que conoce la contraseña de Actual, mantiene la copia local, sincroniza, cachea y calcula read models/agregados.
- **SPA**: solo presentación. Nunca habla con el servidor de Actual ni ve secretos.
- **No reimplementamos** el motor de Actual: `@actual-app/api` es nuestra capa de dominio. Nosotros añadimos contrato tipado, caché, agregaciones, auth y sincronización.
- Empezar en **solo lectura** y activar escrituras después. Es la forma barata de validar el diseño sin riesgo para los datos.

La alternativa de usar el build de navegador de `@actual-app/api` (sin BFF) existe, pero es experimental, exige `SharedArrayBuffer`/COOP+COEP y expone la contraseña del servidor al navegador. No la recomiendo para v1.

### 1.1 Entorno validado (2026-11-02)

- LXC `actualbudget` (Debian 13), 2 GB de RAM y ~7,6 GB libres en disco.
- Actual en Docker: contenedor `actual-server`, imagen `actualbudget/actual-server:latest`, versión **26.10.0**, puerto `5006`, `restart: unless-stopped`.
- Datos en `/opt/actual/data` (≈3,6 MB). `docker-compose.yml` en `/opt/actual/docker-compose.yml`.
- Un único usuario admin con login por contraseña y un único presupuesto: **"My Finances"**.
- El presupuesto tiene **cifrado E2E activo** (`encrypt_meta`/`encrypt_keyid` presentes). Sin la contraseña del presupuesto no se puede leer, ni siquiera con acceso root al LXC.
- No se encontraron backups ni tareas de cron. Antes de habilitar escrituras hay que montar un backup del volumen.
- El host no tiene Node/npm: el BFF irá en contenedor o en otra máquina.
- `@actual-app/api` se fijará a **26.10.0** para coincidir con el servidor (npm publica esa versión).

**Datos reales del presupuesto (spike de solo lectura, 2026-11-02):**

- Descarga y descifrado correctos con la contraseña E2E.
- **1 cuenta** on-budget: `Imagin`, saldo ≈ **1.008,29 €**. No hay cuentas off-budget ni grupos de cuentas.
- **5 grupos de categorías activos**: Gastos, Ahorro, Inversión, Ocio e Income (los planes antiguos están en tombstone).
- **33 categorías activas** y **63 pagadores** (2 son pagadores internos de transferencia).
- **155 transacciones vivas** entre 2026-01-04 y 2026-10-26; **0 programadas**. De ellas, 7 son padres de split y 17 son hijos; el listado por defecto de la API devuelve 148 (oculta los padres).
- **5 transacciones sin categoría**, 0 transferencias internas vivas.
- Todos los importes presupuestados están a **0**: se usa como registro de gastos, no como presupuesto de sobres. `toBudget` actual ≈ **994,77 €**.
- Actual crea 12 meses futuros con filas a cero (`zero_budgets`); `getBudgetMonths()` los devuelve y **no deben confundirse con actividad real**.
- Preferencias: `dateFormat=dd.MM.yyyy`, `firstDayOfWeekIdx=1` (lunes), `defaultCurrencyCode` vacío. Los datos están en **EUR**.
- **Integridad**: SHA-256 del presupuesto y de `account.sqlite` idénticos antes y después del spike. Cero escrituras en el servidor.

### 1.2 Decisiones ya tomadas

- **v1 solo lectura**; las mutaciones se posponen a la fase 2.
- **Un usuario y un presupuesto**; no hace falta multi-tenant ni multi-presupuesto.
- **Web con React + TypeScript**; PWA móvil no es prioridad inicial.
- El **sync ID** y las contraseñas se pasan por entorno/secreto, nunca por el repositorio.

### 1.3 Implementación actual (2026-11-02)

- Monorepo con npm workspaces: `packages/contracts` (Zod), `apps/bff` (Hono + `@actual-app/api`), `apps/web` (React 19 + Vite + Tailwind 4 + TanStack Query + React Router).
- BFF escuchando en `127.0.0.1:5007`, con `GET /api/health`, `/api/v1/health`, `/api/v1/overview`, `/api/v1/transactions` y `/api/v1/months`.
- Dashboard "Norte" con datos reales: KPIs, flujo mensual, donut por categoría, últimos movimientos y resumen de presupuesto.
- Página de movimientos con filtros de fecha, tamaño de página y paginación.
- Selector de mes. El mes por defecto es el **último con actividad** (hoy, octubre de 2026), no el mes en curso.
- `availableMonths` = meses con movimientos + mes actual; los meses futuros a cero de Actual se descartan.
- Sync automático cada `SYNC_INTERVAL_SECONDS` (300 s). `0` desactiva el sync y sirve solo la copia local.
- El cierre usa `close-budget` y evita `shutdown()` para no disparar un `sync()` al apagar.
- Pendiente: auth de UI, despliegue del BFF fuera del equipo de desarrollo y backups programados.

---

## 2. Cómo funciona Actual (y por qué condiciona todo)

### 2.1 Modelo cliente-servidor

- El servidor guarda el presupuesto como mensajes CRDT cifrados y opcionalmente comprimidos. Sabe de usuarios, ficheros y sincronización, **no de categorías ni de transacciones**.
- El cliente descarga la base de datos local (SQLite), aplica migraciones, ejecuta reglas, calcula el presupuesto y sube los cambios como mensajes CRDT.
- `@actual-app/api` es exactamente ese cliente, sin UI. En Node usa `better-sqlite3`; requiere **Node ≥ 22**.
- Cada proceso del API tiene **un presupuesto cargado a la vez** y su propia carpeta `dataDir`.

Consecuencias directas:

1. La UI no puede hacer `fetch("http://lxc:5006/api/transactions")`. No existe.
2. Necesitamos un servicio Node que ejecute el API y exponga un contrato propio.
3. La frescura de los datos depende de cuándo llamemos a `sync()`.
4. Hay que serializar escrituras y sincronizar tras cada cambio.

### 2.2 Qué ofrece la API pública

| Área | Métodos principales | ¿Disponible? |
|---|---|---|
| Cuentas | `getAccounts`, `createAccount`, `updateAccount`, `closeAccount`, `getAccountBalance` | Sí |
| Grupos de cuentas | `getAccountGroups`, CRUD | Sí |
| Transacciones | `getTransactions`, `addTransactions`, `importTransactions`, `updateTransaction`, `deleteTransaction`, `mergeTransactions` | Sí |
| Splits y transfers | vía `subtransactions`, `transfer_id`, payees con `transfer_acct` | Sí |
| Presupuesto mensual | `getBudgetMonths`, `getBudgetMonth`, `setBudgetAmount`, `setBudgetCarryover`, `holdBudgetForNextMonth` | Sí |
| Categorías y grupos | `getCategories`, `getCategoryGroups`, CRUD | Sí |
| Payees | `getPayees`, `getCommonPayees`, CRUD, `mergePayees` | Sí |
| Reglas | `getRules`, `getPayeeRules`, CRUD | Sí |
| Programadas | `getSchedules`, `getScheduleDates`, CRUD | Sí |
| Notas / plantillas / goals | `getNote`, `updateNote` (las plantillas viven en notas de categoría) | Sí |
| Tags | `getTags`, CRUD | Sí |
| Preferencias | `getPreferences`, `setPreference` (moneda, formato, primer día de semana) | Sí |
| Sync | `sync`, `downloadBudget`, `loadBudget`, `getBudgets`, `exportBudget`, `importBudget` | Sí |
| Bank sync | `runBankSync` (GoCardless / SimpleFIN configurados en el servidor) | Sí |
| Consultas arbitrarias | `aqlQuery(q(...))` con `filter`, `select`, `orderBy`, `groupBy`, `$sum` | Sí, con docs parciales |
| Informes del cliente | informes personalizados, widgets del dashboard, reconciliación | **No hay método público** |

Nota: `runQuery` sigue existiendo pero está deprecado; usar `aqlQuery`. El módulo expone `q` para construir consultas.

### 2.3 Detalles que cambian el diseño

- **Autenticación**: `init({ serverURL, password })` o `init({ serverURL, sessionToken })`. El token evita guardar la contraseña en memoria, pero caduca y el `asyncStorage` del API en Node **no persiste** entre reinicios, así que el BFF necesita la contraseña (o un mecanismo de re-login) al arrancar.
- **Cifrado E2E**: si el presupuesto tiene clave, `downloadBudget(syncId, { password })` necesita la contraseña del presupuesto, distinta de la del servidor. Si se pierde, no hay recuperación.
- **`shutdown()` sincroniza**, pero un crash no. Hay que llamar a `sync()` explícitamente después de cada mutación.
- **Programadas**: tras un `sync()` correcto, Actual ejecuta el servicio de programadas **una vez al día** y puede crear transacciones automáticamente (`posts_transaction`). Nuestro BFF disparará ese comportamiento. Es deseable, pero hay que documentarlo y probarlo.
- **Versión**: el paquete se versiona junto al servidor (calendario, p. ej. `26.11.0`). Fijar la misma versión que el servidor. Un cliente más nuevo puede migrar el fichero; conviene actualizar servidor y API a la vez.
- **Un presupuesto por proceso**: para varios presupuestos, un proceso hijo por presupuesto (no un pool dentro del mismo proceso).
- **API en un solo hilo**: aunque Node sea single-thread, dos `sync()` concurrentes pueden pisarse. Usar un mutex por presupuesto.
- **Escotilla de emergencia**: `init()` devuelve `internal` (`lib`) con `send(handler, args)`. Permite llamar a handlers internos no públicos (p. ej. informes). Es potente pero **no estable**; usarlo solo con tests de contrato y aislado tras una interfaz.

---

## 3. Opciones evaluadas

| Opción | Ventajas | Inconvenientes | Veredicto |
|---|---|---|---|
| **A. BFF propio + SPA** | Control total del contrato, caché, SSE, auth, agregados; un solo escritor; secretos fuera del navegador | Un servicio más que operar | **Recomendada** |
| **B. Reutilizar `actual-http-api`** (proyecto de la comunidad, oficialmente listado) | Ya existe, Docker, Swagger, cobertura amplia del API | Es un passthrough genérico: sin read models, sin SSE, sin caché, auth por API key, recarga/sync por petición; si añadimos otra capa tendríamos dos clientes escribiendo | Útil como referencia y para un spike; no como base final |
| **C. SPA con build de navegador de `@actual-app/api`** | Sin backend; datos en IndexedDB | Experimental; requiere HTTPS + COOP/COEP (`SharedArrayBuffer`); contraseña en el navegador; CORS y auth contra el servidor; sin cron/SSE/secretos; poca caché compartida | No para v1; revisar para un modo offline |
| **D. Fork del frontend de Actual** | Paridad funcional total; usa `loot-core` en proceso | Monorepo grande, acoplamiento alto, upgrades dolorosos, heredas toda su arquitectura | Solo si el objetivo fuese "Actual con otro tema" |
| **E. Reverse proxy + CSS/usuarioscript** | Barato | No es una UI nueva; frágil | Descartada |

`actual-http-api` demuestra que el patrón BFF funciona y puede servir para validar la conexión en una tarde. Para una UI propia bonita necesitamos una API orientada a la experiencia (agregados, bootstrap, eventos), no un espejo 1:1 del API.

---

## 4. Arquitectura propuesta

### 4.1 Vista de componentes

```
┌──────────────────────────────┐
│  SPA (React + Vite + PWA)    │
│  TanStack Router/Query        │
│  Tailwind + shadcn/ui         │
└──────────────┬───────────────┘
               │ HTTPS · JSON · SSE
               │ cookie de sesión
┌──────────────▼───────────────────────────────────────────┐
│  BFF (Node 22 + TypeScript)                              │
│                                                          │
│  ┌────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │  HTTP      │  │  Dominio    │  │  Sync manager     │  │
│  │  (Hono)    │─▶│  read models│─▶│  mutex + single-  │  │
│  │  auth/SSE  │  │  informes   │  │  flight + TTL     │  │
│  └────────────┘  └─────────────┘  └─────────┬─────────┘  │
│                                             │            │
│                                    ┌────────▼─────────┐  │
│                                    │ ActualGateway    │  │
│                                    │ @actual-app/api  │  │
│                                    └────────┬─────────┘  │
└─────────────────────────────────────────────┼────────────┘
                                              │ HTTPS sync (CRDT)
                                   ┌──────────▼──────────┐
                                   │ Actual server (LXC) │
                                   └─────────────────────┘
                                              │
                                   ┌──────────▼──────────┐
                                   │ dataDir (volumen)   │
                                   │ copia SQLite local  │
                                   └─────────────────────┘
```

### 4.2 Stack propuesto

| Capa | Elección | Motivo |
|---|---|---|
| Runtime | Node 22 LTS | Requisito de `@actual-app/api`; `better-sqlite3` estable |
| Lenguaje | TypeScript estricto | El API ya trae tipos; evita errores de dinero/fechas |
| HTTP | **Hono** + Zod | Ligero, SSE, RPC tipado con `hono/client`, portable |
| Contrato | REST versionado (`/api/v1`) + Zod/OpenAPI | Fácil de probar con curl, reutilizable por móvil/CLI |
| Frontend | React 19 + Vite | Ecosistema y velocidad |
| Routing/estado servidor | TanStack Router + TanStack Query | Cache, invalidación, optimistic updates |
| UI | Tailwind v4 + shadcn/ui (Radix) | Control visual real, accesible |
| Tablas | TanStack Table + Virtual | Ledger rápido con miles de filas |
| Gráficas | Recharts (o visx si hace falta custom) | Velocidad de iteración |
| Formularios | React Hook Form + Zod | Validación compartida con el BFF |
| Tests | Vitest + Playwright | Unitarios, contrato y E2E |
| Monorepo | pnpm workspaces | `apps/api`, `apps/web`, `packages/shared` |
| Deploy | Docker + Caddy/Traefik | TLS, reverse proxy, un volumen persistente |

Alternativa válida: Fastify + tRPC. Elegiría Hono por SSE y por un contrato REST que también sirve para una futura app móvil. Lo importante es **una sola librería de esquemas** compartida entre BFF y SPA.

### 4.3 Estructura del repo

```
ui-actualbudget/
├─ apps/
│  ├─ api/
│  │  ├─ src/actual/        # gateway: init, sync, load, mutaciones
│  │  ├─ src/domain/        # read models, informes, mappers
│  │  ├─ src/http/          # rutas, auth, SSE, errores
│  │  ├─ src/jobs/          # sync periódico, backups, bank sync
│  │  └─ src/config.ts      # env + validación Zod
│  └─ web/
│     ├─ src/routes/        # dashboard, presupuesto, cuentas, ledger…
│     ├─ src/components/    # design system
│     └─ src/lib/api.ts     # cliente tipado
├─ packages/
│  └─ shared/               # DTOs Zod, dinero, fechas, moneda
├─ docker/
└─ docs/
```

### 4.4 Despliegue

- Un contenedor para el BFF + estáticos de la SPA (o dos, si se prefiere CDN).
- **Una sola réplica** del BFF (SQLite local + un escritor). No escalar horizontalmente contra el mismo `dataDir`.
- Volumen persistente para `dataDir`; sin él, cada arranque descarga el presupuesto.
- Actual y BFF en la misma red Docker o en la LAN; el servidor de Actual no debería quedar expuesto a Internet sin protección.
- TLS en Caddy/Traefik. Si es solo LAN, valorar Tailscale en vez de abrir puertos.

---

## 5. Contrato del BFF

### 5.1 Convenciones

- **Dinero**: enteros en unidades menores (céntimos) en todos los DTO, con sufijo explícito: `amountMinor`, `budgetedMinor`, `balanceMinor`. Nunca floats en el transporte.
- **Fechas**: `YYYY-MM-DD` como string. **Meses**: `YYYY-MM`. No usar `Date` para representar días; evitar desplazamientos de zona horaria.
- **IDs**: UUID string.
- **Paginación**: cursor opaco (`cursor`) + `limit`; el ledger se ordena por `date desc, id desc`.
- **Errores**: `{ error: { code, message, details? } }`. Códigos estables: `UNAUTHORIZED`, `READ_ONLY`, `VALIDATION`, `ACTUAL_AUTH`, `ACTUAL_NETWORK`, `SYNC_FAILED`, `BUDGET_NOT_FOUND`, `CONFLICT`.
- **Versionado**: prefijo `/api/v1`. La SPA y el BFF se despliegan juntos, pero el prefijo permite evolucionar.
- **ETag / `dataVersion`**: se devuelve una versión global que cambia tras cada sync o mutación; permite 304 y sirve para invalidar la caché del cliente.
- **Idempotencia**: `Idempotency-Key` en imports y bank sync; `importTransactions` ya deduplica por `imported_id`.

### 5.2 Endpoints principales

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/v1/session` | Usuario, presupuesto activo, versión del servidor, `readOnly`, `lastSyncAt` |
| GET | `/api/v1/bootstrap` | Shell completo: cuentas, grupos, categorías, payees, tags, preferencias, meses |
| POST | `/api/v1/sync` | Forzar sincronización |
| GET | `/api/v1/months` | Meses con presupuesto |
| GET | `/api/v1/months/:month` | Detalle del mes: `toBudget`, `incomeAvailable`, categorías con `budgeted/spent/balance` |
| PATCH | `/api/v1/months/:month/categories/:id` | `{ budgetedMinor?, carryover? }` |
| GET | `/api/v1/accounts` | Cuentas + saldos calculados |
| GET | `/api/v1/accounts/:id/balance?asOf=` | Saldo a fecha |
| GET | `/api/v1/transactions` | Filtros: cuenta, fechas, categoría, payee, texto, `cleared`, cursor |
| POST | `/api/v1/transactions` | Alta simple o lote |
| PATCH | `/api/v1/transactions/:id` | Edición (categoría, payee, notas, importe, fecha, split) |
| DELETE | `/api/v1/transactions/:id` | Borrado |
| POST | `/api/v1/transactions/bulk` | Categorizar/editar en lote |
| POST | `/api/v1/transactions/import` | Importación con reglas (`dryRun` disponible) |
| GET | `/api/v1/payees` | Payees (+ transfer payees) |
| POST/PATCH | `/api/v1/payees…` | CRUD y merge |
| GET | `/api/v1/rules` | Reglas |
| POST/PATCH/DELETE | `/api/v1/rules…` | CRUD |
| GET | `/api/v1/schedules` | Programadas + próximas fechas |
| POST/PATCH/DELETE | `/api/v1/schedules…` | CRUD |
| POST | `/api/v1/bank-sync` | `{ accountId? }` |
| GET | `/api/v1/reports/cashflow?from=&to=` | Ingresos/gastos por mes |
| GET | `/api/v1/reports/spending?from=&to=&groupBy=` | Gasto por categoría/grupo/payee |
| GET | `/api/v1/reports/networth?from=&to=` | Patrimonio neto |
| GET | `/api/v1/events` | SSE: `sync`, `budget-changed`, `transactions-changed` |
| GET | `/api/v1/health` | Estado del servidor, presupuesto cargado, antigüedad del último sync |

Los endpoints de escritura respetan `READ_ONLY=true` y devuelven `403 READ_ONLY`.

### 5.3 Flujos

**Lectura**

1. La SPA pide `/months/2026-11` con `If-None-Match`.
2. El BFF comprueba frescura: si el último sync es más antiguo que el TTL (p. ej. 30 s), hace `sync()` single-flight.
3. Consulta la copia local (`getBudgetMonth` o `aqlQuery`).
4. Mapea a DTO, cachea y devuelve con `ETag`.

**Escritura**

1. La SPA hace `PATCH /transactions/:id` (optimista en UI).
2. El BFF toma el **mutex de escritura** del presupuesto.
3. `sync()` → relee la entidad → valida → muta → `sync()`.
4. Incrementa `dataVersion`, invalida cachés y emite un evento SSE.
5. La SPA reconcilia o revierte si hay error.

**Arranque**

1. `init({ dataDir, serverURL, password })`.
2. `getBudgets()`; si el presupuesto no está local, `downloadBudget(syncId, { password? })`; si está, `loadBudget` + `sync()`.
3. Cargar metadatos y preferencias; arrancar sync periódico y jobs.

---

## 6. Dominio y datos

### 6.1 Reglas de negocio que no debemos duplicar mal

- **Dinero**: enteros ×100. Para dividir (splits), aritmética entera y reparto del resto; nunca `toFixed` intermedio.
- **Fechas**: strings `YYYY-MM-DD`; para formatear, parsear como fecha local (Temporal/`parseISO`), no `new Date("2026-11-02")` sin control de zona.
- **Splits**: usar `splits: 'inline'` para sumar gasto (evita contar el padre y los hijos); `grouped` para editar. No mezclar ambos modos en una misma agregación.
- **Transfers**: cada transferencia tiene dos transacciones y un `transfer_id`; excluir ambas del cálculo de ingresos/gastos. El payee de transferencia tiene `transfer_acct`.
- **Off-budget**: las cuentas off-budget no participan en el presupuesto, pero sí en patrimonio neto. No mezclar.
- **Ingresos**: categorías con `is_income`; no son gasto.
- **Ocultos**: categorías/grupos ocultos siguen teniendo transacciones; decisión de producto: incluirlos en informes salvo filtro explícito.
- **Presupuesto mensual**: `getBudgetMonth` es la fuente de verdad (`toBudget`, `incomeAvailable`, `budgeted/spent/balance`). No recalcular el envelope en el frontend.
- **Plantillas/goals**: viven en las notas de la categoría (`#template …`, `#goal …`). Si las mostramos, parsearlas con cuidado o delegar en la UI de Actual.
- **Saldos**: `getAccountBalance(id, cutoff)` para una cuenta; para el dashboard, agregar por transacciones o usar los saldos calculados, pero definir si se incluye lo no conciliado.

### 6.2 Read models

- `MetaSnapshot`: cuentas, grupos, categorías, payees, tags, preferencias, moneda, formato de fecha/número.
- `MonthView`: mes, `toBudget`, `incomeAvailable`, grupos y categorías con `budgeted/spent/balance`, overspending, notas.
- `AccountView`: cuenta, grupo, on/off budget, cerrada, saldo actual/conciliado, última actividad.
- `TransactionView`: transacción normalizada con nombres resueltos de cuenta/payee/categoría, split resumido y flags.
- `DashboardView`: agregados precalculados (ver §7).

### 6.3 Informes

Se calculan en el BFF, no en el navegador:

- **Cash flow**: ingresos vs gastos por mes, excluyendo transfers, con granularidad mensual.
- **Spending**: gasto por categoría/grupo/payee, con comparativa presupuesto vs real.
- **Net worth**: evolución del patrimonio (on + off budget, sin cerradas).
- **Budget health**: `toBudget`, categorías sobregastadas, próximas programadas, días de colchón.
- **Top movimientos**: mayores gastos, variaciones mes a mes.

Implementación: `aqlQuery` con filtros por fecha y `select` de columnas mínimas, agregación en TypeScript; usar `groupBy` cuando simplifique. Cachear por hash de consulta e invalidar tras sync. Evitar funciones SQL no documentadas y, sobre todo, **no leer el SQLite interno** en v1: el esquema no es contrato público.

---

## 7. Sync, caché y concurrencia

### 7.1 Política de sincronización

- **Single-flight**: como máximo un `sync()` en vuelo por presupuesto; los demás esperan a la misma promesa.
- **Mutex de escritura**: `sync` + mutación + `sync` en exclusión mutua.
- **TTL de lectura**: 30–60 s para vistas normales; 0 (sync inmediato) para acciones críticas.
- **Sync periódico**: cada 60 s si hay clientes conectados; pausar si no hay nadie (configurable).
- **Sync al recuperar foco**: la SPA puede pedir `/sync` al volver a la pestaña.
- **Tras cada mutación**: `sync()` explícito; un crash no debe perder cambios.
- **Errores**: backoff exponencial; estado visible en la UI (`syncStatus`). No bloquear la lectura si el servidor está caído: servir la copia local y marcar `stale`.

### 7.2 Caché

- **Meta**: en memoria, invalidada por tablas (`accounts`, `categories`, `payees`, `preferences`).
- **Mes**: clave `month`, invalidada por `transactions`/`budget`.
- **Informes**: clave `hash(query)`, TTL 5 min, invalidada por sync.
- **HTTP**: `ETag`/`If-None-Match` con `dataVersion`.
- **Cliente**: TanStack Query con `staleTime` corto y `invalidateQueries` por evento SSE.

No añadir Postgres/Redis en v1: el presupuesto local + memoria cubren un uso doméstico. Si más adelante hay varios presupuestos o informes pesados, un SQLite de caché o Postgres sería el siguiente paso.

### 7.3 Concurrencia y multi-presupuesto

- **Un presupuesto por proceso**. Para varios, un proceso hijo por presupuesto con su propio `dataDir`, supervisado por el BFF.
- **Un escritor**: si el usuario sigue usando la UI oficial, ambos clientes sincronizan; el CRDT resuelve, pero evita read-modify-write sobre el mismo campo. Para operaciones sensibles, sincronizar antes de leer y enviar patches mínimos.
- **No escalar el BFF horizontalmente** contra el mismo volumen.
- **Bloqueo**: si otra instancia tiene el fichero, SQLite puede bloquear; detectar y devolver `CONFLICT` con reintento.

---

## 8. Frontend y diseño

### 8.1 Arquitectura de información

1. **Dashboard** — respuesta a "¿cómo voy este mes?".
2. **Presupuesto** — vista mensual por grupos/categorías, edición de asignaciones.
3. **Cuentas** — lista, saldos, detalle y evolución.
4. **Transacciones** — ledger global y por cuenta, búsqueda, edición inline, splits.
5. **Informes** — cash flow, gasto, patrimonio.
6. **Programadas** — próximas, calendario, auto-post.
7. **Ajustes** — preferencias, reglas, payees, tags, sync/estado.

### 8.2 Dashboard (propuesta)

```
┌─────────────────────────────────────────────────────────────┐
│  Noviembre 2026            [sync ✓ hace 12 s]   [⌘K]  [◐]  │
├─────────────────────────────────────────────────────────────┤
│  Disponible para asignar                                    │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐  │
│  │ 1.240,50 €    │   │ Ingresos 3.100│   │ Gastado 1.859 │  │
│  │ para asignar  │   │ este mes      │   │ 60 % del plan │  │
│  └───────────────┘   └───────────────┘   └───────────────┘  │
│                                                             │
│  ┌──────────────────────────────┐  ┌──────────────────────┐ │
│  │ Cash flow (últimos 12 meses) │  │ Patrimonio neto      │ │
│  │  ▁▂▃▅▆▇█▇▆▅▆█                │  │  42.180 €  +3,2 %    │ │
│  └──────────────────────────────┘  └──────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────┐  ┌──────────────────────┐ │
│  │ Próximos pagos               │  │ Top categorías       │ │
│  │ Alquiler   1 nov   850 €     │  │ Vivienda   850 €     │ │
│  │ Luz        5 nov    62 €     │  │ Comida     412 €     │ │
│  └──────────────────────────────┘  └──────────────────────┘ │
│                                                             │
│  Últimos movimientos                            [Ver todo]  │
│  …                                                          │
└─────────────────────────────────────────────────────────────┘
```

Principios:

- **Una jerarquía fuerte**, no "sopa de tarjetas": un número héroe (disponible), una tendencia, y luego listas.
- **Números tabulares** y tamaño generoso; el dinero se lee de un vistazo.
- **Densidad controlada**: el ledger puede ser denso; el dashboard debe respirar.
- **Sin decoración gratuita**: bordes de 1 px, elevación sutil, radios 12–16 px, un solo acento.
- **Modo oscuro de primera clase**, no una inversión automática.

### 8.3 Dirección visual inicial

- Fondo cálido neutro (`#FAFAF8` claro / `#0E1116` oscuro), tinta casi negra, un acento teal o índigo.
- Semántica: verde/rojo desaturados, nunca neón; el color no es el único portador de significado (iconos/texto).
- Tipografía: sans geométrica para UI (Inter/Geist) y una display con carácter para cifras grandes (p. ej. Newsreader o Instrument Serif), opcional.
- Gráficas: líneas de 2 px, áreas suaves, sin rejillas pesadas, tooltips discretos.
- Animación: 150–200 ms, solo para transiciones con significado; respetar `prefers-reduced-motion`.

### 8.4 UX clave

- **Command palette** (`⌘K`): ir a cuenta, categoría, mes; crear transacción; buscar.
- **Quick add**: alta de transacción en 2 campos, con payee autocompletado y categoría sugerida.
- **Edición inline** en el ledger: categoría, payee, notas; guardado con debounce y sync.
- **Bulk edit**: seleccionar varias transacciones y categorizar/conciliar.
- **Undo**: toast con acción inversa (la API desactiva el undo de Actual; implementamos patch inverso en cliente).
- **Estados**: skeletons, vacíos útiles, errores con reintento, estado de sync siempre visible.
- **Móvil**: navegación inferior, hojas (sheets) para editar, objetivos táctiles ≥44 px, PWA instalable.
- **Accesibilidad**: Radix, foco visible, navegación por teclado, contraste AA, etiquetas en formularios.
- **i18n**: español primero; formateo desde `getPreferences()` (moneda, decimales, fecha, primer día de semana).

### 8.5 Rendimiento en cliente

- Ledger virtualizado y paginado por cursor.
- No cargar todas las transacciones históricas en el arranque.
- Precargar metadatos (bootstrap) y meses adyacentes.
- Gráficas con datos agregados del BFF, no recalcular en el navegador.
- Code splitting por ruta; imágenes/iconos optimizados.

---

## 9. Seguridad

- **Secretos solo en el BFF**: contraseña del servidor y, si aplica, contraseña del presupuesto. Nunca en el bundle ni en `localStorage`.
- **Auth propia**:
  - Single-user: hash Argon2 en env/secreto + cookie de sesión `httpOnly`, `Secure`, `SameSite=Lax`, rotación y expiración.
  - CSRF: same-site + cabecera personalizada en mutaciones; o token.
  - Rate limit en login y endpoints de escritura.
  - Opcional: passkeys (WebAuthn) o forward-auth con Authentik/Authelia/Tailscale.
- **Read-only por defecto** en el primer despliegue; activar escritura conscientemente.
- **No exponer** el servidor de Actual a Internet; BFF en la misma red.
- **Cabeceras**: CSP estricta, `X-Content-Type-Options`, `Referrer-Policy`, HSTS si hay dominio.
- **Logs** sin secretos ni importes completos si no hace falta; request-id.
- **Backups** cifrados y con prueba de restauración.
- **Licencia/marca**: Actual es MIT; una UI separada es viable. Evitar usar su marca como si fuese oficial.

---

## 10. Operación

### 10.1 Docker Compose (esquema)

```yaml
services:
  actual-ui:
    image: ghcr.io/tu-usuario/actual-ui:26.11.0
    environment:
      ACTUAL_SERVER_URL: http://actual:5006
      ACTUAL_PASSWORD_FILE: /run/secrets/actual_password
      ACTUAL_BUDGET_SYNC_ID: 00000000-0000-0000-0000-000000000000
      ACTUAL_BUDGET_PASSWORD_FILE: /run/secrets/budget_password # solo si E2E
      DATA_DIR: /data
      APP_ORIGIN: https://presupuesto.example.com
      READ_ONLY: "true"
      SYNC_INTERVAL_SECONDS: "60"
      TZ: Europe/Madrid
    volumes:
      - actual-ui-data:/data
    secrets:
      - actual_password
      - budget_password
    restart: unless-stopped
```

- Imagen multi-stage, usuario no root, healthcheck.
- `dataDir` en volumen persistente.
- Un solo contenedor del BFF.
- Caddy/Traefik delante para TLS.

### 10.2 Backups

- Backup del volumen del **servidor de Actual** (es donde viven los datos reales).
- Backup diario del volumen del BFF (caché) es opcional; lo importante es poder reconstruirlo.
- `exportBudget()` programado a NAS/S3 con retención (30/90 días).
- Probar una restauración antes de habilitar escrituras.
- Documentar que las "backups" integradas de Actual son del cliente, no del servidor self-hosted.

### 10.3 Observabilidad

- `/health`: servidor alcanzable, presupuesto cargado, edad del último sync, versión.
- Logs estructurados (pino) con niveles; métricas básicas: duración de sync, errores, latencia de endpoints.
- Opcional: Prometheus + Grafana; Sentry para errores del frontend.
- Alertas: sync fallando > N minutos, presupuesto no cargado, disco lleno.

### 10.4 Actualizaciones

- Fijar `@actual-app/api` a la **misma versión** que el servidor (hoy `26.10.x`).
- Actualizar en este orden: backup → servidor → API/BFF → verificar migraciones y sync.
- No abrir el presupuesto con un cliente mucho más nuevo sin querer migrarlo.
- Tests de contrato contra una instancia real antes de cada upgrade.

---

## 11. Testing

- **Unitarios**: mappers, dinero, fechas, agregaciones, reglas de exclusión de transfers/off-budget.
- **Contrato**: levantar un Actual en Docker con un presupuesto semilla; ejecutar el BFF contra él; verificar endpoints y códigos de error.
- **Integración**: escritura → sync → releer desde otro cliente; splits, transfers, programadas.
- **E2E**: Playwright para dashboard, edición de transacción, presupuesto mensual y sync.
- **Fixtures**: `exportBudget()` produce un zip reproducible; para el frontend, un `MockGateway` con un snapshot JSON evita depender del LXC.
- **Golden tests** de informes con un presupuesto de ejemplo.

**Definition of done para v1 (solo lectura)**

- Dashboard, cuentas, ledger y mes funcionando con datos reales.
- Sync visible, errores recuperables, sin secretos en el cliente.
- Tests de contrato verdes contra el servidor del LXC.
- Backup verificado.

**No objetivos de v1**

- Paridad completa con Actual (reconciliación avanzada, editor de informes, multi-usuario, offline-first).
- Edición de reglas/programadas desde la UI (se puede añadir después).
- Acceso directo al SQLite/CRDT.

---

## 12. Roadmap

| Fase | Contenido | Estimación orientativa (1 dev) |
|---|---|---|
| **0. Spike** | Conectar al LXC, descargar presupuesto, listar datos, probar `aqlQuery`, escribir+sync, capturar fixtures | 2–3 días |
| **1. Solo lectura** | Monorepo, BFF (bootstrap, meses, cuentas, ledger), design system, dashboard, deploy | 1,5–2 semanas |
| **2. Escritura** | Mutaciones, mutex/sync, optimistic UI, SSE, auth, read-only flag, tests | 1,5–2 semanas |
| **3. Informes y programadas** | Cash flow, gasto, patrimonio, schedules, bank sync, PWA | 1–2 semanas |
| **4. Pulido** | Accesibilidad, i18n, modo oscuro, rendimiento, multi-presupuesto, passkeys | continuo |

Las estimaciones son para un MVP presentable, no para paridad con Actual.

---

## 13. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La API cambia entre versiones | Alto | Pin de versión, adapter fino, tests de contrato, upgrades coordinados |
| Conflictos de escritura con la UI oficial | Medio | Un escritor principal, sync antes de escribir, patches mínimos, refetch |
| Pérdida de datos | Alto | Backup del servidor + `exportBudget`, modo read-only primero, sync tras cada cambio |
| Auto-post de programadas inesperado | Medio | Documentar; probar con presupuestos de prueba; control de `posts_transaction` |
| Sync lento o servidor caído | Medio | Servir caché local, estado `stale`, backoff, timeouts |
| Presupuestos grandes | Medio | Paginación, agregados en BFF, caché, no cargar todo en el cliente |
| Cifrado E2E mal configurado | Alto | Guardar la contraseña en secreto, probar restauración, no rotar sin backup |
| Exposición de secretos | Alto | Secretos solo en BFF, TLS, auth, logs limpios |
| Dependencia de un wrapper comunitario | Medio | BFF propio; usar `actual-http-api` solo como referencia/spike |
| Complejidad de paridad funcional | Alto | Alcance por fases; no clonar Actual |

---

## 14. Decisiones tomadas y pendientes

**Tomadas**

| Decisión | Valor |
|---|---|
| Alcance v1 | Solo lectura |
| Usuarios | Un único usuario |
| Presupuestos | Un único presupuesto |
| Frontend | React 19 + Vite 7 + Tailwind 4 + TanStack Query |
| BFF | Node 22 + Hono + Zod |
| Contrato | REST `/api/v1` + Zod |
| Versión API | `@actual-app/api@26.10.0` (igual que el servidor) |
| Sync | Automático cada 300 s; `0` lo desactiva |
| Nombre UI | **Norte** (provisional) |
| Secretos | `.env`/Docker secrets, fuera del repo |

**Pendientes**

1. **Dónde ejecutar el BFF**: el LXC tiene 2 GB de RAM y no tiene Node; opciones: contenedor Node en el LXC (~200–300 MB), otra máquina de la LAN, o el equipo de desarrollo.
2. **Backups**: hay un backup manual verificado; falta programar la copia y la retención antes de la fase de escritura.
3. **Móvil/PWA**: confirmar si entra en v1 o se pospone.
4. **Uso en paralelo** de la UI oficial de Actual.
5. **Idioma**: español primero, ¿inglés después?
6. **Auth de UI** antes de exponer el BFF fuera de `127.0.0.1`.

---

## Anexo A: spike de validación (script)

Requisitos: Node 22+, `npm i @actual-app/api`, acceso al LXC.

```js
// spike.mjs — ejecutar con: node --env-file=.env spike.mjs
import * as api from '@actual-app/api';

const {
  ACTUAL_SERVER_URL,
  ACTUAL_PASSWORD,
  ACTUAL_BUDGET_SYNC_ID,
  ACTUAL_BUDGET_PASSWORD,
  ACTUAL_DATA_DIR = './.data',
} = process.env;

await api.init({
  dataDir: ACTUAL_DATA_DIR,
  serverURL: ACTUAL_SERVER_URL,
  password: ACTUAL_PASSWORD,
});

console.log('servidor:', await api.getServerVersion());
console.log('presupuestos:', await api.getBudgets());

await api.downloadBudget(
  ACTUAL_BUDGET_SYNC_ID,
  ACTUAL_BUDGET_PASSWORD ? { password: ACTUAL_BUDGET_PASSWORD } : {},
);

const accounts = await api.getAccounts();
console.log('cuentas:', accounts.map(a => `${a.name} (${a.id})`));

const months = await api.getBudgetMonths();
console.log('meses:', months.slice(-6));

const month = await api.getBudgetMonth(months.at(-1));
console.log('mes actual:', month.month, 'toBudget:', month.toBudget);

const { data: tx } = await api.aqlQuery(
  api.q('transactions')
    .select(['id', 'date', 'amount', 'payee', 'category', 'account', 'cleared'])
    .orderBy({ date: 'desc' })
    .limit(10),
);
console.log('últimas transacciones:', tx);

// Agregado por categoría (ejemplo de informe)
const { data: byCategory } = await api.aqlQuery(
  api.q('transactions')
    .filter({ date: { $gte: '2026-01-01' } })
    .groupBy('category')
    .select(['category', { total: { $sum: '$amount' } }]),
);
console.log('gasto por categoría:', byCategory);

await api.shutdown(); // sincroniza y cierra
```

Checklist del spike:

- [ ] Conecta y descarga el presupuesto.
- [ ] Lista cuentas, meses y transacciones.
- [ ] Ejecuta un agregado con `groupBy`.
- [ ] Hace una mutación de prueba en un presupuesto **de pruebas** y verifica `sync()`.
- [ ] Comprueba el comportamiento de programadas tras sync.
- [ ] Exporta un zip (`exportBudget`) para fixtures.

---

## Anexo B: referencias

- API oficial: <https://actualbudget.org/docs/api/>
- Referencia: <https://actualbudget.org/docs/api/reference>
- ActualQL: <https://actualbudget.org/docs/api/actual-ql/>
- Proyecto comunitario `actual-http-api`: <https://github.com/jhonderson/actual-http-api>
- Proyectos de la comunidad: <https://actualbudget.org/docs/community-repos/>
