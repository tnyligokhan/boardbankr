import type { Db } from './index';
import { schema } from './index';
import { resolveMigrationsFolder } from './postgres';

/**
 * Development only: an in-process PostgreSQL (PGlite) so the app runs without Docker.
 * DATABASE_URL=pglite            → in memory
 * DATABASE_URL=pglite:./.pgdata  → persisted in a folder
 */
export async function connectPglite(url: string) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const dir = url.startsWith('pglite:') ? url.slice('pglite:'.length) : undefined;
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolveMigrationsFolder() });
  return {
    db: db as unknown as Db,
    ping: async () => {
      await client.query('select 1');
    },
    close: () => client.close(),
  };
}
