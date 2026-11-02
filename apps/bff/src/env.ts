import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

// Monorepo root: apps/bff/src or apps/bff/dist -> ../../..
const repoRoot = path.resolve(import.meta.dirname, '../../..');

// En desarrollo carga el .env de la raíz. En producción las variables ya
// vienen del entorno (Docker/systemd) y este archivo no existe.
try {
  loadEnvFile(path.join(repoRoot, '.env'));
} catch {
  // Sin .env: se usan las variables del proceso.
}

const EnvSchema = z.object({
  ACTUAL_SERVER_URL: z.string().url(),
  ACTUAL_PASSWORD: z.string().min(1),
  ACTUAL_BUDGET_SYNC_ID: z.string().min(1),
  ACTUAL_BUDGET_PASSWORD: z.string().default(''),

  DATA_DIR: z.string().default('./.data'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5007),
  HOST: z.string().default('127.0.0.1'),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  CURRENCY: z.string().default('EUR'),
  TZ: z.string().default('Europe/Madrid'),

  READ_ONLY: z.enum(['true', 'false']).default('true'),
  SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(300),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuración inválida. Revisa .env:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  repoRoot,
  dataDir: path.resolve(repoRoot, parsed.data.DATA_DIR),
  readOnly: parsed.data.READ_ONLY === 'true',
};

export type Env = typeof env;
