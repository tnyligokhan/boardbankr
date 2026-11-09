import { randomInt, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import {
  AUCTION_BID_MS,
  AUCTION_OPEN_MS,
  GAME_CODE_ALPHABET,
  GAME_CODE_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
  PLAYER_TOKENS,
  TRANSACTION_HISTORY_LIMIT,
  REVERSIBLE_KINDS,
  UNDO_WINDOW_MS,
  applyAction,
  applyLeave,
  applyReversal,
  highBid,
  nextBidFloor,
  pickWinner,
  firstTurn,
  nextTurn,
  normalizeGameCode,
  type ActionRequest,
  type CreateGameInput,
  type Currency,
  type EngineOutcome,
  type EnginePlayer,
  type EngineResult,
  type GamePreview,
  type GameSnapshot,
  type GameSummary,
  type MyGamesResponse,
  type PlayerColor,
  type PlayerToken,
  type StartAuctionInput,
  type TransactionKind,
  type TurnRequest,
} from '@mdb/shared';
import type { Db, Tx } from '../db/index';
import { gamePlayers, gameRounds, games, transactions, users, type StoredAuction } from '../db/schema';
import { AppError, isUniqueViolation } from '../errors';

/**
 * A random colour or piece nobody at the table has yet, so games don't all open with the
 * same red rocket and yellow car. Falls back to any option if every one is taken.
 */
function pickFree<T extends string>(options: readonly T[], used: ReadonlySet<string>): T {
  const free = options.filter((o) => !used.has(o));
  const pool = free.length ? free : options;
  return pool[randomInt(pool.length)]!;
}

type GameRow = typeof games.$inferSelect;
type PlayerRow = typeof gamePlayers.$inferSelect;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateGameCode(): string {
  let code = '';
  for (let i = 0; i < GAME_CODE_LENGTH; i++) code += GAME_CODE_ALPHABET[randomInt(GAME_CODE_ALPHABET.length)];
  return code;
}

export type ViewResult = { kind: 'member'; game: GameSnapshot } | { kind: 'preview'; preview: GamePreview };

export interface Removal {
  userId: string;
  reason: 'kicked' | 'disbanded';
}

export interface MutationResult {
  gameId: string;
  /** The game row no longer exists. */
  deleted: boolean;
  removed: Removal[];
}

export class GameService {
  constructor(private readonly db: Db) {}

  // ---------- reads ----------

  /** A ref is either a game UUID or a join code. Codes resolve to the open game first. */
  async resolve(ref: string): Promise<GameRow> {
    let rows: GameRow[];
    if (UUID_RE.test(ref)) {
      rows = await this.db.select().from(games).where(eq(games.id, ref)).limit(1);
    } else {
      const code = normalizeGameCode(ref);
      rows = await this.db
        .select()
        .from(games)
        .where(eq(games.code, code))
        .orderBy(sql`(${games.status} = 'finished')`, desc(games.createdAt))
        .limit(1);
    }
    if (!rows[0]) throw new AppError('game_not_found');
    return rows[0];
  }

  async snapshot(gameId: string): Promise<GameSnapshot> {
    const [g] = await this.db.select().from(games).where(eq(games.id, gameId)).limit(1);
    if (!g) throw new AppError('game_not_found');
    const players = await this.db
      .select({ p: gamePlayers, name: users.name })
      .from(gamePlayers)
      .innerJoin(users, eq(users.id, gamePlayers.userId))
      .where(eq(gamePlayers.gameId, gameId))
      .orderBy(asc(gamePlayers.seat));
    const txs = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.gameId, gameId))
      .orderBy(desc(transactions.id))
      .limit(TRANSACTION_HISTORY_LIMIT);
    const rounds = await this.db
      .select({ round: gameRounds.round, balances: gameRounds.balances })
      .from(gameRounds)
      .where(eq(gameRounds.gameId, gameId))
      .orderBy(asc(gameRounds.round));

    return {
      id: g.id,
      code: g.code,
      status: g.status,
      hostUserId: g.hostUserId,
      startingCapital: g.startingCapital,
      salary: g.salary,
      currency: g.currency as Currency,
      freeParkingEnabled: g.freeParkingEnabled,
      freeParkingPot: g.freeParkingPot,
      turnsEnabled: g.turnsEnabled,
      round: g.round,
      turnUserId: g.turnUserId,
      rounds,
      lastRoll: g.lastRoll ?? null,
      auction: g.auction ? { ...g.auction, remainingMs: Math.max(0, Date.parse(g.auction.endsAt) - Date.now()) } : null,
      version: g.version,
      createdAt: g.createdAt.toISOString(),
      startedAt: g.startedAt?.toISOString() ?? null,
      finishedAt: g.finishedAt?.toISOString() ?? null,
      winnerUserId: g.winnerUserId,
      players: players.map(({ p, name }) => ({
        userId: p.userId,
        name,
        color: p.color as PlayerColor,
        token: p.token as PlayerToken,
        seat: p.seat,
        balance: p.balance,
        status: p.status,
        joinedAt: p.joinedAt.toISOString(),
        outAt: p.outAt?.toISOString() ?? null,
      })),
      transactions: txs.map((t) => ({
        id: t.id,
        kind: t.kind as GameSnapshot['transactions'][number]['kind'],
        actorUserId: t.actorUserId,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amount: t.amount,
        reversesTxId: t.reversesTxId,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async isMember(gameId: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ userId: gamePlayers.userId })
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)))
      .limit(1);
    return rows.length > 0;
  }

  async view(userId: string, ref: string): Promise<ViewResult> {
    const g = await this.resolve(ref);
    if (await this.isMember(g.id, userId)) return { kind: 'member', game: await this.snapshot(g.id) };
    if (g.status === 'active') throw new AppError('game_started');
    if (g.status === 'finished') throw new AppError('game_not_found');
    const [host] = await this.db.select({ name: users.name }).from(users).where(eq(users.id, g.hostUserId));
    const [{ n } = { n: 0 }] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, g.id));
    return {
      kind: 'preview',
      preview: {
        code: g.code,
        status: g.status,
        hostName: host?.name ?? '',
        playerCount: n,
        maxPlayers: MAX_PLAYERS,
        startingCapital: g.startingCapital,
        salary: g.salary,
        currency: g.currency as Currency,
      },
    };
  }

  // ---------- writes ----------

  async create(userId: string, input: CreateGameInput): Promise<MutationResult> {
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const gameId = await this.db.transaction(async (tx) => {
          const [g] = await tx
            .insert(games)
            .values({
              code: generateGameCode(),
              hostUserId: userId,
              startingCapital: input.startingCapital,
              salary: input.salary,
              currency: input.currency,
              freeParkingEnabled: input.freeParkingEnabled,
              turnsEnabled: input.turnsEnabled,
            })
            .returning({ id: games.id });
          await tx.insert(gamePlayers).values({
            gameId: g!.id,
            userId,
            seat: 0,
            color: pickFree(PLAYER_COLORS, new Set()),
            token: pickFree(PLAYER_TOKENS, new Set()),
            balance: input.startingCapital,
          });
          return g!.id;
        });
        return { gameId, deleted: false, removed: [] };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new AppError('internal');
  }

  async join(userId: string, ref: string): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      if (players.some((p) => p.userId === userId)) return 'unchanged';
      if (g.status !== 'lobby') throw new AppError('game_started');
      if (players.length >= MAX_PLAYERS) throw new AppError('game_full');
      const color = pickFree(PLAYER_COLORS, new Set(players.map((p) => p.color)));
      const token = pickFree(PLAYER_TOKENS, new Set(players.map((p) => p.token)));
      const seat = players.reduce((m, p) => Math.max(m, p.seat), -1) + 1;
      await tx.insert(gamePlayers).values({ gameId: g.id, userId, seat, color, token, balance: g.startingCapital });
    });
  }

  async start(userId: string, ref: string): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      if (g.hostUserId !== userId) throw new AppError('not_host');
      if (g.status !== 'lobby') throw new AppError('game_not_in_lobby');
      if (players.length < MIN_PLAYERS_TO_START) throw new AppError('not_enough_players');
      const turns = g.turnsEnabled ? { round: 1, turnUserId: firstTurn(players) } : {};
      await tx.update(games).set({ status: 'active', startedAt: new Date(), ...turns }).where(eq(games.id, g.id));
      if (g.turnsEnabled) await this.recordRound(tx, g.id, 0, players);
    });
  }

  /** Picks a game piece. Each piece belongs to one player per game. */
  async setToken(userId: string, ref: string, token: PlayerToken): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      const me = players.find((p) => p.userId === userId);
      if (!me) throw new AppError('not_a_player');
      if (g.status === 'finished') throw new AppError('game_not_active');
      if (me.token === token) return 'unchanged';
      if (players.some((p) => p.userId !== userId && p.token === token)) throw new AppError('token_taken');
      await tx
        .update(gamePlayers)
        .set({ token })
        .where(and(eq(gamePlayers.gameId, g.id), eq(gamePlayers.userId, userId)));
    });
  }

  /**
   * Ends the current turn. The player whose turn it is ends their own; the host can skip anyone.
   * When play goes back round to the first seat the round closes and its balances are kept.
   */
  async turn(userId: string, ref: string, req: TurnRequest): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      if (!players.some((p) => p.userId === userId)) throw new AppError('not_a_player');
      if (g.status !== 'active') throw new AppError('game_not_active');
      if (!g.turnsEnabled) throw new AppError('turns_disabled');
      // the turn already moved on (double tap, retry, or someone else ended it): nothing to do
      if (g.turnUserId !== req.userId) return 'unchanged';
      if (userId !== req.userId) {
        if (req.kind === 'end') throw new AppError('not_your_turn');
        if (g.hostUserId !== userId) throw new AppError('not_host');
      }
      const next = await this.advanceTurn(tx, g, players);
      await tx.update(games).set(next).where(eq(games.id, g.id));
    });
  }

  async act(userId: string, ref: string, req: ActionRequest): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      const dup = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.gameId, g.id), eq(transactions.clientTxId, req.clientTxId)))
        .limit(1);
      if (dup.length) return 'unchanged';

      const outcome = applyAction(engineState(g, players), userId, req.action);
      await this.persist(tx, g, players, outcome, userId, req.clientTxId);
    });
  }

  /**
   * Undoes a payment by sending the money back, recorded as a new 'reversal' entry so the
   * history stays honest. Whoever made the payment can undo it for a short while; the host
   * can undo any payment. Undoing one that is already undone changes nothing.
   */
  async undo(userId: string, ref: string, txId: number): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      const me = players.find((p) => p.userId === userId);
      if (!me) throw new AppError('not_a_player');
      if (g.status !== 'active') throw new AppError('game_not_active');
      const [original] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.gameId, g.id), eq(transactions.id, txId)))
        .limit(1);
      if (!original || !REVERSIBLE_KINDS.includes(original.kind as TransactionKind)) throw new AppError('undo_unavailable');
      const [done] = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.gameId, g.id), eq(transactions.reversesTxId, txId)))
        .limit(1);
      if (done) return 'unchanged';
      const isHost = g.hostUserId === userId;
      const mine = original.actorUserId === userId && Date.now() - original.createdAt.getTime() <= UNDO_WINDOW_MS;
      if (!isHost && !mine) throw new AppError('undo_unavailable');

      const outcome = applyReversal(engineState(g, players), {
        kind: original.kind as TransactionKind,
        fromUserId: original.fromUserId,
        toUserId: original.toUserId,
        amount: original.amount,
      });
      await this.persist(tx, g, players, outcome, userId, null, { reversesTxId: original.id, note: original.note });
    });
  }

  /** Rolls one or two dice for the table; every phone shows the same result. */
  async roll(userId: string, ref: string, count: number): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      const me = players.find((p) => p.userId === userId);
      if (!me) throw new AppError('not_a_player');
      if (g.status !== 'active') throw new AppError('game_not_active');
      if (me.status !== 'active') throw new AppError('player_out');
      const dice = Array.from({ length: count }, () => randomInt(1, 7));
      const lastRoll = { seq: (g.lastRoll?.seq ?? 0) + 1, userId, dice, at: new Date().toISOString() };
      await tx.update(games).set({ lastRoll }).where(eq(games.id, g.id));
    });
  }

  /** Opens an auction. Only one runs at a time; an expired one is settled first. */
  async startAuction(userId: string, ref: string, input: StartAuctionInput): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      const me = players.find((p) => p.userId === userId);
      if (!me) throw new AppError('not_a_player');
      if (g.status !== 'active') throw new AppError('game_not_active');
      if (me.status !== 'active') throw new AppError('player_out');
      if (g.auction?.status === 'open') {
        if (Date.parse(g.auction.endsAt) > Date.now()) throw new AppError('auction_running');
        await this.closeAuction(tx, g, players);
      }
      const now = Date.now();
      const auction: StoredAuction = {
        id: randomUUID(),
        title: input.title,
        startedBy: userId,
        minBid: input.minBid,
        status: 'open',
        bids: [],
        startedAt: new Date(now).toISOString(),
        endsAt: new Date(now + AUCTION_OPEN_MS).toISOString(),
        winnerUserId: null,
        price: null,
      };
      await tx.update(games).set({ auction }).where(eq(games.id, g.id));
    });
  }

  /** A bid has to beat the current one and be affordable; it keeps the auction open a little longer. */
  async bid(userId: string, ref: string, auctionId: string, amount: number): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      const me = players.find((p) => p.userId === userId);
      if (!me) throw new AppError('not_a_player');
      const a = g.auction;
      const now = Date.now();
      if (g.status !== 'active' || !a || a.id !== auctionId || a.status !== 'open' || Date.parse(a.endsAt) <= now) {
        throw new AppError('auction_closed');
      }
      if (me.status !== 'active') throw new AppError('player_out');
      const high = highBid(a);
      // the same bid sent twice (double tap, retry) is not an error
      if (high && high.userId === userId && high.amount === amount) return 'unchanged';
      if (amount < nextBidFloor(a)) throw new AppError('bid_too_low');
      if (amount > me.balance) throw new AppError('insufficient_funds');
      const endsAt = new Date(Math.max(Date.parse(a.endsAt), now + AUCTION_BID_MS)).toISOString();
      const auction: StoredAuction = { ...a, bids: [...a.bids, { userId, amount, at: new Date(now).toISOString() }], endsAt };
      await tx.update(games).set({ auction }).where(eq(games.id, g.id));
    });
  }

  /** Whoever opened the auction, or the host, can call it off. */
  async cancelAuction(userId: string, ref: string, auctionId: string): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g) => {
      const a = g.auction;
      if (!a || a.id !== auctionId || a.status !== 'open') return 'unchanged';
      if (a.startedBy !== userId && g.hostUserId !== userId) throw new AppError('not_host');
      await tx
        .update(games)
        .set({ auction: { ...a, status: 'cancelled', endsAt: new Date().toISOString() } })
        .where(eq(games.id, g.id));
    });
  }

  /**
   * Ends an auction whose time is up: the winner pays the bank. Safe to call any number of
   * times and by anyone; the server timer and every phone at the table may all ask.
   */
  async settleAuction(ref: string, auctionId?: string): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      const a = g.auction;
      if (!a || a.status !== 'open' || (auctionId && a.id !== auctionId)) return 'unchanged';
      if (g.status === 'active' && Date.parse(a.endsAt) > Date.now()) return 'unchanged';
      await this.closeAuction(tx, g, players);
    });
  }

  /** When an open auction should be settled, in ms from now; null if none is open. */
  async auctionDueIn(gameId: string): Promise<number | null> {
    const [g] = await this.db.select({ auction: games.auction }).from(games).where(eq(games.id, gameId)).limit(1);
    if (!g?.auction || g.auction.status !== 'open') return null;
    return Math.max(0, Date.parse(g.auction.endsAt) - Date.now());
  }

  async leave(userId: string, ref: string): Promise<MutationResult> {
    const target = await this.resolve(ref);
    let deleted = false;
    const result = await this.mutate(target.id, async (tx, g, players) => {
      const me = players.find((p) => p.userId === userId);
      if (!me) return 'unchanged';

      if (g.status === 'lobby') {
        const rest = players.filter((p) => p.userId !== userId);
        if (rest.length === 0) {
          await tx.delete(games).where(eq(games.id, g.id));
          deleted = true;
          return 'deleted';
        }
        await tx.delete(gamePlayers).where(and(eq(gamePlayers.gameId, g.id), eq(gamePlayers.userId, userId)));
        if (g.hostUserId === userId) {
          await tx.update(games).set({ hostUserId: rest[0]!.userId }).where(eq(games.id, g.id));
        }
        return;
      }

      if (g.status === 'finished' || me.status !== 'active') return 'unchanged';
      await this.persist(tx, g, players, applyLeave(engineState(g, players), userId), userId, null);
      if (g.hostUserId === userId) await this.handOverHost(tx, g.id, userId);
    });
    return { ...result, deleted };
  }

  async kick(hostId: string, ref: string, targetId: string): Promise<MutationResult> {
    if (hostId === targetId) throw new AppError('cannot_kick_self');
    const target = await this.resolve(ref);
    const result = await this.mutate(target.id, async (tx, g, players) => {
      if (g.hostUserId !== hostId) throw new AppError('not_host');
      const victim = players.find((p) => p.userId === targetId);
      if (!victim) throw new AppError('invalid_target');
      if (g.status === 'lobby') {
        await tx.delete(gamePlayers).where(and(eq(gamePlayers.gameId, g.id), eq(gamePlayers.userId, targetId)));
        return;
      }
      if (g.status === 'finished' || victim.status !== 'active') throw new AppError('invalid_target');
      await this.persist(tx, g, players, applyLeave(engineState(g, players), targetId), hostId, null);
    });
    return { ...result, removed: [{ userId: targetId, reason: 'kicked' }] };
  }

  /** Host ends a running game; the richest remaining player wins. */
  async finish(hostId: string, ref: string): Promise<MutationResult> {
    const target = await this.resolve(ref);
    return this.mutate(target.id, async (tx, g, players) => {
      if (g.hostUserId !== hostId) throw new AppError('not_host');
      if (g.status !== 'active') throw new AppError('game_not_active');
      const ranked = players.filter((p) => p.status === 'active').sort((a, b) => b.balance - a.balance);
      const top = ranked[0];
      const tie = ranked[1] && top && ranked[1].balance === top.balance;
      if (g.turnsEnabled) await this.recordRound(tx, g.id, g.round, players);
      await tx
        .update(games)
        .set({
          status: 'finished',
          finishedAt: new Date(),
          winnerUserId: top && !tie ? top.userId : null,
          turnUserId: null,
          ...(g.auction?.status === 'open' ? { auction: { ...g.auction, status: 'cancelled' as const } } : {}),
        })
        .where(eq(games.id, g.id));
    });
  }

  /** Host cancels a lobby. Running games are finished instead, so history is kept. */
  async disband(hostId: string, ref: string): Promise<MutationResult> {
    const target = await this.resolve(ref);
    let memberIds: string[] = [];
    const result = await this.mutate(target.id, async (tx, g, players) => {
      if (g.hostUserId !== hostId) throw new AppError('not_host');
      if (g.status !== 'lobby') throw new AppError('game_not_in_lobby');
      memberIds = players.map((p) => p.userId).filter((id) => id !== hostId);
      await tx.delete(games).where(eq(games.id, g.id));
      return 'deleted';
    });
    return { ...result, deleted: true, removed: memberIds.map((userId) => ({ userId, reason: 'disbanded' })) };
  }

  async myGames(userId: string): Promise<MyGamesResponse> {
    const rows = await this.db
      .select({ g: games, me: gamePlayers })
      .from(gamePlayers)
      .innerJoin(games, eq(games.id, gamePlayers.gameId))
      .where(eq(gamePlayers.userId, userId))
      .orderBy(desc(games.createdAt))
      .limit(60);

    const ongoingRows = rows.filter((r) => r.g.status !== 'finished' && r.me.status !== 'left');
    const finishedRows = rows.filter((r) => r.g.status === 'finished').slice(0, 20);
    const listed = [...ongoingRows, ...finishedRows];

    const ids = listed.map((r) => r.g.id);
    const counts = new Map<string, number>();
    const names = new Map<string, string>();
    if (ids.length) {
      const all = await this.db
        .select({ gameId: gamePlayers.gameId, userId: gamePlayers.userId, name: users.name })
        .from(gamePlayers)
        .innerJoin(users, eq(users.id, gamePlayers.userId))
        .where(inArray(gamePlayers.gameId, ids));
      for (const p of all) {
        counts.set(p.gameId, (counts.get(p.gameId) ?? 0) + 1);
        names.set(`${p.gameId}:${p.userId}`, p.name);
      }
    }

    const summary = ({ g, me }: (typeof rows)[number]): GameSummary => ({
      ref: g.status === 'finished' ? g.id : g.code,
      code: g.code,
      status: g.status,
      currency: g.currency as Currency,
      startedAt: g.startedAt?.toISOString() ?? null,
      finishedAt: g.finishedAt?.toISOString() ?? null,
      winnerName: g.winnerUserId ? (names.get(`${g.id}:${g.winnerUserId}`) ?? null) : null,
      wonByMe: g.winnerUserId === userId,
      playerCount: counts.get(g.id) ?? 0,
      myBalance: me.balance,
      myStatus: me.status,
      myColor: me.color as PlayerColor,
      myToken: me.token as PlayerToken,
      round: g.turnsEnabled ? g.round : 0,
      turnName:
        g.status === 'active' && g.turnUserId && g.turnUserId !== userId
          ? (names.get(`${g.id}:${g.turnUserId}`) ?? null)
          : null,
      myTurn: g.status === 'active' && g.turnUserId === userId,
      settings: { startingCapital: g.startingCapital, salary: g.salary, freeParkingEnabled: g.freeParkingEnabled, turnsEnabled: g.turnsEnabled },
    });

    const [stats] = await this.db
      .select({
        played: sql<number>`count(*)::int`,
        won: sql<number>`count(*) filter (where ${games.winnerUserId} = ${userId})::int`,
        playMs: sql<number>`coalesce(sum(extract(epoch from (${games.finishedAt} - ${games.startedAt})) * 1000), 0)::float8`,
      })
      .from(gamePlayers)
      .innerJoin(games, eq(games.id, gamePlayers.gameId))
      .where(and(eq(gamePlayers.userId, userId), eq(games.status, 'finished'), sql`${games.startedAt} is not null`));

    return {
      ongoing: ongoingRows.map(summary),
      finished: finishedRows.map(summary),
      stats: { played: stats?.played ?? 0, won: stats?.won ?? 0, playMs: Math.round(Number(stats?.playMs ?? 0)) },
    };
  }

  /** Removes lobbies nobody started within a day. */
  async pruneStaleLobbies(): Promise<number> {
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const deleted = await this.db
      .delete(games)
      .where(and(eq(games.status, 'lobby'), lt(games.createdAt, cutoff)))
      .returning({ id: games.id });
    return deleted.length;
  }

  // ---------- internals ----------

  /**
   * Runs `fn` with the game row locked (SELECT … FOR UPDATE) so concurrent
   * requests for the same game are applied one after another.
   */
  private async mutate(
    gameId: string,
    fn: (tx: Tx, g: GameRow, players: PlayerRow[]) => Promise<void | 'unchanged' | 'deleted'>,
  ): Promise<MutationResult> {
    await this.db.transaction(async (tx) => {
      const [g] = await tx.select().from(games).where(eq(games.id, gameId)).for('update');
      if (!g) throw new AppError('game_not_found');
      const players = await tx
        .select()
        .from(gamePlayers)
        .where(eq(gamePlayers.gameId, gameId))
        .orderBy(asc(gamePlayers.seat));
      const outcome = await fn(tx, g, players);
      if (outcome === undefined) {
        await tx
          .update(games)
          .set({ version: sql`${games.version} + 1` })
          .where(eq(games.id, gameId));
      }
    });
    return { gameId, deleted: false, removed: [] };
  }

  private async persist(
    tx: Tx,
    g: GameRow,
    before: PlayerRow[],
    outcome: EngineOutcome,
    actorUserId: string,
    clientTxId: string | null,
    extra: { reversesTxId?: number; note?: string | null; kind?: EngineResult['tx']['kind'] } = {},
  ): Promise<EngineResult> {
    if (!outcome.ok) throw new AppError(outcome.error);
    const { result } = outcome;
    const now = new Date();

    const after: PlayerRow[] = before.map((prev) => {
      const next = result.players.find((p) => p.userId === prev.userId);
      if (!next) return prev;
      const outAt = prev.status === 'active' && next.status !== 'active' ? now : prev.outAt;
      return { ...prev, balance: next.balance, status: next.status, outAt };
    });
    for (const [i, next] of after.entries()) {
      const prev = before[i]!;
      if (prev.balance === next.balance && prev.status === next.status) continue;
      await tx
        .update(gamePlayers)
        .set({ balance: next.balance, status: next.status, outAt: next.outAt })
        .where(and(eq(gamePlayers.gameId, g.id), eq(gamePlayers.userId, next.userId)));
    }

    // turns: the last round is kept when the game ends; the turn moves on if its player went out
    let turn: Partial<GameRow> = {};
    if (g.turnsEnabled && g.status === 'active') {
      if (result.finished) {
        await this.recordRound(tx, g.id, g.round, after);
        turn = { turnUserId: null };
      } else if (after.find((p) => p.userId === g.turnUserId)?.status !== 'active') {
        turn = await this.advanceTurn(tx, g, after);
      }
    }

    await tx.insert(transactions).values({
      gameId: g.id,
      clientTxId,
      kind: extra.kind ?? result.tx.kind,
      reversesTxId: extra.reversesTxId ?? null,
      note: extra.note ?? null,
      actorUserId,
      fromUserId: result.tx.fromUserId,
      toUserId: result.tx.toUserId,
      amount: result.tx.amount,
    });

    await tx
      .update(games)
      .set({
        freeParkingPot: result.freeParkingPot,
        ...turn,
        ...(result.finished
          ? { status: 'finished' as const, finishedAt: now, winnerUserId: result.finished.winnerUserId }
          : {}),
      })
      .where(eq(games.id, g.id));
    return result;
  }

  /** Sells an open auction to the best bid that can still pay, or closes it unsold. */
  private async closeAuction(tx: Tx, g: GameRow, players: PlayerRow[]): Promise<void> {
    const a = g.auction!;
    const winner = g.status === 'active' ? pickWinner(a, engineState(g, players).players) : null;
    if (!winner) {
      const status = g.status === 'active' ? 'unsold' : 'cancelled';
      await tx.update(games).set({ auction: { ...a, status } }).where(eq(games.id, g.id));
      return;
    }
    const outcome = applyAction(engineState(g, players), winner.userId, { kind: 'player_to_bank', amount: winner.amount });
    // persist writes the game row too, so the sold auction goes in first and persist keeps it
    await tx
      .update(games)
      .set({ auction: { ...a, status: 'sold', winnerUserId: winner.userId, price: winner.amount } })
      .where(eq(games.id, g.id));
    await this.persist(tx, g, players, outcome, winner.userId, null, { kind: 'auction', note: a.title || null });
  }

  /** Moves the turn to the next player still in; closes the round when play wraps round. */
  private async advanceTurn(tx: Tx, g: GameRow, players: PlayerRow[]): Promise<Partial<GameRow>> {
    const next = nextTurn(players, g.turnUserId);
    if (!next.wrapped) return { turnUserId: next.userId };
    await this.recordRound(tx, g.id, g.round, players);
    return { turnUserId: next.userId, round: g.round + 1 };
  }

  /**
   * Keeps everyone's balance at the end of a round. Players who are out are written once more
   * (with what they ended on) in the round they went out, then left off, so their line stops there.
   */
  private async recordRound(tx: Tx, gameId: string, round: number, players: PlayerRow[]): Promise<void> {
    const [prev] = await tx
      .select({ createdAt: gameRounds.createdAt })
      .from(gameRounds)
      .where(and(eq(gameRounds.gameId, gameId), lt(gameRounds.round, round)))
      .orderBy(desc(gameRounds.round))
      .limit(1);
    const balances: Record<string, number> = {};
    for (const p of players) {
      const wentOutThisRound = p.outAt !== null && (!prev || p.outAt > prev.createdAt);
      if (p.status === 'active' || wentOutThisRound) balances[p.userId] = p.balance;
    }
    // stamped from the app clock, like outAt, so the two compare correctly
    const createdAt = new Date();
    await tx
      .insert(gameRounds)
      .values({ gameId, round, balances, createdAt })
      .onConflictDoUpdate({ target: [gameRounds.gameId, gameRounds.round], set: { balances, createdAt } });
  }

  private async handOverHost(tx: Tx, gameId: string, leavingUserId: string): Promise<void> {
    const [next] = await tx
      .select({ userId: gamePlayers.userId })
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.status, 'active')))
      .orderBy(asc(gamePlayers.seat))
      .limit(1);
    if (next && next.userId !== leavingUserId) {
      await tx.update(games).set({ hostUserId: next.userId }).where(eq(games.id, gameId));
    }
  }
}

function engineState(g: GameRow, players: PlayerRow[]) {
  return {
    status: g.status,
    salary: g.salary,
    freeParkingEnabled: g.freeParkingEnabled,
    freeParkingPot: g.freeParkingPot,
    players: players.map((p): EnginePlayer => ({ userId: p.userId, balance: p.balance, status: p.status })),
  };
}
