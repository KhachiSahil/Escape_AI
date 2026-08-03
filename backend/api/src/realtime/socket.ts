import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";

import { Role } from "@prisma/client";
import { config } from "../config";

/** Extracts a single named value from a raw `Cookie` header string. */
function readCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

let io: SocketIOServer | null = null;

interface SocketAuthPayload {
  sub: string;
  role: Role;
}

/** Room for events scoped to one employee's own dashboard. */
export function employeeRoom(employeeId: string): string {
  return `employee:${employeeId}`;
}

/** Shared room for ADMIN and MANAGER - one privilege tier everywhere else in this codebase. */
export const ADMIN_ROOM = "role:admin";

// Tracks currently-connected employee ids for presence indicators. In-memory
// only - correct for a single server instance; a multi-instance deployment
// would need a shared store (Redis), not built speculatively here since
// nothing in this project runs multi-instance today.
const onlineEmployeeIds = new Set<string>();

export function getOnlineEmployeeIds(): string[] {
  return Array.from(onlineEmployeeIds);
}

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    // Cookie first - Socket.IO's handshake is a real HTTP request, so the
    // Cookie header is present even though socket.handshake.auth is
    // JS-supplied and invisible to an httpOnly cookie. Falls back to
    // auth.token for any client that still passes it explicitly.
    const cookieHeader = socket.handshake.headers.cookie;
    const cookieToken = cookieHeader ? readCookie(cookieHeader, "token") : undefined;
    const token = cookieToken ?? (socket.handshake.auth?.token as string | undefined);

    if (!token) {
      return next(new Error("Unauthorized"));
    }
    try {
      const payload = jwt.verify(token, config.jwtSecret) as SocketAuthPayload;
      socket.data.employeeId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { employeeId, role } = socket.data as { employeeId: string; role: Role };
    socket.join(employeeRoom(employeeId));
    if (role === "ADMIN" || role === "MANAGER") {
      socket.join(ADMIN_ROOM);
    }

    onlineEmployeeIds.add(employeeId);
    io?.to(ADMIN_ROOM).emit("presence:online", { employeeId });

    socket.on("disconnect", () => {
      // A second tab/device for the same employee stays connected on
      // another socket - only mark offline once no sockets remain in that
      // employee's own room.
      const remainingSockets = io?.sockets.adapter.rooms.get(employeeRoom(employeeId));
      if (!remainingSockets || remainingSockets.size === 0) {
        onlineEmployeeIds.delete(employeeId);
        io?.to(ADMIN_ROOM).emit("presence:offline", { employeeId });
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO server not initialized - call initSocket() first");
  }
  return io;
}
