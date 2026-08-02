import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";

import { Role } from "@prisma/client";
import { config } from "../config";

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

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
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
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO server not initialized - call initSocket() first");
  }
  return io;
}
