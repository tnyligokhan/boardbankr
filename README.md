# BoardBankr: a digital bank for Monopoly and board games

A free, open-source digital banker and money tracker for Monopoly, Cashflow, Hotel Tycoon and any board game played with paper money. Runs in the browser, so there is nothing to install: everyone sees their balance on their own phone, and rent, salary and fines are paid with a tap. Also works as a stand-in when the card unit of an electronic banking edition breaks.

[Türkçe](README.tr.md)

## Features

- Join a lobby with a five-character code or a QR code, up to 8 players
- Player-to-player payments, bank in/out, salary, optional free parking pot
- Bankruptcy hands remaining money to the creditor; last player standing wins; the host can end early
- Live updates over WebSocket that recover after a dropped connection
- Every payment carries a client id, so a retried request is never applied twice
- Guest sign-in and Google sign-in (a guest can upgrade to Google and keep their games)
- Turkish / English, light / dark theme, phone and desktop layouts, keeps the screen on during play

## Stack

| Layer | Choice |
|---|---|
| Server | Node.js 22, TypeScript, Fastify 5, `@fastify/websocket` |
| Database | PostgreSQL 16, Drizzle ORM with SQL migrations |
| Web | React 19, Vite, Tailwind CSS 4, React Router 7 |
| Shared | `packages/shared`: types, zod schemas and the money rules used by both server and browser |
| Tests | Vitest; server tests run on PGlite or a real PostgreSQL |
| Deploy | A single Docker image (Coolify) |

No third-party services are required. Google is used only when Google sign-in is enabled. Fonts are self-hosted.

```
apps/server     Fastify API, WebSocket, sessions, game service
apps/web        React UI
packages/shared Types, validation, game engine
```

### How money stays consistent

The browser only sends commands ("pay Ada 200"). The server locks the game row with `SELECT … FOR UPDATE`, applies the rule, and writes balances and the ledger entry in one transaction. Concurrent payments are applied one after another. Insufficient funds, out players and spending someone else's money are rejected on the server. A unique index on `transactions(game_id, client_tx_id)` makes retries idempotent.

## Local development

```bash
npm install
cp .env.example .env          # set DATABASE_URL=pglite to run without Docker
npm run dev                   # http://localhost:5173
```

To use PostgreSQL instead, start it with `docker compose up -d db`. Set `DATABASE_URL=postgres://mdb:mdb@localhost:5432/mdb` and add `ports: ['5432:5432']` to the `db` service.

Scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. After a schema change run `npm run db:generate`. Migrations are applied automatically on start-up.

## Deploying on Coolify

**Recommended: the app plus a separate PostgreSQL resource**

1. Add a **PostgreSQL 16** database to the project and copy its internal URL.
2. Add an **Application → Public/Private Git Repository** pointing at this repo. Build Pack: **Dockerfile**, port **3000**.
3. Environment variables:
   - `DATABASE_URL`: the internal URL from step 1
   - `PUBLIC_URL`: the app's domain, e.g. `https://bank.example.com` (no trailing slash)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: optional
4. Attach the domain; Coolify handles HTTPS. The health check is `GET /api/health` and is defined in the Dockerfile.
5. Turn on **Scheduled Backups** for the database (S3 or local).

**Alternative:** deploy `docker-compose.yml` as a "Docker Compose" resource. Set `PUBLIC_URL` and `POSTGRES_PASSWORD`, and remove the `ports` line.

### Google sign-in

1. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** (Web application).
2. *Authorized redirect URI*: `https://<your-domain>/api/auth/google/callback`
3. Put the client ID and secret into the environment. If they are empty, the Google button is hidden.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `PUBLIC_URL` | yes | The exact address people open; used for the OAuth redirect and origin checks |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Google sign-in |
| `PORT` | no | Defaults to 3000 |
| `LOG_LEVEL` | no | `info` (default), `warn`, `debug`… |

### Scaling note

The app is designed to run as one container, which is plenty for a board game. To run several replicas, live updates would need to be fanned out between them, for example with PostgreSQL `LISTEN/NOTIFY`.

## License

MIT

## Trademarks

Monopoly is a registered trademark of Hasbro, Inc.; the other game names mentioned belong to their owners. BoardBankr is an independent, open-source companion tool and is not affiliated with or endorsed by Hasbro or any other game publisher. Money in the app is play money with no real value.
