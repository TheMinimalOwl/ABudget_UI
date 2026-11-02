import { serve } from '@hono/node-server';
import { OverviewQuerySchema, TransactionsQuerySchema } from '@uiab/contracts';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  closeActual,
  ensureReady,
  getHealth,
  getMonths,
  getOverview,
  getTransactions,
} from './actual.js';
import { env } from './env.js';

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure(context: Context, error: unknown) {
  if (error instanceof HttpError) {
    return context.json(
      { error: { code: error.code, message: error.message } },
      error.status as 400 | 403 | 404 | 409 | 500 | 503,
    );
  }

  console.error('[bff] error:', error);
  return context.json(
    {
      error: {
        code: 'ACTUAL_UNAVAILABLE',
        message: errorMessage(error),
      },
    },
    503,
  );
}

function validationMessage(issues: { path: PropertyKey[]; message: string }[]) {
  return issues
    .map(issue => `${issue.path.join('.') || 'query'}: ${issue.message}`)
    .join('; ');
}

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.APP_ORIGIN,
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 600,
  }),
);
app.use('/api/*', async (context, next) => {
  await next();
  context.header('Cache-Control', 'no-store');
});

app.get('/api/health', context => context.json(getHealth()));
app.get('/api/v1/health', context => context.json(getHealth()));

app.get('/api/v1/months', async context => {
  try {
    return context.json(await getMonths());
  } catch (error) {
    return failure(context, error);
  }
});

app.get('/api/v1/overview', async context => {
  const parsed = OverviewQuerySchema.safeParse(context.req.query());
  if (!parsed.success) {
    return failure(
      context,
      new HttpError(400, 'VALIDATION', validationMessage(parsed.error.issues)),
    );
  }

  try {
    return context.json(await getOverview(parsed.data.month));
  } catch (error) {
    return failure(context, error);
  }
});

app.get('/api/v1/transactions', async context => {
  const parsed = TransactionsQuerySchema.safeParse(context.req.query());
  if (!parsed.success) {
    return failure(
      context,
      new HttpError(400, 'VALIDATION', validationMessage(parsed.error.issues)),
    );
  }

  try {
    return context.json(await getTransactions(parsed.data));
  } catch (error) {
    return failure(context, error);
  }
});

app.notFound(context =>
  context.json(
    { error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } },
    404,
  ),
);

app.onError((error, context) => failure(context, error));

ensureReady().catch(error => {
  console.error('[bff] no se pudo arrancar Actual:', errorMessage(error));
});

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
    hostname: env.HOST,
  },
  info => {
    console.log(`[bff] escuchando en http://${env.HOST}:${info.port}`);
    console.log(
      `[bff] presupuesto ${env.ACTUAL_BUDGET_SYNC_ID} · solo lectura: ${env.readOnly} · sync cada ${env.SYNC_INTERVAL_SECONDS}s`,
    );
  },
);

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`[bff] ${signal}: cerrando`);
  server.close();
  await closeActual();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
