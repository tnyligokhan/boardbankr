import { describe, expect, it } from 'vitest';
import { applyAction, applyLeave, firstTurn, nextTurn, type EngineState } from './engine';

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
