import { PGlite } from '@electric-sql/pglite';
import type { GamePreview, GameSnapshot, Me } from '@mdb/shared';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { buildApp } from '../app';
import type { Config } from '../config';
import { schema, type Db } from '../db/index';
import { connectPostgres, resolveMigrationsFolder } from '../db/postgres';

export const PUBLIC_URL = 'http://localhost:5173';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    env: 'test',
    port: 0,
    host: '127.0.0.1',
    databaseUrl: '',
    publicUrl: PUBLIC_URL,
    secureCookies: false,
    google: { clientId: 'test-client', clientSecret: 'test-secret' },
    webDist: null,
    logLevel: 'error',
    ...overrides,
  };
}

/**
 * Uses a real PostgreSQL when TEST_DATABASE_URL is set (CI / docker), otherwise in-process PGlite.
 * Each call gets an empty database.
 */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const { default: postgres } = await import('postgres');
    const admin = postgres(url, { max: 1, onnotice: () => {} });
    await admin.unsafe('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
    await admin.end();
    const conn = await connectPostgres(url);
    return { db: conn.db, close: conn.close };
  }
  const client = new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: resolveMigrationsFolder() });
  return { db: db as unknown as Db, close: () => client.close() };
}

export async function createTestApp(config: Partial<Config> = {}, fetchImpl?: typeof fetch) {
  const { db, close } = await createTestDb();
  const built = await buildApp({ config: testConfig(config), db, fetchImpl });
  await built.app.ready();
  return {
    ...built,
    db,
    async close() {
      await built.app.close();
      await close();
    },
  };
}

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

export interface ResponseBody {
  game?: GameSnapshot | null;
  error?: string;
  kind?: 'member' | 'preview';
  preview?: GamePreview;
  user?: Me | null;
  [key: string]: unknown;
}

/** A logged-in guest with a tiny request helper. */
export async function guest(app: App, name: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: { name } });
  if (res.statusCode !== 200) throw new Error(`guest login failed: ${res.body}`);
  const cookie = res.cookies.find((c) => c.name === 'mdb_session')!;
  const id = (res.json() as { user: { id: string } }).user.id;
  const call = async (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) => {
    const r = await app.inject({
      method,
      url,
      payload: payload as never,
      cookies: { mdb_session: cookie.value },
      headers: { origin: PUBLIC_URL },
    });
    return { status: r.statusCode, body: r.json() as ResponseBody };
  };
  return { id, cookie: cookie.value, call };
}
