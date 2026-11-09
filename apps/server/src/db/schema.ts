import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AuctionView, DiceRoll } from '@mdb/shared';

/** An auction as stored; `remainingMs` is worked out when a snapshot is made. */
export type StoredAuction = Omit<AuctionView, 'remainingMs'>;

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['guest', 'google'] }).notNull(),
    googleSub: text('google_sub'),
    email: text('email'),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_google_sub_idx').on(t.googleSub)],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the cookie token; the raw token is never stored. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    status: text('status', { enum: ['lobby', 'active', 'finished'] }).notNull().default('lobby'),
    hostUserId: uuid('host_user_id')
      .notNull()
      .references(() => users.id),
    startingCapital: bigint('starting_capital', { mode: 'number' }).notNull(),
    salary: bigint('salary', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    freeParkingEnabled: boolean('free_parking_enabled').notNull(),
    freeParkingPot: bigint('free_parking_pot', { mode: 'number' }).notNull().default(0),
    turnsEnabled: boolean('turns_enabled').notNull().default(true),
    /** Current round from 1 once the game runs; 0 before that or when turns are off. */
    round: integer('round').notNull().default(0),
    turnUserId: uuid('turn_user_id'),
    /** The last dice roll, shown on every phone. */
    lastRoll: jsonb('last_roll').$type<DiceRoll>(),
    /** The current or most recent auction. */
    auction: jsonb('auction').$type<StoredAuction>(),
    version: integer('version').notNull().default(1),
    winnerUserId: uuid('winner_user_id').references(() => users.id),
    createdAt: createdAt(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    // A code is only reserved while its game is still open.
    uniqueIndex('games_open_code_idx').on(t.code).where(sql`status <> 'finished'`),
    index('games_code_idx').on(t.code),
  ],
);

export const gamePlayers = pgTable(
  'game_players',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seat: integer('seat').notNull(),
    color: text('color').notNull(),
    token: text('token').notNull().default('rocket'),
    balance: bigint('balance', { mode: 'number' }).notNull(),
    status: text('status', { enum: ['active', 'bankrupt', 'left'] }).notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    outAt: timestamp('out_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.userId] }), index('game_players_user_idx').on(t.userId)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    clientTxId: text('client_tx_id'),
    kind: text('kind').notNull(),
    actorUserId: uuid('actor_user_id').notNull(),
    fromUserId: uuid('from_user_id'),
    toUserId: uuid('to_user_id'),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    /** For a reversal: the payment it undid. */
    reversesTxId: bigint('reverses_tx_id', { mode: 'number' }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    // Makes client retries idempotent.
    uniqueIndex('transactions_client_tx_idx').on(t.gameId, t.clientTxId),
    // A payment can be undone once.
    uniqueIndex('transactions_reverses_idx').on(t.gameId, t.reversesTxId),
    index('transactions_game_idx').on(t.gameId, t.id),
  ],
);

/** Balances at the end of each round (round 0 = the start). Feeds the end-of-game chart. */
export const gameRounds = pgTable(
  'game_rounds',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    balances: jsonb('balances').$type<Record<string, number>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.round] })],
);
