import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { loadConfig } from './config';
import { connectPostgres } from './db/postgres';
import { deleteExpiredSessions } from './services/auth';

const config = loadConfig();
if (!config.webDist) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  config.webDist = path.resolve(here, '../../web/dist');
}

const usePglite = config.databaseUrl === 'pglite' || config.databaseUrl.startsWith('pglite:');
if (usePglite && config.env === 'production') throw new Error('PGlite is for local development only');
const { db, ping, close } = usePglite
  ? await (await import('./db/pglite')).connectPglite(config.databaseUrl)
  : await connectPostgres(config.databaseUrl);
const { app, gamesSvc } = await buildApp({ config, db, ping });

const housekeeping = setInterval(
  async () => {
    try {
      await deleteExpiredSessions(db);
      const pruned = await gamesSvc.pruneStaleLobbies();
      if (pruned) app.log.info({ pruned }, 'removed stale lobbies');
    } catch (err) {
      app.log.error({ err }, 'housekeeping failed');
    }
  },
  60 * 60 * 1000,
);
housekeeping.unref();

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, 'shutting down');
  clearInterval(housekeeping);
  await app.close();
  await close();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.port, host: config.host });
