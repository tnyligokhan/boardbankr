import type { WebSocket } from 'ws';
import type { GameSnapshot, ServerMessage } from '@mdb/shared';
import type { Removal } from '../services/games';

interface Client {
  socket: WebSocket;
  userId: string;
}

/**
 * Keeps track of which sockets watch which game and pushes full snapshots.
 * Single-process by design; see README for scaling notes.
 */
export class Hub {
  private rooms = new Map<string, Set<Client>>();
  private bySocket = new Map<WebSocket, { client: Client; gameId: string | null }>();

  add(socket: WebSocket, userId: string): void {
    this.bySocket.set(socket, { client: { socket, userId }, gameId: null });
  }

  remove(socket: WebSocket): void {
    this.leaveRoom(socket);
    this.bySocket.delete(socket);
  }

  join(socket: WebSocket, gameId: string): void {
    const entry = this.bySocket.get(socket);
    if (!entry) return;
    this.leaveRoom(socket);
    let room = this.rooms.get(gameId);
    if (!room) this.rooms.set(gameId, (room = new Set()));
    room.add(entry.client);
    entry.gameId = gameId;
  }

  broadcast(game: GameSnapshot): void {
    const room = this.rooms.get(game.id);
    if (!room) return;
    const msg = JSON.stringify({ type: 'snapshot', game } satisfies ServerMessage);
    for (const c of room) send(c.socket, msg);
  }

  notifyRemoved(gameId: string, code: string, removals: Removal[]): void {
    const room = this.rooms.get(gameId);
    if (!room) return;
    for (const r of removals) {
      const msg = JSON.stringify({ type: 'removed', code, reason: r.reason } satisfies ServerMessage);
      for (const c of [...room]) {
        if (c.userId !== r.userId) continue;
        send(c.socket, msg);
        room.delete(c);
        const entry = this.bySocket.get(c.socket);
        if (entry) entry.gameId = null;
      }
    }
  }

  closeRoom(gameId: string): void {
    const room = this.rooms.get(gameId);
    if (!room) return;
    for (const c of room) {
      const entry = this.bySocket.get(c.socket);
      if (entry) entry.gameId = null;
    }
    this.rooms.delete(gameId);
  }

  get size(): number {
    return this.bySocket.size;
  }

  private leaveRoom(socket: WebSocket): void {
    const entry = this.bySocket.get(socket);
    if (!entry?.gameId) return;
    const room = this.rooms.get(entry.gameId);
    room?.delete(entry.client);
    if (room && room.size === 0) this.rooms.delete(entry.gameId);
    entry.gameId = null;
  }
}

function send(socket: WebSocket, msg: string): void {
  if (socket.readyState === socket.OPEN) socket.send(msg);
}
