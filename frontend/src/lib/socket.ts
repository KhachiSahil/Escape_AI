import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

let socket: Socket | null = null

/** Module-level singleton, mirroring lib/api.ts's token-tracking pattern -
 * the connection itself doesn't need to trigger React re-renders, only the
 * events it receives do (consumed via useRealtimeSync). */
export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect()
  }
  socket = io(SOCKET_URL, { auth: { token } })
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}

export function getSocket(): Socket | null {
  return socket
}
