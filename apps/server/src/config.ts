import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Public origin, e.g. https://bank.example.com. Used for OAuth redirects and origin checks. */
  PUBLIC_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Path to the built web app. */
  WEB_DIST: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export interface Config {
  env: 'development' | 'production' | 'test';
  port: number;
  host: string;
  databaseUrl: string;
  publicUrl: string;
  secureCookies: boolean;
  google: { clientId: string; clientSecret: string } | null;
  webDist: string | null;
  logLevel: string;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment:\n  ${issues}`);
  }
  const e = parsed.data;
  const publicUrl = e.PUBLIC_URL.replace(/\/+$/, '');
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    databaseUrl: e.DATABASE_URL,
    publicUrl,
    secureCookies: publicUrl.startsWith('https://'),
    google:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
        ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET }
        : null,
    webDist: e.WEB_DIST ?? null,
    logLevel: e.LOG_LEVEL,
  };
}
