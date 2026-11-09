import type { GameSnapshot, TransactionView } from '@mdb/shared';
import type { MessageKey } from './dictionary';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function playerName(game: GameSnapshot, id: string | null, t: T): string {
  if (!id) return t('theBank');
  return game.players.find((x) => x.userId === id)?.name ?? '—';
}

/** One line for the activity feed. */
export function describeTx(tx: TransactionView, game: GameSnapshot, t: T): string {
  const name = (id: string | null) => playerName(game, id, t);
  switch (tx.kind) {
    case 'salary':
      return t('feedSalary', { name: name(tx.toUserId) });
    case 'bank_to_player':
      return t('feedFromBank', { name: name(tx.toUserId) });
    case 'player_to_bank':
      return t('feedToBank', { name: name(tx.fromUserId) });
    case 'player_to_player':
      return t('feedTransfer', { from: name(tx.fromUserId), to: name(tx.toUserId) });
    case 'player_to_parking':
      return t('feedToParking', { name: name(tx.fromUserId) });
    case 'parking_to_player':
      return t('feedFromParking', { name: name(tx.toUserId) });
    case 'bankruptcy':
      return tx.toUserId
        ? t('feedBankruptTo', { name: name(tx.fromUserId), to: name(tx.toUserId) })
        : t('feedBankruptBank', { name: name(tx.fromUserId) });
    case 'leave':
      return t('feedLeft', { name: name(tx.fromUserId) });
  }
}

/** How a transaction changed my money: +, − or nothing. */
export function deltaFor(tx: TransactionView, meId: string): number {
  if (tx.toUserId === meId) return tx.amount;
  if (tx.fromUserId === meId) return -tx.amount;
  return 0;
}
