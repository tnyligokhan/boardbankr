import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction, GamePreview, GameSnapshot, PlayerToken, ServerMessage } from '@mdb/shared';
import { ApiError, api, postWithRetry, type ApiFailure } from './api';
import { newClientTxId } from './format';

export type Connection = 'online' | 'connecting' | 'offline';

export type GameState =
  | { phase: 'loading' }
  | { phase: 'preview'; preview: GamePreview }
  | { phase: 'member'; game: GameSnapshot }
  | { phase: 'removed'; reason: 'kicked' | 'disbanded' | 'left' }
  | { phase: 'error'; error: ApiFailure };

type ViewResponse = { kind: 'member'; game: GameSnapshot } | { kind: 'preview'; preview: GamePreview };
type GameResponse = { game: GameSnapshot | null };

export type Result = { ok: true } | { ok: false; error: ApiFailure };

const PING_EVERY = 20_000;
const PONG_TIMEOUT = 8_000;

/**
 * Loads a game and keeps it live over a WebSocket.
 *
 * Reliability rules:
 *  - every server message carries a full snapshot with a version; we keep the newest,
 *  - on reconnect (network back, tab visible again, missed pong) we resubscribe and get a fresh snapshot,
 *  - every payment has a client id, so retries can never charge twice.
 */
export function useGame(ref: string, onSnapshot?: (next: GameSnapshot, prev: GameSnapshot | null) => void) {
  const [state, setState] = useState<GameState>({ phase: 'loading' });
  const [connection, setConnection] = useState<Connection>('connecting');
  const gameRef = useRef<GameSnapshot | null>(null);
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  const apply = useCallback((next: GameSnapshot) => {
    const prev = gameRef.current;
    if (prev && prev.id === next.id && next.version < prev.version) return;
    gameRef.current = next;
    setState({ phase: 'member', game: next });
    onSnapshotRef.current?.(next, prev);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api<ViewResponse>(`/api/games/${encodeURIComponent(ref)}`);
      if (res.kind === 'member') apply(res.game);
      else setState({ phase: 'preview', preview: res.preview });
      return res.kind;
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'internal';
      // keep showing the last known table if a refresh fails
      if (!gameRef.current) setState({ phase: 'error', error: code });
      return null;
    }
  }, [ref, apply]);

  // ----- websocket lifecycle -----
  // finished games never change, so they need no live connection
  const isLive = state.phase === 'member' && state.game.status !== 'finished';
  const gameId = state.phase === 'member' ? state.game.id : null;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isLive || !gameId) return;
    let socket: WebSocket | null = null;
    let disposed = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let pongTimer: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      clearTimeout(pongTimer);
    };

    const connect = () => {
      if (disposed) return;
      clearTimers();
      if (!navigator.onLine) {
        setConnection('offline');
        return;
      }
      setConnection('connecting');
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      socket = ws;

      ws.onopen = () => {
        retry = 0;
        ws.send(JSON.stringify({ type: 'subscribe', code: gameId }));
        pingTimer = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ type: 'ping' }));
          clearTimeout(pongTimer);
          pongTimer = setTimeout(() => ws.close(), PONG_TIMEOUT); // zombie connection
        }, PING_EVERY);
      };
      ws.onmessage = (ev) => {
        clearTimeout(pongTimer);
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data as string) as ServerMessage;
        } catch {
          return;
        }
        if (msg.type === 'snapshot') {
          setConnection('online');
          apply(msg.game);
        } else if (msg.type === 'removed') {
          disposed = true;
          gameRef.current = null;
          setState({ phase: 'removed', reason: msg.reason });
          ws.close();
        } else if (msg.type === 'error' && msg.error === 'not_a_player') {
          disposed = true;
          void load();
          ws.close();
        }
      };
      ws.onclose = () => {
        clearTimers();
        if (socket !== ws || disposed) return;
        socket = null;
        setConnection(navigator.onLine ? 'connecting' : 'offline');
        const delay = Math.min(8000, 500 * 2 ** retry) * (0.75 + Math.random() * 0.5);
        retry++;
        retryTimer = setTimeout(connect, delay);
      };
    };

    const revive = () => {
      if (disposed) return;
      if (document.visibilityState !== 'visible') return;
      if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        retry = 0;
        connect();
      } else if (socket.readyState === WebSocket.OPEN) {
        // the socket may look open after the phone slept; ask for a fresh snapshot anyway
        socket.send(JSON.stringify({ type: 'subscribe', code: gameId }));
      }
    };
    const goOffline = () => setConnection('offline');

    connect();
    document.addEventListener('visibilitychange', revive);
    window.addEventListener('online', revive);
    window.addEventListener('offline', goOffline);
    window.addEventListener('pageshow', revive);

    return () => {
      disposed = true;
      clearTimers();
      document.removeEventListener('visibilitychange', revive);
      window.removeEventListener('online', revive);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('pageshow', revive);
      socket?.close();
    };
  }, [isLive, gameId, apply, load]);

  // ----- commands -----
  const command = useCallback(
    async (path: string, body: unknown = {}, retries = 1): Promise<Result> => {
      const id = gameRef.current?.id ?? ref;
      try {
        const res = await postWithRetry<GameResponse>(`/api/games/${encodeURIComponent(id)}/${path}`, body, retries);
        if (res.game) apply(res.game);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof ApiError ? err.code : 'internal' };
      }
    },
    [ref, apply],
  );

  const act = useCallback(
    (action: GameAction) => command('actions', { clientTxId: newClientTxId(), action }, 4),
    [command],
  );

  const join = useCallback(async (): Promise<Result> => {
    const r = await command('join');
    if (r.ok && !gameRef.current) await load();
    return r;
  }, [command, load]);

  const leaveOrDisband = useCallback(
    async (path: 'leave' | 'disband'): Promise<Result> => {
      const r = await command(path);
      if (r.ok) {
        gameRef.current = null;
        setState({ phase: 'removed', reason: path === 'leave' ? 'left' : 'disbanded' });
      }
      return r;
    },
    [command],
  );

  return {
    state,
    connection: isLive ? connection : ('online' as Connection),
    reload: load,
    act,
    join,
    start: () => command('start'),
    finish: () => command('finish'),
    kick: (userId: string) => command('kick', { userId }),
    /** `userId` is whose turn is on screen, so a double tap can't end two turns. */
    endTurn: (userId: string) => command('turn', { kind: 'end', userId }, 3),
    skipTurn: (userId: string) => command('turn', { kind: 'skip', userId }, 3),
    setToken: (token: PlayerToken) => command('token', { token }),
    undo: (txId: number) => command('undo', { txId }, 3),
    roll: (count: number) => command('roll', { count }),
    startAuction: (title: string, minBid: number) => command('auction', { title, minBid }),
    bid: (auctionId: string, amount: number) => command('auction/bid', { auctionId, amount }, 3),
    cancelAuction: (auctionId: string) => command('auction/cancel', { auctionId }, 3),
    settleAuction: (auctionId: string) => command('auction/settle', { auctionId }, 2),
    leave: () => leaveOrDisband('leave'),
    disband: () => leaveOrDisband('disband'),
  };
}
