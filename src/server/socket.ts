import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

export type AppSocket = Socket & { userId?: string };
export type AppIO = Server & { of: any };

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

const globalForIO = globalThis as unknown as { __betarenaIO?: Server };

/** Get the socket.io server (same process — custom server). */
export function getIO(): Server | null {
  return globalForIO.__betarenaIO ?? null;
}

export function setupSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });
  globalForIO.__betarenaIO = io;

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AppSocket;
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (token) {
      verifyToken(token).then((session) => {
        if (session) {
          socket.userId = session.id;
          socket.join(`user:${session.id}`);
        }
      });
    }

    socket.on("subscribe:fixture", (fixtureId: string) => {
      if (typeof fixtureId === "string" && fixtureId.length < 64) {
        socket.join(`live:fixture:${fixtureId}`);
      }
    });
    socket.on("unsubscribe:fixture", (fixtureId: string) => {
      if (typeof fixtureId === "string") socket.leave(`live:fixture:${fixtureId}`);
    });
    socket.on("subscribe:live", () => socket.join("live"));
    socket.on("unsubscribe:live", () => socket.leave("live"));
  });

  return io;
}
