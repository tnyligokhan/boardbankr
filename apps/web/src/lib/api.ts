import { ERROR_CODES, type ErrorCode } from '@mdb/shared';

export type ApiFailure = ErrorCode | 'network';

export class ApiError extends Error {
  constructor(
    readonly code: ApiFailure,
    readonly status: number,
  ) {
    super(code);
  }
  /** Worth retrying with the same idempotency key. */
  get retryable(): boolean {
    return this.code === 'network' || this.status >= 500;
  }
}

const known = new Set<string>(ERROR_CODES);

export async function api<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs ?? 12_000),
    });
  } catch {
    throw new ApiError('network', 0);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const code = (data as { error?: string } | null)?.error;
    throw new ApiError(code && known.has(code) ? (code as ErrorCode) : 'internal', res.status);
  }
  return data as T;
}

/** POST that retries network/5xx failures. Only for idempotent requests. */
export async function postWithRetry<T>(path: string, body: unknown, attempts = 3): Promise<T> {
  let last: ApiError | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await api<T>(path, { method: 'POST', body });
    } catch (err) {
      if (!(err instanceof ApiError) || !err.retryable) throw err;
      last = err;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw last ?? new ApiError('network', 0);
}
