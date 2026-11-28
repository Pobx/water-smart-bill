import { useCallback, useEffect, useRef, useState } from 'react'
import {
  assignIncident,
  fetchIncidentDetail,
  fetchIncidents,
  resolveIncident,
  type Incident,
  type IncidentFilter,
  type IncidentStatusFilter,
} from './incidentsApi'

export interface UseIncidentsOptions {
  token?: string
  initialStatusFilter?: IncidentStatusFilter
}

export function useIncidents(options: UseIncidentsOptions = {}) {
  const { token, initialStatusFilter = 'all' } = options
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<IncidentStatusFilter>(initialStatusFilter)
  const loadSeqRef = useRef(0)

  const reload = useCallback(
    async (filterOverride?: IncidentFilter): Promise<Incident[]> => {
      const seq = ++loadSeqRef.current
      setLoading(true)
      setError(null)
      try {
        const effectiveFilter: IncidentFilter = filterOverride ?? {
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }
        const items = await fetchIncidents(effectiveFilter, token)
        if (seq !== loadSeqRef.current) return items
        setIncidents(items)
        return items
      } catch (err) {
        if (seq !== loadSeqRef.current) return []
        const msg = err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการแจ้งเหตุได้'
        setError(msg)
        return []
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false)
        }
      }
    },
    [statusFilter, token]
  )

  useEffect(() => {
    void reload()
  }, [reload])

  const getDetail = useCallback(
    async (id: string): Promise<Incident> => {
      return fetchIncidentDetail(id, token)
    },
    [token]
  )

  const assign = useCallback(
    async (id: string, staffId: number): Promise<Incident> => {
      setError(null)
      const updated = await assignIncident(id, staffId, token)
      setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)))
      return updated
    },
    [token]
  )

  const resolve = useCallback(
    async (id: string, resolutionNote: string): Promise<Incident> => {
      setError(null)
      const updated = await resolveIncident(id, resolutionNote, token)
      setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)))
      return updated
    },
    [token]
  )

  return {
    incidents,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    reload,
    getDetail,
    assign,
    resolve,
  }
}
