import type { ErrorCode } from './constants';
import type { EngineOutcome, EnginePlayer, EngineState } from './engine';
import type { AuctionBid, AuctionView, TransactionKind, TransactionView } from './types';

// ---------- undo ----------

/** How long whoever made a payment can undo it themselves. The host can undo at any time. */
export const UNDO_WINDOW_MS = 2 * 60 * 1000;

/** Payments that can be undone. Going bankrupt or leaving changes who is still in, so those stay. */
export const REVERSIBLE_KINDS: readonly TransactionKind[] = [
  'player_to_player',
  'player_to_bank',
  'bank_to_player',
  'salary',
  'player_to_parking',
  'parking_to_player',
  'auction',
];

type UndoTarget = Pick<TransactionView, 'id' | 'kind' | 'actorUserId' | 'createdAt'>;

/**
 * Whether `userId` may undo `tx` right now. Balances are checked when it is applied.
 * `reversed` holds the ids of payments that were already undone.
 */
export function canUndo(
  tx: UndoTarget,
  opts: { userId: string; isHost: boolean; now: number; reversed: ReadonlySet<number> },
): boolean {
  if (!REVERSIBLE_KINDS.includes(tx.kind) || opts.reversed.has(tx.id)) return false;
  if (opts.isHost) return true;
  return tx.actorUserId === opts.userId && opts.now - Date.parse(tx.createdAt) <= UNDO_WINDOW_MS;
}

/** The ids of payments that have been undone, from a list of transactions. */
export function reversedIds(txs: readonly Pick<TransactionView, 'kind' | 'reversesTxId'>[]): Set<number> {
  const ids = new Set<number>();
  for (const tx of txs) if (tx.kind === 'reversal' && tx.reversesTxId) ids.add(tx.reversesTxId);
  return ids;
}

type Original = Pick<TransactionView, 'kind' | 'fromUserId' | 'toUserId' | 'amount'>;

/**
 * Sends the money of `original` back where it came from. Fails when whoever received it no
 * longer has that much, or when either side is out of the game.
 */
export function applyReversal(state: EngineState, original: Original): EngineOutcome {
  const fail = (error: ErrorCode): EngineOutcome => ({ ok: false, error });
  if (state.status !== 'active') return fail('game_not_active');
  if (!REVERSIBLE_KINDS.includes(original.kind)) return fail('undo_unavailable');

  const amount = original.amount;
  const toParking = original.kind === 'player_to_parking';
  const fromParking = original.kind === 'parking_to_player';
  // money goes back from whoever got it (null = bank or pot) to whoever paid (null = bank or pot)
  const giver = original.toUserId;
  const receiver = original.fromUserId;

  const find = (id: string) => state.players.find((p) => p.userId === id);
  if (giver) {
    const p = find(giver);
    if (!p || p.status !== 'active') return fail('undo_unavailable');
    if (p.balance < amount) return fail('undo_insufficient');
  }
  if (receiver) {
    const p = find(receiver);
    if (!p || p.status !== 'active') return fail('undo_unavailable');
  }

  let pot = state.freeParkingPot;
  if (toParking) {
    if (pot < amount) return fail('undo_insufficient');
    pot -= amount;
  }
  if (fromParking) pot += amount;

  const players: EnginePlayer[] = state.players.map((p) => {
    if (p.userId === giver) return { ...p, balance: p.balance - amount };
    if (p.userId === receiver) return { ...p, balance: p.balance + amount };
    return p;
  });

  return {
    ok: true,
    result: { players, freeParkingPot: pot, tx: { kind: 'reversal', fromUserId: giver, toUserId: receiver, amount }, finished: null },
  };
}

// ---------- auction ----------

/** An auction runs this long before the first bid… */
export const AUCTION_OPEN_MS = 20_000;
/** …and every bid leaves at least this long for someone to go higher. */
export const AUCTION_BID_MS = 10_000;

export function highBid(a: Pick<AuctionView, 'bids'>): AuctionBid | null {
  return a.bids[a.bids.length - 1] ?? null;
}

/** The lowest bid that is accepted next. */
export function nextBidFloor(a: Pick<AuctionView, 'bids' | 'minBid'>): number {
  const high = highBid(a);
  return high ? high.amount + 1 : Math.max(1, a.minBid);
}

/**
 * Who wins when time runs out: the highest bid whose bidder is still in and can still pay it.
 * Someone who spent their money during the auction (or went bankrupt) is passed over.
 */
export function pickWinner(a: Pick<AuctionView, 'bids'>, players: readonly EnginePlayer[]): AuctionBid | null {
  for (let i = a.bids.length - 1; i >= 0; i--) {
    const bid = a.bids[i]!;
    const p = players.find((x) => x.userId === bid.userId);
    if (p && p.status === 'active' && p.balance >= bid.amount) return bid;
  }
  return null;
}
