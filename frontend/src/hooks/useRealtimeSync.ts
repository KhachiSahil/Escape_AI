import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/useAuth'
import { connectSocket, disconnectSocket } from '../lib/socket'
import type { Lead } from '../types/models'

/**
 * Connects the Socket.IO client once a token exists, and invalidates the
 * relevant React Query caches on each real-time event rather than manually
 * splicing the payload into the cache - simpler and self-correcting, and
 * payloads already carry the full record if a future optimization wants it.
 */
export function useRealtimeSync(): void {
  const { employee } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!employee) return

    const socket = connectSocket()

    const onLeadUpdated = (lead: Lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
    }
    const onEscalationCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    }
    const onCallLogged = (call: { leadId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['lead', call.leadId] })
    }
    const onPresenceChange = () => {
      queryClient.invalidateQueries({ queryKey: ['employees', 'online'] })
    }

    socket.on('lead:updated', onLeadUpdated)
    socket.on('escalation:created', onEscalationCreated)
    socket.on('call:logged', onCallLogged)
    socket.on('presence:online', onPresenceChange)
    socket.on('presence:offline', onPresenceChange)

    return () => {
      socket.off('lead:updated', onLeadUpdated)
      socket.off('escalation:created', onEscalationCreated)
      socket.off('call:logged', onCallLogged)
      socket.off('presence:online', onPresenceChange)
      socket.off('presence:offline', onPresenceChange)
      disconnectSocket()
    }
  }, [employee, queryClient])
}
