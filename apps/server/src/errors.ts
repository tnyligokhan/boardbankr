import type { ErrorCode } from '@mdb/shared';
import type { output, ZodType } from 'zod';

const STATUS: Partial<Record<ErrorCode, number>> = {
  unauthorized: 401,
  not_host: 403,
  not_a_player: 403,
  game_not_found: 404,
  rate_limited: 429,
  invalid_request: 400,
  google_disabled: 404,
  internal: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, status?: number) {
    super(code);
    this.status = status ?? STATUS[code] ?? 409;
  }
}

export function parse<S extends ZodType>(schema: S, value: unknown): output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('invalid_request');
  return result.data;
}

export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  // drizzle may wrap the driver error in `cause`
  for (let i = 0; i < 3 && e; i++) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === '23505') return true;
    e = typeof e === 'object' && e !== null && 'cause' in e ? (e as { cause: unknown }).cause : null;
  }
  return false;
}
