import { describe, expect, it } from 'vitest';
import { applyAction, applyLeave, firstTurn, nextTurn, type EngineState } from './engine';
import { applyReversal, canUndo, nextBidFloor, pickWinner, reversedIds } from './extras';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

function state(overrides: Partial<EngineState> = {}): EngineState {
  return {
    status: 'active',
    salary: 200,
    freeParkingEnabled: true,
    freeParkingPot: 0,
    players: [
      { userId: A, balance: 1500, status: 'active' },
      { userId: B, balance: 1500, status: 'active' },
      { userId: C, balance: 1500, status: 'active' },
    ],
    ...overrides,
  };
}

const bal = (s: { players: { userId: string; balance: number }[] }, id: string) =>
  s.players.find((p) => p.userId === id)!.balance;

describe('applyAction', () => {
  it('pays another player', () => {
    const out = applyAction(state(), A, { kind: 'player_to_player', toUserId: B, amount: 300 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(bal(out.result, A)).toBe(1200);
    expect(bal(out.result, B)).toBe(1800);
    expect(out.result.finished).toBeNull();
  });

  it('rejects overspending', () => {
    const out = applyAction(state(), A, { kind: 'player_to_bank', amount: 1501 });
    expect(out).toEqual({ ok: false, error: 'insufficient_funds' });
  });

  it('allows paying the whole balance without going bankrupt', () => {
    const out = applyAction(state(), A, { kind: 'player_to_bank', amount: 1500 });
    expect(out.ok && out.result.players.find((p) => p.userId === A)!.status).toBe('active');
  });

  it('pays salary from the game setting', () => {
    const out = applyAction(state(), A, { kind: 'salary' });
    expect(out.ok && bal(out.result, A)).toBe(1700);
  });

  it('collects the whole free parking pot', () => {
    const paid = applyAction(state(), A, { kind: 'player_to_parking', amount: 100 });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    const next = { ...state(), players: paid.result.players, freeParkingPot: paid.result.freeParkingPot };
    const took = applyAction(next, B, { kind: 'parking_to_player' });
    expect(took.ok).toBe(true);
    if (!took.ok) return;
    expect(took.result.tx.amount).toBe(100);
    expect(took.result.freeParkingPot).toBe(0);
    expect(bal(took.result, B)).toBe(1600);
  });

  it('refuses parking actions when disabled or empty', () => {
    expect(applyAction(state({ freeParkingEnabled: false }), A, { kind: 'parking_to_player' })).toEqual({
      ok: false,
      error: 'parking_disabled',
    });
    expect(applyAction(state(), A, { kind: 'parking_to_player' })).toEqual({ ok: false, error: 'parking_empty' });
  });

  it('cannot pay yourself or an out player', () => {
    expect(applyAction(state(), A, { kind: 'player_to_player', toUserId: A, amount: 1 })).toEqual({
      ok: false,
      error: 'invalid_target',
    });
    const s = state();
    s.players[1]!.status = 'bankrupt';
    expect(applyAction(s, A, { kind: 'player_to_player', toUserId: B, amount: 1 })).toEqual({
      ok: false,
      error: 'invalid_target',
    });
  });

  it('bankruptcy hands remaining money to the creditor and can end the game', () => {
    const two = state({ players: state().players.slice(0, 2) });
    const out = applyAction(two, A, { kind: 'bankruptcy', creditorUserId: B });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(bal(out.result, B)).toBe(3000);
    expect(out.result.finished).toEqual({ winnerUserId: B });
  });

  it('out players cannot act', () => {
    const s = state();
    s.players[0]!.status = 'bankrupt';
    expect(applyAction(s, A, { kind: 'salary' })).toEqual({ ok: false, error: 'player_out' });
  });

  it('only works in an active game', () => {
    expect(applyAction(state({ status: 'lobby' }), A, { kind: 'salary' })).toEqual({
      ok: false,
      error: 'game_not_active',
    });
  });
});

describe('applyLeave', () => {
  it('returns money to the bank and finishes when one player remains', () => {
    const two = state({ players: state().players.slice(0, 2) });
    const out = applyLeave(two, A);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.tx).toEqual({ kind: 'leave', fromUserId: A, toUserId: null, amount: 1500 });
    expect(out.result.finished).toEqual({ winnerUserId: B });
  });
});

describe('nextTurn', () => {
  const D = '00000000-0000-4000-8000-00000000000d';
  const seats = (statuses: Record<string, 'active' | 'bankrupt' | 'left'> = {}) =>
    [A, B, C, D].map((userId, seat) => ({ userId, seat, status: statuses[userId] ?? ('active' as const) }));

  it('starts with the lowest seat still in', () => {
    expect(firstTurn(seats())).toBe(A);
    expect(firstTurn(seats({ [A]: 'left' }))).toBe(B);
  });

  it('moves to the next seat and wraps at the end of a round', () => {
    expect(nextTurn(seats(), A)).toEqual({ userId: B, wrapped: false });
    expect(nextTurn(seats(), D)).toEqual({ userId: A, wrapped: true });
  });

  it('skips players who are out', () => {
    expect(nextTurn(seats({ [B]: 'bankrupt', [C]: 'left' }), A)).toEqual({ userId: D, wrapped: false });
    expect(nextTurn(seats({ [A]: 'bankrupt' }), D)).toEqual({ userId: B, wrapped: true });
  });

  it('continues from the seat of a player who just went out', () => {
    expect(nextTurn(seats({ [B]: 'bankrupt' }), B)).toEqual({ userId: C, wrapped: false });
    expect(nextTurn(seats({ [D]: 'left' }), D)).toEqual({ userId: A, wrapped: true });
  });

  it('has nobody to move to when everyone is out', () => {
    expect(nextTurn(seats({ [A]: 'left', [B]: 'left', [C]: 'left', [D]: 'left' }), A)).toEqual({ userId: null, wrapped: false });
  });
});

describe('applyReversal', () => {
  it('sends a transfer back', () => {
    const out = applyReversal(state(), { kind: 'player_to_player', fromUserId: A, toUserId: B, amount: 300 });
    expect(out.ok && bal(out.result, A)).toBe(1800);
    expect(out.ok && bal(out.result, B)).toBe(1200);
    expect(out.ok && out.result.tx).toEqual({ kind: 'reversal', fromUserId: B, toUserId: A, amount: 300 });
  });

  it('moves money back out of and into the parking pot', () => {
    const toPot = applyReversal(state({ freeParkingPot: 100 }), { kind: 'player_to_parking', fromUserId: A, toUserId: null, amount: 100 });
    expect(toPot.ok && toPot.result.freeParkingPot).toBe(0);
    expect(toPot.ok && bal(toPot.result, A)).toBe(1600);
    const spent = applyReversal(state({ freeParkingPot: 40 }), { kind: 'player_to_parking', fromUserId: A, toUserId: null, amount: 100 });
    expect(spent).toEqual({ ok: false, error: 'undo_insufficient' });
    const fromPot = applyReversal(state(), { kind: 'parking_to_player', fromUserId: null, toUserId: A, amount: 250 });
    expect(fromPot.ok && fromPot.result.freeParkingPot).toBe(250);
  });

  it('refuses when the receiver is short or out', () => {
    expect(applyReversal(state(), { kind: 'bank_to_player', fromUserId: null, toUserId: A, amount: 2000 })).toEqual({ ok: false, error: 'undo_insufficient' });
    const out = state({ players: [{ userId: A, balance: 0, status: 'bankrupt' }, { userId: B, balance: 1500, status: 'active' }] });
    expect(applyReversal(out, { kind: 'player_to_player', fromUserId: A, toUserId: B, amount: 10 })).toEqual({ ok: false, error: 'undo_unavailable' });
    expect(applyReversal(state(), { kind: 'bankruptcy', fromUserId: A, toUserId: null, amount: 10 })).toEqual({ ok: false, error: 'undo_unavailable' });
  });

  it('knows who may undo what', () => {
    const tx = { id: 7, kind: 'player_to_player' as const, actorUserId: A, createdAt: new Date(1_000_000).toISOString() };
    const opts = { userId: A, isHost: false, now: 1_000_000 + 60_000, reversed: new Set<number>() };
    expect(canUndo(tx, opts)).toBe(true);
    expect(canUndo(tx, { ...opts, now: 1_000_000 + 5 * 60_000 })).toBe(false);
    expect(canUndo(tx, { ...opts, now: 1_000_000 + 5 * 60_000, isHost: true })).toBe(true);
    expect(canUndo(tx, { ...opts, userId: B })).toBe(false);
    expect(canUndo(tx, { ...opts, reversed: reversedIds([{ kind: 'reversal', reversesTxId: 7 }]) })).toBe(false);
  });
});

describe('auction rules', () => {
  const bids = [
    { userId: A, amount: 100, at: '' },
    { userId: B, amount: 900, at: '' },
  ];
  it('needs more than the last bid, and at least the starting price', () => {
    expect(nextBidFloor({ bids: [], minBid: 0 })).toBe(1);
    expect(nextBidFloor({ bids: [], minBid: 50 })).toBe(50);
    expect(nextBidFloor({ bids, minBid: 50 })).toBe(901);
  });
  it('sells to the best bid that can still pay', () => {
    expect(pickWinner({ bids }, state().players)?.userId).toBe(B);
    const poor = state({ players: [{ userId: A, balance: 1500, status: 'active' }, { userId: B, balance: 300, status: 'active' }] });
    expect(pickWinner({ bids }, poor.players)?.userId).toBe(A);
    expect(pickWinner({ bids: [] }, poor.players)).toBeNull();
  });
});
