import type { ErrorCode } from './constants';
import type { GameAction } from './schemas';
import type { GameStatus, PlayerStatus, TransactionKind } from './types';

/**
 * Pure money rules. The server runs these inside a locked DB transaction;
 * the client runs the same rules to validate input before sending.
 */
export interface EnginePlayer {
  userId: string;
  balance: number;
  status: PlayerStatus;
}

export interface EngineState {
  status: GameStatus;
  salary: number;
  freeParkingEnabled: boolean;
  freeParkingPot: number;
  players: EnginePlayer[];
}

export interface EngineTx {
  kind: TransactionKind;
  fromUserId: string | null;
  toUserId: string | null;
  amount: number;
}

export interface EngineResult {
  players: EnginePlayer[];
  freeParkingPot: number;
  tx: EngineTx;
  /** Set when this change ends the game. */
  finished: { winnerUserId: string | null } | null;
}

export type EngineOutcome = { ok: true; result: EngineResult } | { ok: false; error: ErrorCode };

const fail = (error: ErrorCode): EngineOutcome => ({ ok: false, error });

function credit(players: EnginePlayer[], userId: string, amount: number): EnginePlayer[] {
  return players.map((p) => (p.userId === userId ? { ...p, balance: p.balance + amount } : p));
}

/** A game ends when at most one player is still in. */
export function checkFinished(players: EnginePlayer[]): EngineResult['finished'] {
  const stillIn = players.filter((p) => p.status === 'active');
  if (players.length >= 2 && stillIn.length <= 1) {
    return { winnerUserId: stillIn[0]?.userId ?? null };
  }
  return null;
}

export function applyAction(state: EngineState, actorUserId: string, action: GameAction): EngineOutcome {
  if (state.status !== 'active') return fail('game_not_active');
  const actor = state.players.find((p) => p.userId === actorUserId);
  if (!actor) return fail('not_a_player');
  if (actor.status !== 'active') return fail('player_out');

  let players = state.players;
  let pot = state.freeParkingPot;
  let tx: EngineTx;

  const debitActor = (amount: number): ErrorCode | null => {
    if (amount > actor.balance) return 'insufficient_funds';
    players = credit(players, actorUserId, -amount);
    return null;
  };

  switch (action.kind) {
    case 'bank_to_player':
      players = credit(players, actorUserId, action.amount);
      tx = { kind: action.kind, fromUserId: null, toUserId: actorUserId, amount: action.amount };
      break;
    case 'salary':
      if (state.salary <= 0) return fail('invalid_amount');
      players = credit(players, actorUserId, state.salary);
      tx = { kind: action.kind, fromUserId: null, toUserId: actorUserId, amount: state.salary };
      break;
    case 'player_to_bank': {
      const err = debitActor(action.amount);
      if (err) return fail(err);
      tx = { kind: action.kind, fromUserId: actorUserId, toUserId: null, amount: action.amount };
      break;
    }
    case 'player_to_player': {
      const target = state.players.find((p) => p.userId === action.toUserId);
      if (!target || target.userId === actorUserId || target.status !== 'active') return fail('invalid_target');
      const err = debitActor(action.amount);
      if (err) return fail(err);
      players = credit(players, target.userId, action.amount);
      tx = { kind: action.kind, fromUserId: actorUserId, toUserId: target.userId, amount: action.amount };
      break;
    }
    case 'player_to_parking': {
      if (!state.freeParkingEnabled) return fail('parking_disabled');
      const err = debitActor(action.amount);
      if (err) return fail(err);
      pot += action.amount;
      tx = { kind: action.kind, fromUserId: actorUserId, toUserId: null, amount: action.amount };
      break;
    }
    case 'parking_to_player':
      if (!state.freeParkingEnabled) return fail('parking_disabled');
      if (pot <= 0) return fail('parking_empty');
      players = credit(players, actorUserId, pot);
      tx = { kind: action.kind, fromUserId: null, toUserId: actorUserId, amount: pot };
      pot = 0;
      break;
    case 'bankruptcy': {
      const creditorId = action.creditorUserId;
      if (creditorId !== null) {
        const creditor = state.players.find((p) => p.userId === creditorId);
        if (!creditor || creditor.userId === actorUserId || creditor.status !== 'active') {
          return fail('invalid_target');
        }
      }
      const remaining = actor.balance;
      players = players.map((p) =>
        p.userId === actorUserId ? { ...p, balance: 0, status: 'bankrupt' as const } : p,
      );
      if (creditorId !== null && remaining > 0) players = credit(players, creditorId, remaining);
      tx = { kind: 'bankruptcy', fromUserId: actorUserId, toUserId: creditorId, amount: remaining };
      break;
    }
  }

  return { ok: true, result: { players, freeParkingPot: pot, tx, finished: checkFinished(players) } };
}

// ---------- turns ----------

export interface TurnPlayer {
  userId: string;
  seat: number;
  status: PlayerStatus;
}

/**
 * Who plays after `fromUserId`: the next player still in, in seat order.
 * `wrapped` is true when play goes back round to the first seat, which closes a round.
 * `fromUserId` may belong to a player who just went out; their seat still marks the place.
 */
export function nextTurn(players: TurnPlayer[], fromUserId: string | null): { userId: string | null; wrapped: boolean } {
  const active = players.filter((p) => p.status === 'active').sort((a, b) => a.seat - b.seat);
  if (active.length === 0) return { userId: null, wrapped: false };
  const from = players.find((p) => p.userId === fromUserId);
  if (!from) return { userId: active[0]!.userId, wrapped: false };
  const after = active.find((p) => p.seat > from.seat);
  return after ? { userId: after.userId, wrapped: false } : { userId: active[0]!.userId, wrapped: true };
}

/** The first player to move: the lowest seat still in. */
export function firstTurn(players: TurnPlayer[]): string | null {
  return nextTurn(players, null).userId;
}

/** A player leaves (or is removed from) a running game: their money returns to the bank. */
export function applyLeave(state: EngineState, userId: string): EngineOutcome {
  const player = state.players.find((p) => p.userId === userId);
  if (!player) return fail('not_a_player');
  const players = state.players.map((p) =>
    p.userId === userId ? { ...p, balance: 0, status: p.status === 'active' ? ('left' as const) : p.status } : p,
  );
  return {
    ok: true,
    result: {
      players,
      freeParkingPot: state.freeParkingPot,
      tx: { kind: 'leave', fromUserId: userId, toUserId: null, amount: player.balance },
      finished: state.status === 'active' ? checkFinished(players) : null,
    },
  };
}
