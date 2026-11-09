import { createHash, randomBytes } from 'node:crypto';
import { NAME_MAX } from '@mdb/shared';
import type { GoogleProfile } from './auth';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthStart {
  url: string;
  state: string;
  verifier: string;
}

/** Authorization-code flow with PKCE (S256). */
export function createAuthorization(cfg: GoogleConfig): OAuthStart {
  const state = randomBytes(24).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return { url: `${AUTH_URL}?${params}`, state, verifier };
}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  name?: string;
  given_name?: string;
  email?: string;
  email_verified?: boolean;
}

export async function exchangeCode(
  cfg: GoogleConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleProfile> {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: cfg.redirectUri,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error('Google response had no id_token');

  // The token comes straight from Google over TLS in exchange for our secret,
  // so per OIDC Core 3.1.3.7 we validate the claims without re-checking the signature.
  const claims = decodeJwtPayload(body.id_token);
  if (!claims.sub || !ISSUERS.has(claims.iss ?? '') || claims.aud !== cfg.clientId) {
    throw new Error('Google id_token claims are invalid');
  }
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error('Google id_token expired');

  const rawName = (claims.given_name || claims.name || claims.email?.split('@')[0] || 'Player').trim();
  return {
    sub: claims.sub,
    name: rawName.length >= 2 ? rawName.slice(0, NAME_MAX) : 'Player',
    email: claims.email && claims.email_verified ? claims.email : null,
  };
}

function decodeJwtPayload(jwt: string): IdTokenClaims {
  const part = jwt.split('.')[1];
  if (!part) throw new Error('Malformed id_token');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as IdTokenClaims;
}
