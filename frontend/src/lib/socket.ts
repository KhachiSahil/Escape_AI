import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

let socket: Socket | null = null

/** Module-level singleton - the connection itself doesn't need to trigger
 * React re-renders, only the events it receives do (consumed via
 * useRealtimeSync). The JWT lives in an httpOnly cookie now; withCredentials
 * sends it automatically during the handshake, no token to pass explicitly. */
export function connectSocket(): Socket {
  if (socket) {
    socket.disconnect()
  }
  socket = io(SOCKET_URL, { withCredentials: true })
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}

export function getSocket(): Socket | null {
  return socket
}
