import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Me } from '@mdb/shared';
import type { Db } from '../db/index';
import { sessions, users } from '../db/schema';

export const SESSION_COOKIE = 'mdb_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
const SESSION_REFRESH_MS = 1000 * 60 * 60 * 24 * 30; // extend when less than 60 days remain

type UserRow = typeof users.$inferSelect;

export function toMe(u: UserRow): Me {
  return { id: u.id, name: u.name, kind: u.kind, email: u.email };
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export interface SessionLookup {
  user: UserRow;
  /** Set when the session was extended and the cookie should be re-issued. */
  renewedUntil: Date | null;
}

export async function getSessionUser(db: Db, token: string | undefined): Promise<SessionLookup | null> {
  if (!token || token.length > 100) return null;
  const id = hashToken(token);
  const now = new Date();
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  let renewedUntil: Date | null = null;
  if (row.expiresAt.getTime() - now.getTime() < SESSION_TTL_MS - SESSION_REFRESH_MS) {
    renewedUntil = new Date(now.getTime() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id));
    await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, row.user.id));
  }
  return { user: row.user, renewedUntil };
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function createGuest(db: Db, name: string): Promise<UserRow> {
  const [user] = await db.insert(users).values({ name, kind: 'guest' }).returning();
  return user!;
}

export async function renameUser(db: Db, userId: string, name: string): Promise<UserRow> {
  const [user] = await db.update(users).set({ name }).where(eq(users.id, userId)).returning();
  return user!;
}

export interface GoogleProfile {
  sub: string;
  name: string;
  email: string | null;
}

/**
 * Finds or creates the Google user. If the person is currently a guest and has no
 * Google account yet, the guest account is upgraded so their games are kept.
 */
export async function upsertGoogleUser(db: Db, profile: GoogleProfile, currentUser: UserRow | null): Promise<UserRow> {
  const existing = await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1);
  if (existing[0]) {
    const [u] = await db
      .update(users)
      .set({ email: profile.email, lastSeenAt: new Date() })
      .where(eq(users.id, existing[0].id))
      .returning();
    return u!;
  }
  if (currentUser && currentUser.kind === 'guest') {
    const [u] = await db
      .update(users)
      .set({ kind: 'google', googleSub: profile.sub, email: profile.email })
      .where(eq(users.id, currentUser.id))
      .returning();
    return u!;
  }
  const [u] = await db
    .insert(users)
    .values({ name: profile.name, kind: 'google', googleSub: profile.sub, email: profile.email })
    .returning();
  return u!;
}

export async function deleteExpiredSessions(db: Db): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
