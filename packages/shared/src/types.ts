import type { Currency, ErrorCode, PlayerColor, PlayerToken } from './constants';

export type UserKind = 'guest' | 'google';

export interface Me {
  id: string;
  name: string;
  kind: UserKind;
  email: string | null;
}

export type GameStatus = 'lobby' | 'active' | 'finished';
export type PlayerStatus = 'active' | 'bankrupt' | 'left';

export const PLAYER_ACTION_KINDS = [
  'bank_to_player',
  'player_to_bank',
  'player_to_player',
  'salary',
  'player_to_parking',
  'parking_to_player',
] as const;
export type PlayerActionKind = (typeof PLAYER_ACTION_KINDS)[number];

export type TransactionKind = PlayerActionKind | 'bankruptcy' | 'leave';

export interface PlayerView {
  userId: string;
  name: string;
  color: PlayerColor;
  token: PlayerToken;
  seat: number;
  balance: number;
  status: PlayerStatus;
  joinedAt: string;
  outAt: string | null;
}

/**
 * Balances at the end of a round, by user id. Round 0 is the start of the game.
 * A player who went out appears once more with their final balance, then no longer.
 */
export interface RoundRecord {
  round: number;
  balances: Record<string, number>;
}

export interface TransactionView {
  id: number;
  kind: TransactionKind;
  actorUserId: string;
  fromUserId: string | null;
  toUserId: string | null;
  amount: number;
  createdAt: string;
}

export interface GameSnapshot {
  id: string;
  code: string;
  status: GameStatus;
  hostUserId: string;
  startingCapital: number;
  salary: number;
  currency: Currency;
  freeParkingEnabled: boolean;
  freeParkingPot: number;
  /** Players take turns in seat order; a round ends when everyone still in has played. */
  turnsEnabled: boolean;
  /** Current round, from 1. 0 before the game starts or when turns are off. */
  round: number;
  /** Whose turn it is; null when turns are off or the game isn't running. */
  turnUserId: string | null;
  /** Oldest first. Drives the balance chart. */
  rounds: RoundRecord[];
  version: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  winnerUserId: string | null;
  players: PlayerView[];
  /** Newest first. */
  transactions: TransactionView[];
}

/** What a non-member can see before joining a lobby. */
export interface GamePreview {
  code: string;
  status: GameStatus;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  startingCapital: number;
  salary: number;
  currency: Currency;
}

export interface GameSummary {
  /** Link target: the join code while open, the game id once finished. */
  ref: string;
  code: string;
  status: GameStatus;
  currency: Currency;
  startedAt: string | null;
  finishedAt: string | null;
  winnerName: string | null;
  wonByMe: boolean;
  playerCount: number;
  myBalance: number;
  myStatus: PlayerStatus;
  myColor: PlayerColor;
  myToken: PlayerToken;
  /** 0 when turns are off. */
  round: number;
  /** Null when it's my turn, when turns are off or the game isn't running. */
  turnName: string | null;
  myTurn: boolean;
}

export interface MyGamesResponse {
  ongoing: GameSummary[];
  finished: GameSummary[];
  stats: { played: number; won: number; playMs: number };
}

export interface ApiError {
  error: ErrorCode;
}

export type ClientMessage = { type: 'subscribe'; code: string } | { type: 'ping' };

export type ServerMessage =
  | { type: 'snapshot'; game: GameSnapshot }
  | { type: 'removed'; code: string; reason: 'kicked' | 'disbanded' }
  | { type: 'error'; error: ErrorCode }
  | { type: 'pong' };
