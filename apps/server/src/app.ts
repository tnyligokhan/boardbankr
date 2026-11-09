import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import {
  actionRequestSchema,
  createGameSchema,
  guestLoginSchema,
  kickSchema,
  tokenSchema,
  turnSchema,
  updateMeSchema,
  type ClientMessage,
  type ServerMessage,
} from '@mdb/shared';
import type { Config } from './config';
import type { Db } from './db/index';
import type { users } from './db/schema';
import { AppError, parse } from './errors';
import { renderShell, robotsTxt, seoFor, sitemapXml } from './seo';
import { Hub } from './realtime/hub';
import {
  SESSION_COOKIE,
  createGuest,
  createSession,
  deleteSession,
  getSessionUser,
  renameUser,
  toMe,
  upsertGoogleUser,
} from './services/auth';
import { GameService, type MutationResult } from './services/games';
import { createAuthorization, exchangeCode, type GoogleConfig } from './services/google';

type UserRow = typeof users.$inferSelect;

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow | null;
  }
}

export interface AppDeps {
  config: Config;
  db: Db;
  ping?: () => Promise<void>;
  /** Injected in tests to stub Google. */
  fetchImpl?: typeof fetch;
}

const OAUTH_COOKIE = 'mdb_oauth';

export async function buildApp({ config, db, ping, fetchImpl }: AppDeps) {
  const app = Fastify({
    logger: config.env === 'test' ? false : { level: config.logLevel },
    trustProxy: true,
    bodyLimit: 16 * 1024,
  });

  const gamesSvc = new GameService(db);
  const hub = new Hub();
  const google: GoogleConfig | null = config.google
    ? { ...config.google, redirectUri: `${config.publicUrl}/api/auth/google/callback` }
    : null;

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", config.publicUrl.replace(/^http/, 'ws')],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'", 'https://accounts.google.com'],
        upgradeInsecureRequests: config.secureCookies ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.secureCookies,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ statusCode: 429, error: 'rate_limited' }),
  });
  await app.register(websocket, { options: { maxPayload: 4 * 1024 } });

  // ---------- auth plumbing ----------

  const cookieOpts = (expires: Date) => ({
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.secureCookies,
    expires,
  });

  const setSessionCookie = (reply: FastifyReply, token: string, expires: Date) =>
    reply.setCookie(SESSION_COOKIE, token, cookieOpts(expires));

  app.decorateRequest('user', null);

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') && !req.url.startsWith('/ws')) return;
    const found = await getSessionUser(db, req.cookies[SESSION_COOKIE]);
    req.user = found?.user ?? null;
    if (found?.renewedUntil) setSessionCookie(reply, req.cookies[SESSION_COOKIE]!, found.renewedUntil);

    // CSRF: state-changing requests must come from our own origin.
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.url.startsWith('/api/')) {
      const origin = req.headers.origin;
      if (origin && origin !== config.publicUrl) throw new AppError('unauthorized', 403);
    }
  });

  const requireUser = (req: FastifyRequest): UserRow => {
    if (!req.user) throw new AppError('unauthorized');
    return req.user;
  };

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: err.code });
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return reply.status(429).send({ error: 'rate_limited' });
    if (status && status >= 400 && status < 500) return reply.status(400).send({ error: 'invalid_request' });
    req.log.error(err);
    return reply.status(500).send({ error: 'internal' });
  });

  // ---------- helpers ----------

  /** Push the new state to watchers and return it to the caller. */
  const afterMutation = async (result: MutationResult, code: string) => {
    if (result.removed.length) hub.notifyRemoved(result.gameId, code, result.removed);
    if (result.deleted) {
      hub.closeRoom(result.gameId);
      return null;
    }
    const snapshot = await gamesSvc.snapshot(result.gameId);
    hub.broadcast(snapshot);
    return snapshot;
  };

  // ---------- routes: system ----------

  app.get('/api/health', async () => {
    await ping?.();
    return { ok: true, sockets: hub.size };
  });

  app.get('/api/config', async () => ({ google: google !== null }));

  // ---------- routes: auth ----------

  app.get('/api/me', async (req) => ({ user: req.user ? toMe(req.user) : null }));

  app.post('/api/auth/guest', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { name } = parse(guestLoginSchema, req.body);
    const user = await createGuest(db, name);
    const { token, expiresAt } = await createSession(db, user.id);
    setSessionCookie(reply, token, expiresAt);
    return { user: toMe(user) };
  });

  app.patch('/api/me', async (req) => {
    const user = requireUser(req);
    const { name } = parse(updateMeSchema, req.body);
    return { user: toMe(await renameUser(db, user.id, name)) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await deleteSession(db, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get<{ Querystring: { next?: string } }>(
    '/api/auth/google',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!google) throw new AppError('google_disabled');
      const { url, state, verifier } = createAuthorization(google);
      const next = safeNext(req.query.next);
      reply.setCookie(OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
        ...cookieOpts(new Date(Date.now() + 10 * 60 * 1000)),
        path: '/api/auth/google',
      });
      return reply.redirect(url);
    },
  );

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/api/auth/google/callback',
    async (req, reply) => {
      if (!google) throw new AppError('google_disabled');
      reply.clearCookie(OAUTH_COOKIE, { path: '/api/auth/google' });
      let stored: { state: string; verifier: string; next: string } | null = null;
      try {
        stored = JSON.parse(req.cookies[OAUTH_COOKIE] ?? 'null');
      } catch {
        stored = null;
      }
      const { code, state } = req.query;
      if (!stored || !code || !state || state !== stored.state) {
        return reply.redirect('/login?error=google');
      }
      try {
        const profile = await exchangeCode(google, code, stored.verifier, fetchImpl);
        const user = await upsertGoogleUser(db, profile, req.user);
        await deleteSession(db, req.cookies[SESSION_COOKIE]);
        const session = await createSession(db, user.id);
        setSessionCookie(reply, session.token, session.expiresAt);
        return reply.redirect(stored.next);
      } catch (err) {
        req.log.warn({ err }, 'google login failed');
        return reply.redirect('/login?error=google');
      }
    },
  );

  // ---------- routes: games ----------

  app.get('/api/me/games', async (req) => gamesSvc.myGames(requireUser(req).id));

  app.post('/api/games', async (req) => {
    const user = requireUser(req);
    const input = parse(createGameSchema, req.body);
    const result = await gamesSvc.create(user.id, input);
    return { game: await gamesSvc.snapshot(result.gameId) };
  });

  app.get<{ Params: { ref: string } }>('/api/games/:ref', async (req) => {
    return gamesSvc.view(requireUser(req).id, req.params.ref);
  });

  const mutation = (
    route: string,
    run: (userId: string, ref: string, body: unknown) => Promise<MutationResult>,
    rateLimitMax = 120,
  ) =>
    app.post<{ Params: { ref: string } }>(
      route,
      { config: { rateLimit: { max: rateLimitMax, timeWindow: '1 minute' } } },
      async (req) => {
        const user = requireUser(req);
        const game = await gamesSvc.resolve(req.params.ref);
        const result = await run(user.id, game.id, req.body);
        return { game: await afterMutation(result, game.code) };
      },
    );

  mutation('/api/games/:ref/join', (uid, id) => gamesSvc.join(uid, id), 30);
  mutation('/api/games/:ref/start', (uid, id) => gamesSvc.start(uid, id));
  mutation('/api/games/:ref/actions', (uid, id, body) => gamesSvc.act(uid, id, parse(actionRequestSchema, body)), 240);
  mutation('/api/games/:ref/turn', (uid, id, body) => gamesSvc.turn(uid, id, parse(turnSchema, body)), 240);
  mutation('/api/games/:ref/token', (uid, id, body) => gamesSvc.setToken(uid, id, parse(tokenSchema, body).token), 60);
  mutation('/api/games/:ref/leave', (uid, id) => gamesSvc.leave(uid, id));
  mutation('/api/games/:ref/kick', (uid, id, body) => gamesSvc.kick(uid, id, parse(kickSchema, body).userId));
  mutation('/api/games/:ref/finish', (uid, id) => gamesSvc.finish(uid, id));
  mutation('/api/games/:ref/disband', (uid, id) => gamesSvc.disband(uid, id));

  // ---------- websocket ----------

  app.get('/ws', { websocket: true }, (socket, req) => {
    const origin = req.headers.origin;
    if (!req.user || (origin && origin !== config.publicUrl)) {
      socket.close(4401, 'unauthorized');
      return;
    }
    const userId = req.user.id;
    hub.add(socket, userId);

    let alive = true;
    socket.on('pong', () => (alive = true));
    const heartbeat = setInterval(() => {
      if (!alive) return socket.terminate();
      alive = false;
      socket.ping();
    }, 25_000);

    const reply = (msg: ServerMessage) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(msg));

    socket.on('message', async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        return reply({ type: 'error', error: 'invalid_request' });
      }
      alive = true;
      if (msg.type === 'ping') return reply({ type: 'pong' });
      if (msg.type === 'subscribe' && typeof msg.code === 'string') {
        try {
          const game = await gamesSvc.resolve(msg.code);
          if (!(await gamesSvc.isMember(game.id, userId))) return reply({ type: 'error', error: 'not_a_player' });
          hub.join(socket, game.id);
          reply({ type: 'snapshot', game: await gamesSvc.snapshot(game.id) });
        } catch (err) {
          reply({ type: 'error', error: err instanceof AppError ? err.code : 'internal' });
        }
      }
    });

    socket.on('close', () => {
      clearInterval(heartbeat);
      hub.remove(socket);
    });
  });

  // ---------- static web app ----------

  app.get('/robots.txt', (_req, reply) =>
    reply.header('cache-control', 'public, max-age=3600').type('text/plain; charset=utf-8').send(robotsTxt(config.publicUrl)),
  );
  app.get('/sitemap.xml', (_req, reply) =>
    reply.header('cache-control', 'public, max-age=3600').type('application/xml; charset=utf-8').send(sitemapXml(config.publicUrl)),
  );

  const webDist = config.webDist && existsSync(config.webDist) ? path.resolve(config.webDist) : null;
  if (webDist) {
    const shell = readFileSync(path.join(webDist, 'index.html'), 'utf8');
    await app.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
      // pages, including "/", go through the SEO shell below
      index: false,
      // generated by the routes above; a stray copy in the build must not clash with them
      globIgnore: ['index.html', 'robots.txt', 'sitemap.xml'],
      setHeaders(res, filePath) {
        res.header(
          'cache-control',
          filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
    // Files are served by @fastify/static; everything else that looks like a page gets the SPA shell.
    app.get('/*', (req, reply) => {
      const pathname = req.url.split('?')[0]!;
      if (pathname.startsWith('/api/') || pathname.startsWith('/assets/') || path.extname(pathname)) {
        return reply.status(404).send({ error: 'game_not_found' });
      }
      const page = seoFor(pathname, config.publicUrl);
      // an unknown game guide is a real 404 for crawlers; the app still loads and redirects people
      const status = page.notFound ? 404 : 200;
      return reply
        .status(status)
        .header('cache-control', 'no-cache')
        .type('text/html; charset=utf-8')
        .send(renderShell(shell, page, config.publicUrl));
    });
  }

  app.setNotFoundHandler((req, reply) => reply.status(404).send({ error: 'game_not_found' }));

  return { app, gamesSvc, hub };
}

/** Only allow same-site relative redirects after login. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/app';
  return next;
}
