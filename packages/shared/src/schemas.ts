import { z } from 'zod';
import { AMOUNT_MAX, CURRENCIES, NAME_MAX, NAME_MIN, PLAYER_TOKENS } from './constants';

export const nameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(NAME_MIN).max(NAME_MAX));

export const amountSchema = z.number().int().min(1).max(AMOUNT_MAX);

export const guestLoginSchema = z.object({ name: nameSchema });

export const updateMeSchema = z.object({ name: nameSchema });

export const createGameSchema = z.object({
  startingCapital: z.number().int().min(1).max(AMOUNT_MAX),
  salary: z.number().int().min(0).max(AMOUNT_MAX),
  freeParkingEnabled: z.boolean(),
  currency: z.enum(CURRENCIES),
  turnsEnabled: z.boolean().default(true),
});
export type CreateGameInput = z.infer<typeof createGameSchema>;

/**
 * End the current turn. `userId` is whose turn the caller is looking at, so a double tap
 * or a retry never moves the turn on twice. 'skip' lets the host move past an absent player.
 */
export const turnSchema = z.object({ kind: z.enum(['end', 'skip']), userId: z.string().uuid() });
export type TurnRequest = z.infer<typeof turnSchema>;

export const tokenSchema = z.object({ token: z.enum(PLAYER_TOKENS) });

const clientTxId = z.string().min(8).max(64);

export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bank_to_player'), amount: amountSchema }),
  z.object({ kind: z.literal('player_to_bank'), amount: amountSchema }),
  z.object({ kind: z.literal('player_to_player'), amount: amountSchema, toUserId: z.string().uuid() }),
  z.object({ kind: z.literal('salary') }),
  z.object({ kind: z.literal('player_to_parking'), amount: amountSchema }),
  z.object({ kind: z.literal('parking_to_player') }),
  z.object({ kind: z.literal('bankruptcy'), creditorUserId: z.string().uuid().nullable() }),
]);
export type GameAction = z.infer<typeof actionSchema>;

export const actionRequestSchema = z.object({ clientTxId, action: actionSchema });
export type ActionRequest = z.infer<typeof actionRequestSchema>;

export const kickSchema = z.object({ userId: z.string().uuid() });
