import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { schema, type Db } from './index';

/** Finds the drizzle migrations folder both in dev (src/db) and in the bundle (dist). */
export function resolveMigrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.resolve(here, '../drizzle'),
    path.resolve(here, '../../drizzle'),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(path.join(p, 'meta', '_journal.json')));
  if (!found) throw new Error(`Migrations folder not found (looked in ${candidates.join(', ')})`);
  return found;
}

export async function connectPostgres(url: string) {
  const migrationClient = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder: resolveMigrationsFolder() });
  } finally {
    await migrationClient.end();
  }

  const client = postgres(url, { max: 10, idle_timeout: 30, connect_timeout: 10 });
  const db = drizzle(client, { schema }) as unknown as Db;
  const ping = async () => {
    await client`select 1`;
  };
  return { db, ping, close: () => client.end({ timeout: 5 }) };
}
