import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAYER_TOKENS, type GameSnapshot } from '@mdb/shared';
import { PUBLIC_URL, createTestApp, guest } from './helpers';

let t: Awaited<ReturnType<typeof createTestApp>>;

beforeEach(async () => {
  t = await createTestApp();
});
afterEach(async () => {
  await t.close();
});

const settings = { startingCapital: 1500, salary: 200, freeParkingEnabled: true, currency: '$' as const };

async function startedGame(names = ['Ada', 'Bora', 'Cem']) {
  const players = await Promise.all(names.map((n) => guest(t.app, n)));
  const [host, ...rest] = players;
  const created = await host!.call('POST', '/api/games', settings);
  const code = created.body.game!.code;
  for (const p of rest) expect((await p.call('POST', `/api/games/${code}/join`)).status).toBe(200);
  const started = await host!.call('POST', `/api/games/${code}/start`);
  expect(started.status).toBe(200);
  return { code, players, game: started.body.game! };
}

const balance = (g: GameSnapshot, id: string) => g.players.find((p) => p.userId === id)!.balance;
let n = 0;
const txId = () => `test-tx-${Date.now()}-${n++}`;

describe('auth', () => {
  it('creates a guest session and reports the user', async () => {
    const ada = await guest(t.app, '  Ada   Lovelace ');
    const me = await ada.call('GET', '/api/me');
    expect(me.body.user).toMatchObject({ name: 'Ada Lovelace', kind: 'guest' });
  });

  it('rejects requests without a session', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/api/games', payload: settings });
    expect(res.statusCode).toBe(401);
  });

  it('rejects cross-origin writes', async () => {
    const ada = await guest(t.app, 'Ada');
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/games',
      payload: settings,
      cookies: { mdb_session: ada.cookie },
      headers: { origin: 'https://evil.example' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('logs out', async () => {
    const ada = await guest(t.app, 'Ada');
    await ada.call('POST', '/api/auth/logout');
    expect((await ada.call('GET', '/api/me')).body.user).toBeNull();
  });
});

describe('google login', () => {
  it('upgrades the current guest account and keeps its games', async () => {
    const idToken = (claims: object) =>
      `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          id_token: idToken({
            iss: 'https://accounts.google.com',
            aud: 'test-client',
            sub: 'google-123',
            exp: Math.floor(Date.now() / 1000) + 600,
            given_name: 'Ada',
            email: 'ada@example.com',
            email_verified: true,
          }),
        }),
      )) as typeof fetch;
    await t.close();
    t = await createTestApp({}, fakeFetch);

    const ada = await guest(t.app, 'Ada guest');
    await ada.call('POST', '/api/games', settings);

    const startRes = await t.app.inject({
      method: 'GET',
      url: '/api/auth/google?next=/app',
      cookies: { mdb_session: ada.cookie },
    });
    expect(startRes.statusCode).toBe(302);
    const authUrl = new URL(startRes.headers.location as string);
    expect(authUrl.origin).toBe('https://accounts.google.com');
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authUrl.searchParams.get('redirect_uri')).toBe(`${PUBLIC_URL}/api/auth/google/callback`);
    const state = authUrl.searchParams.get('state')!;
    const oauthCookie = startRes.cookies.find((c) => c.name === 'mdb_oauth')!;

    const bad = await t.app.inject({
      method: 'GET',
      url: `/api/auth/google/callback?code=abc&state=wrong`,
      cookies: { mdb_oauth: oauthCookie.value },
    });
    expect(bad.headers.location).toBe('/login?error=google');

    const cb = await t.app.inject({
      method: 'GET',
      url: `/api/auth/google/callback?code=abc&state=${state}`,
      cookies: { mdb_oauth: oauthCookie.value, mdb_session: ada.cookie },
    });
    expect(cb.statusCode).toBe(302);
    expect(cb.headers.location).toBe('/app');
    const session = cb.cookies.find((c) => c.name === 'mdb_session')!;

    const me = await t.app.inject({ method: 'GET', url: '/api/me', cookies: { mdb_session: session.value } });
    expect(me.json().user).toMatchObject({ id: ada.id, kind: 'google', email: 'ada@example.com' });
    const games = await t.app.inject({ method: 'GET', url: '/api/me/games', cookies: { mdb_session: session.value } });
    expect(games.json().ongoing).toHaveLength(1);

    // old guest session was replaced
    expect((await ada.call('GET', '/api/me')).body.user).toBeNull();
  });

  it('reports when google is not configured', async () => {
    await t.close();
    t = await createTestApp({ google: null });
    expect((await t.app.inject({ method: 'GET', url: '/api/config' })).json()).toEqual({ google: false });
    expect((await t.app.inject({ method: 'GET', url: '/api/auth/google' })).statusCode).toBe(404);
  });
});

describe('lobby', () => {
  it('previews a lobby for outsiders and lets them join', async () => {
    const ada = await guest(t.app, 'Ada');
    const bora = await guest(t.app, 'Bora');
    const { game } = (await ada.call('POST', '/api/games', settings)).body;
    expect(game!.code).toMatch(/^[A-Z2-9]{5}$/);

    const preview = await bora.call('GET', `/api/games/${game!.code.toLowerCase()}`);
    expect(preview.body).toMatchObject({ kind: 'preview', preview: { hostName: 'Ada', playerCount: 1 } });

    const joined = await bora.call('POST', `/api/games/${game!.code}/join`);
    expect(joined.body.game!.players.map((p) => p.name)).toEqual(['Ada', 'Bora']);
    expect(new Set(joined.body.game!.players.map((p) => p.color)).size).toBe(2);

    // joining twice is harmless
    expect((await bora.call('POST', `/api/games/${game!.code}/join`)).status).toBe(200);
  });

  it('needs two players and the host to start', async () => {
    const ada = await guest(t.app, 'Ada');
    const bora = await guest(t.app, 'Bora');
    const code = (await ada.call('POST', '/api/games', settings)).body.game!.code;
    expect((await ada.call('POST', `/api/games/${code}/start`)).body.error).toBe('not_enough_players');
    await bora.call('POST', `/api/games/${code}/join`);
    expect((await bora.call('POST', `/api/games/${code}/start`)).body.error).toBe('not_host');
    expect((await ada.call('POST', `/api/games/${code}/start`)).body.game!.status).toBe('active');
    const late = await guest(t.app, 'Cem');
    expect((await late.call('POST', `/api/games/${code}/join`)).body.error).toBe('game_started');
  });

  it('hands the lobby to the next player when the host leaves, and deletes it when empty', async () => {
    const ada = await guest(t.app, 'Ada');
    const bora = await guest(t.app, 'Bora');
    const code = (await ada.call('POST', '/api/games', settings)).body.game!.code;
    await bora.call('POST', `/api/games/${code}/join`);
    const after = await ada.call('POST', `/api/games/${code}/leave`);
    expect(after.body.game!.hostUserId).toBe(bora.id);
    const gone = await bora.call('POST', `/api/games/${code}/leave`);
    expect(gone.body.game).toBeNull();
    expect((await bora.call('GET', `/api/games/${code}`)).status).toBe(404);
  });

  it('lets the host kick and disband', async () => {
    const ada = await guest(t.app, 'Ada');
    const bora = await guest(t.app, 'Bora');
    const code = (await ada.call('POST', '/api/games', settings)).body.game!.code;
    await bora.call('POST', `/api/games/${code}/join`);
    expect((await ada.call('POST', `/api/games/${code}/kick`, { userId: ada.id })).body.error).toBe('cannot_kick_self');
    const kicked = await ada.call('POST', `/api/games/${code}/kick`, { userId: bora.id });
    expect(kicked.body.game!.players).toHaveLength(1);
    expect((await ada.call('POST', `/api/games/${code}/disband`)).body.game).toBeNull();
  });
});

describe('money', () => {
  it('moves money between players and keeps a history', async () => {
    const { code, players } = await startedGame();
    const [ada, bora] = players;
    const res = await ada!.call('POST', `/api/games/${code}/actions`, {
      clientTxId: txId(),
      action: { kind: 'player_to_player', toUserId: bora!.id, amount: 250 },
    });
    expect(res.status).toBe(200);
    const g = res.body.game!;
    expect(balance(g, ada!.id)).toBe(1250);
    expect(balance(g, bora!.id)).toBe(1750);
    expect(g.transactions[0]).toMatchObject({ kind: 'player_to_player', amount: 250, fromUserId: ada!.id });
  });

  it('handles billion-scale games without overflowing', async () => {
    const [ada, bora] = await Promise.all([guest(t.app, 'Ada'), guest(t.app, 'Bora')]);
    const big = { ...settings, startingCapital: 900_000_000_000, salary: 50_000_000_000 };
    const code = (await ada.call('POST', '/api/games', big)).body.game!.code;
    await bora.call('POST', `/api/games/${code}/join`);
    await ada.call('POST', `/api/games/${code}/start`);
    const paid = await ada.call('POST', `/api/games/${code}/actions`, {
      clientTxId: txId(),
      action: { kind: 'player_to_player', amount: 800_000_000_000, toUserId: bora.id },
    });
    expect(paid.status).toBe(200);
    const salary = await bora.call('POST', `/api/games/${code}/actions`, { clientTxId: txId(), action: { kind: 'salary' } });
    const g = salary.body.game!;
    expect(balance(g, bora.id)).toBe(1_750_000_000_000);
    expect(typeof balance(g, bora.id)).toBe('number');
    expect(balance(g, ada.id)).toBe(100_000_000_000);
  });

  it('applies a retried request only once', async () => {
    const { code, players } = await startedGame();
    const id = txId();
    const body = { clientTxId: id, action: { kind: 'salary' } };
    await players[0]!.call('POST', `/api/games/${code}/actions`, body);
    const again = await players[0]!.call('POST', `/api/games/${code}/actions`, body);
    expect(balance(again.body.game!, players[0]!.id)).toBe(1700);
  });

  it('refuses overspending', async () => {
    const { code, players } = await startedGame();
    const res = await players[0]!.call('POST', `/api/games/${code}/actions`, {
      clientTxId: txId(),
      action: { kind: 'player_to_bank', amount: 1501 },
    });
    expect(res.body.error).toBe('insufficient_funds');
  });

  it('keeps the total consistent under concurrent payments', async () => {
    const { code, players } = await startedGame(['Ada', 'Bora']);
    const [ada, bora] = players;
    const pay = (from: typeof ada, to: typeof bora) =>
      from!.call('POST', `/api/games/${code}/actions`, {
        clientTxId: txId(),
        action: { kind: 'player_to_player', toUserId: to!.id, amount: 10 },
      });
    const results = await Promise.all([
      ...Array.from({ length: 15 }, () => pay(ada, bora)),
      ...Array.from({ length: 15 }, () => pay(bora, ada)),
    ]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    const final = (await ada!.call('GET', `/api/games/${code}`)).body.game!;
    expect(balance(final, ada!.id)).toBe(1500);
    expect(balance(final, bora!.id)).toBe(1500);
    expect(final.transactions).toHaveLength(30);
  });

  it('collects free parking', async () => {
    const { code, players } = await startedGame();
    await players[0]!.call('POST', `/api/games/${code}/actions`, {
      clientTxId: txId(),
      action: { kind: 'player_to_parking', amount: 100 },
    });
    const res = await players[1]!.call('POST', `/api/games/${code}/actions`, {
      clientTxId: txId(),
      action: { kind: 'parking_to_player' },
    });
    expect(res.body.game!.freeParkingPot).toBe(0);
    expect(balance(res.body.game!, players[1]!.id)).toBe(1600);
  });

  it('ends the game when everyone else goes bankrupt and records stats', async () => {
    const { code, players } = await startedGame(['Ada', 'Bora', 'Cem']);
    const [ada, bora, cem] = players;
    await bora!.call('POST', `/api/games/${code}/actions`, {
      clientTxId: txId(),
      action: { kind: 'bankruptcy', creditorUserId: ada!.id },
    });
    const out = await bora!.call('POST', `/api/games/${code}/actions`, { clientTxId: txId(), action: { kind: 'salary' } });
    expect(out.body.error).toBe('player_out');

    const last = await cem!.call('POST', `/api/games/${code}/actions`, {
      clientTxId: txId(),
      action: { kind: 'bankruptcy', creditorUserId: null },
    });
    const g = last.body.game!;
    expect(g.status).toBe('finished');
    expect(g.winnerUserId).toBe(ada!.id);
    expect(balance(g, ada!.id)).toBe(3000);

    const mine = (await ada!.call('GET', '/api/me/games')).body as unknown as {
      ongoing: unknown[];
      finished: { ref: string; wonByMe: boolean; winnerName: string }[];
      stats: { played: number; won: number };
    };
    expect(mine.ongoing).toHaveLength(0);
    expect(mine.finished[0]).toMatchObject({ wonByMe: true, winnerName: 'Ada', ref: g.id });
    expect(mine.stats).toMatchObject({ played: 1, won: 1 });

    // finished games stay viewable by id, and the code is free for a new game
    expect((await bora!.call('GET', `/api/games/${g.id}`)).body.kind).toBe('member');
  });

  it('host can finish early; richest player wins', async () => {
    const { code, players } = await startedGame(['Ada', 'Bora']);
    await players[1]!.call('POST', `/api/games/${code}/actions`, { clientTxId: txId(), action: { kind: 'salary' } });
    expect((await players[1]!.call('POST', `/api/games/${code}/finish`)).body.error).toBe('not_host');
    const res = await players[0]!.call('POST', `/api/games/${code}/finish`);
    expect(res.body.game!).toMatchObject({ status: 'finished', winnerUserId: players[1]!.id });
  });

  it('leaving a running game returns money to the bank and passes the host role on', async () => {
    const { code, players } = await startedGame();
    const [ada, bora] = players;
    const res = await ada!.call('POST', `/api/games/${code}/leave`);
    const g = res.body.game!;
    expect(g.players.find((p) => p.userId === ada!.id)).toMatchObject({ status: 'left', balance: 0 });
    expect(g.hostUserId).toBe(bora!.id);
    expect(g.transactions[0]).toMatchObject({ kind: 'leave', amount: 1500 });
  });

  it('non-members cannot see a running game', async () => {
    const { code } = await startedGame(['Ada', 'Bora']);
    const outsider = await guest(t.app, 'Eve');
    expect((await outsider.call('GET', `/api/games/${code}`)).body.error).toBe('game_started');
    const res = await outsider.call('POST', `/api/games/${code}/actions`, {
      clientTxId: txId(),
      action: { kind: 'salary' },
    });
    expect(res.body.error).toBe('not_a_player');
  });
});

describe('turns', () => {
  const endTurn = (p: Awaited<ReturnType<typeof guest>>, code: string, userId: string, kind: 'end' | 'skip' = 'end') =>
    p.call('POST', `/api/games/${code}/turn`, { kind, userId });

  it('starts at round 1 with the first seat and keeps round 0 balances', async () => {
    const { game, players } = await startedGame();
    expect(game).toMatchObject({ turnsEnabled: true, round: 1, turnUserId: players[0]!.id });
    expect(game.rounds).toEqual([
      { round: 0, balances: Object.fromEntries(players.map((p) => [p.id, 1500])) },
    ]);
  });

  it('moves through the seats and closes a round when play wraps', async () => {
    const { code, players } = await startedGame();
    const [ada, bora, cem] = players;
    await bora!.call('POST', `/api/games/${code}/actions`, {
      clientTxId: txId(),
      action: { kind: 'player_to_player', toUserId: cem!.id, amount: 100 },
    });

    expect((await endTurn(bora!, code, ada!.id)).body.error).toBe('not_your_turn');
    let g = (await endTurn(ada!, code, ada!.id)).body.game!;
    expect(g.turnUserId).toBe(bora!.id);
    // a repeated tap for a turn that already ended changes nothing
    g = (await endTurn(ada!, code, ada!.id)).body.game!;
    expect(g.turnUserId).toBe(bora!.id);

    await endTurn(bora!, code, bora!.id);
    g = (await endTurn(cem!, code, cem!.id)).body.game!;
    expect(g).toMatchObject({ round: 2, turnUserId: ada!.id });
    expect(g.rounds[1]).toEqual({ round: 1, balances: { [ada!.id]: 1500, [bora!.id]: 1400, [cem!.id]: 1600 } });
  });

  it('lets only the host skip someone else', async () => {
    const { code, players } = await startedGame();
    const [ada, bora, cem] = players;
    await endTurn(ada!, code, ada!.id);
    expect((await endTurn(cem!, code, bora!.id, 'skip')).body.error).toBe('not_host');
    const g = (await endTurn(ada!, code, bora!.id, 'skip')).body.game!;
    expect(g.turnUserId).toBe(cem!.id);
  });

  it('passes the turn on when its player goes bankrupt, and ends their line in the chart', async () => {
    const { code, players } = await startedGame();
    const [ada, bora, cem] = players;
    await endTurn(ada!, code, ada!.id);
    let g = (
      await bora!.call('POST', `/api/games/${code}/actions`, {
        clientTxId: txId(),
        action: { kind: 'bankruptcy', creditorUserId: cem!.id },
      })
    ).body.game!;
    expect(g.turnUserId).toBe(cem!.id);

    g = (await endTurn(cem!, code, cem!.id)).body.game!;
    expect(g).toMatchObject({ round: 2, turnUserId: ada!.id });
    expect(g.rounds[1]!.balances).toEqual({ [ada!.id]: 1500, [bora!.id]: 0, [cem!.id]: 3000 });

    await endTurn(ada!, code, ada!.id);
    g = (await endTurn(cem!, code, cem!.id)).body.game!;
    expect(Object.keys(g.rounds[2]!.balances).sort()).toEqual([ada!.id, cem!.id].sort());
  });

  it('keeps the last round when the game ends', async () => {
    const { code, players } = await startedGame(['Ada', 'Bora']);
    const [ada, bora] = players;
    await bora!.call('POST', `/api/games/${code}/actions`, { clientTxId: txId(), action: { kind: 'salary' } });
    const g = (await ada!.call('POST', `/api/games/${code}/finish`)).body.game!;
    expect(g.turnUserId).toBeNull();
    expect(g.rounds.at(-1)).toEqual({ round: 1, balances: { [ada!.id]: 1500, [bora!.id]: 1700 } });
  });

  it('can be switched off when the game is created', async () => {
    const [ada, bora] = await Promise.all([guest(t.app, 'Ada'), guest(t.app, 'Bora')]);
    const code = (await ada.call('POST', '/api/games', { ...settings, turnsEnabled: false })).body.game!.code;
    await bora.call('POST', `/api/games/${code}/join`);
    const g = (await ada.call('POST', `/api/games/${code}/start`)).body.game!;
    expect(g).toMatchObject({ turnsEnabled: false, round: 0, turnUserId: null, rounds: [] });
    expect((await endTurn(ada, code, ada.id)).body.error).toBe('turns_disabled');
  });
});

describe('game pieces', () => {
  it('gives each player a different piece and lets them swap to a free one', async () => {
    const [ada, bora] = await Promise.all([guest(t.app, 'Ada'), guest(t.app, 'Bora')]);
    const code = (await ada.call('POST', '/api/games', settings)).body.game!.code;
    const joined = (await bora.call('POST', `/api/games/${code}/join`)).body.game!;
    const [a, b] = joined.players;
    expect(a!.token).not.toBe(b!.token);

    expect((await bora.call('POST', `/api/games/${code}/token`, { token: a!.token })).body.error).toBe('token_taken');
    // pieces are dealt at random, so swap to one that is free whatever was dealt
    const free = PLAYER_TOKENS.find((tk) => tk !== a!.token && tk !== b!.token)!;
    const g = (await bora.call('POST', `/api/games/${code}/token`, { token: free })).body.game!;
    expect(g.players.find((p) => p.userId === bora.id)!.token).toBe(free);
    expect((await bora.call('POST', `/api/games/${code}/token`, { token: 'unicorn' })).status).toBe(400);
  });
});

type Player = Awaited<ReturnType<typeof guest>>;

describe('undo', () => {
  const pay = (p: Player, code: string, toUserId: string, amount: number) =>
    p.call('POST', `/api/games/${code}/actions`, { clientTxId: txId(), action: { kind: 'player_to_player', toUserId, amount } });

  afterEach(() => vi.useRealTimers());

  it('sends a payment back, records it, and only once', async () => {
    const { code, players } = await startedGame();
    const [ada, bora] = players as [Player, Player, Player];
    const paid = await pay(bora, code, ada.id, 300);
    const paidId = paid.body.game!.transactions[0]!.id;

    const undone = await bora.call('POST', `/api/games/${code}/undo`, { txId: paidId });
    expect(undone.status).toBe(200);
    const g = undone.body.game!;
    expect(balance(g, ada.id)).toBe(1500);
    expect(balance(g, bora.id)).toBe(1500);
    expect(g.transactions[0]).toMatchObject({ kind: 'reversal', reversesTxId: paidId, fromUserId: ada.id, toUserId: bora.id, amount: 300 });

    // a second undo of the same payment changes nothing
    const again = await bora.call('POST', `/api/games/${code}/undo`, { txId: paidId });
    expect(again.status).toBe(200);
    expect(again.body.game!.transactions.filter((t) => t.kind === 'reversal')).toHaveLength(1);
  });

  it('lets the payer undo for two minutes and the host at any time', async () => {
    const { code, players } = await startedGame();
    const [ada, bora, cem] = players as [Player, Player, Player];
    const paidId = (await pay(bora, code, cem.id, 100)).body.game!.transactions[0]!.id;

    // another player who is not the host cannot undo it
    expect((await cem.call('POST', `/api/games/${code}/undo`, { txId: paidId })).body.error).toBe('undo_unavailable');

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 3 * 60 * 1000 });
    expect((await bora.call('POST', `/api/games/${code}/undo`, { txId: paidId })).body.error).toBe('undo_unavailable');
    const host = await ada.call('POST', `/api/games/${code}/undo`, { txId: paidId });
    expect(host.status).toBe(200);
    expect(balance(host.body.game!, bora.id)).toBe(1500);
  });

  it('refuses when the receiver no longer has the money', async () => {
    const { code, players } = await startedGame();
    const [ada, bora, cem] = players as [Player, Player, Player];
    const paidId = (await pay(bora, code, ada.id, 1000)).body.game!.transactions[0]!.id;
    await pay(ada, code, cem.id, 2400);
    const res = await bora.call('POST', `/api/games/${code}/undo`, { txId: paidId });
    expect(res.body.error).toBe('undo_insufficient');
  });

  it('cannot undo a bankruptcy', async () => {
    const { code, players } = await startedGame();
    const [ada, bora] = players as [Player, Player, Player];
    const out = await bora.call('POST', `/api/games/${code}/actions`, { clientTxId: txId(), action: { kind: 'bankruptcy', creditorUserId: null } });
    const id = out.body.game!.transactions[0]!.id;
    expect((await ada.call('POST', `/api/games/${code}/undo`, { txId: id })).body.error).toBe('undo_unavailable');
  });
});

describe('dice', () => {
  it('rolls on the server and shows the same roll to the table', async () => {
    const { code, players } = await startedGame();
    const [ada, bora] = players as [Player, Player, Player];
    const first = await ada.call('POST', `/api/games/${code}/roll`, { count: 2 });
    expect(first.status).toBe(200);
    const roll = first.body.game!.lastRoll!;
    expect(roll).toMatchObject({ seq: 1, userId: ada.id });
    expect(roll.dice).toHaveLength(2);
    for (const d of roll.dice) expect(d >= 1 && d <= 6).toBe(true);

    const second = await bora.call('POST', `/api/games/${code}/roll`, { count: 1 });
    expect(second.body.game!.lastRoll).toMatchObject({ seq: 2, userId: bora.id });
    expect(second.body.game!.lastRoll!.dice).toHaveLength(1);
    expect((await bora.call('POST', `/api/games/${code}/roll`, { count: 3 })).status).toBe(400);
  });
});

describe('auction', () => {
  afterEach(() => vi.useRealTimers());

  async function openAuction(minBid = 50) {
    const s = await startedGame();
    const res = await s.players[0]!.call('POST', `/api/games/${s.code}/auction`, { title: '  Bağdat   Caddesi ', minBid });
    expect(res.status).toBe(200);
    return { ...s, players: s.players as [Player, Player, Player], auction: res.body.game!.auction! };
  }

  it('takes rising bids and sells to the highest one when time is up', async () => {
    const { code, players, auction } = await openAuction();
    const [ada, bora, cem] = players;
    expect(auction).toMatchObject({ title: 'Bağdat Caddesi', status: 'open', minBid: 50 });
    const bid = (p: Player, amount: number) => p.call('POST', `/api/games/${code}/auction/bid`, { auctionId: auction.id, amount });

    expect((await bid(bora, 40)).body.error).toBe('bid_too_low');
    expect((await bid(bora, 60)).status).toBe(200);
    expect((await bid(bora, 60)).status).toBe(200); // the same bid again is not an error
    expect((await bid(cem, 60)).body.error).toBe('bid_too_low');
    expect((await bid(cem, 5000)).body.error).toBe('insufficient_funds');
    const last = await bid(cem, 120);
    expect(last.body.game!.auction!.bids).toHaveLength(2);

    // not over yet: settling early changes nothing
    const early = await ada.call('POST', `/api/games/${code}/auction/settle`, { auctionId: auction.id });
    expect(early.body.game!.auction!.status).toBe('open');

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60_000 });
    expect((await bid(bora, 200)).body.error).toBe('auction_closed');
    const done = await ada.call('POST', `/api/games/${code}/auction/settle`, { auctionId: auction.id });
    const g = done.body.game!;
    expect(g.auction).toMatchObject({ status: 'sold', winnerUserId: cem.id, price: 120 });
    expect(balance(g, cem.id)).toBe(1380);
    expect(g.transactions[0]).toMatchObject({ kind: 'auction', fromUserId: cem.id, toUserId: null, amount: 120, note: 'Bağdat Caddesi' });
  });

  it('passes over a winner who can no longer pay', async () => {
    const { code, players, auction } = await openAuction(10);
    const [ada, bora, cem] = players;
    await bora.call('POST', `/api/games/${code}/auction/bid`, { auctionId: auction.id, amount: 100 });
    await cem.call('POST', `/api/games/${code}/auction/bid`, { auctionId: auction.id, amount: 1400 });
    await cem.call('POST', `/api/games/${code}/actions`, { clientTxId: txId(), action: { kind: 'player_to_bank', amount: 500 } });
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60_000 });
    const g = (await ada.call('POST', `/api/games/${code}/auction/settle`, { auctionId: auction.id })).body.game!;
    expect(g.auction).toMatchObject({ status: 'sold', winnerUserId: bora.id, price: 100 });
  });

  it('ends unsold without bids, allows one auction at a time, and can be cancelled', async () => {
    const { code, players, auction } = await openAuction();
    const [ada, bora, cem] = players;
    expect((await bora.call('POST', `/api/games/${code}/auction`, { title: '', minBid: 0 })).body.error).toBe('auction_running');
    expect((await cem.call('POST', `/api/games/${code}/auction/cancel`, { auctionId: auction.id })).body.error).toBe('not_host');

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60_000 });
    // an expired auction is settled before a new one opens
    const next = await bora.call('POST', `/api/games/${code}/auction`, { title: '', minBid: 0 });
    expect(next.status).toBe(200);
    const fresh = next.body.game!.auction!;
    expect(fresh.id).not.toBe(auction.id);
    expect(fresh.status).toBe('open');
    vi.useRealTimers();

    const cancelled = await ada.call('POST', `/api/games/${code}/auction/cancel`, { auctionId: fresh.id });
    expect(cancelled.body.game!.auction!.status).toBe('cancelled');
    expect(cancelled.body.game!.transactions.some((t) => t.kind === 'auction')).toBe(false);
  });
});
