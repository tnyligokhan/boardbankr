export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2;

export const NAME_MIN = 2;
export const NAME_MAX = 24;

/** Largest single amount: one trillion, enough for billion-scale games. Balances stay far below 2^53. */
export const AMOUNT_MAX = 1_000_000_000_000;

/** Unambiguous alphabet: no 0/O, 1/I/L. */
export const GAME_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const GAME_CODE_LENGTH = 5;

export const PLAYER_COLORS = ['rose', 'sun', 'mint', 'sky', 'lilac', 'peach', 'aqua', 'sand'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

/** Game pieces a player can pick in the lobby. Keys are stored in the database; one piece per player in a game. */
export const PLAYER_TOKENS = [
  'rocket',
  'car',
  'sailboat',
  'cat',
  'dog',
  'crown',
  'gem',
  'plane',
  'ghost',
  'anchor',
  'bird',
  'zap',
] as const;
export type PlayerToken = (typeof PLAYER_TOKENS)[number];

export const CURRENCIES = ['$', '₺', '€', '£'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const TRANSACTION_HISTORY_LIMIT = 150;

export const ERROR_CODES = [
  'unauthorized',
  'invalid_request',
  'rate_limited',
  'game_not_found',
  'not_a_player',
  'not_host',
  'game_full',
  'game_started',
  'game_not_active',
  'game_not_in_lobby',
  'not_enough_players',
  'player_out',
  'insufficient_funds',
  'invalid_amount',
  'invalid_target',
  'parking_disabled',
  'parking_empty',
  'cannot_kick_self',
  'token_taken',
  'turns_disabled',
  'not_your_turn',
  'google_disabled',
  'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const GAME_CODE_REGEX = new RegExp(`^[${GAME_CODE_ALPHABET}]{${GAME_CODE_LENGTH}}$`);

export function normalizeGameCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
