import { useCallback, useEffect, useState } from 'react'
import {
  createDebtNotice,
  cutMeter,
  fetchDebtNotices,
  fetchUserOutstanding,
  restoreMeter,
  type CreateDebtNoticePayload,
  type DebtNotice,
  type DebtNoticeFilter,
  type OutstandingBalanceResponse,
} from './debtManagementApi'

export interface UseDebtManagementOptions {
  token?: string
  initialStatusFilter?: string
}

export function useDebtManagement(options: UseDebtManagementOptions = {}) {
  const { token, initialStatusFilter = '' } = options
  const [notices, setNotices] = useState<DebtNotice[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter)

  const reload = useCallback(
    async (filterOverride?: DebtNoticeFilter): Promise<DebtNotice[]> => {
      setLoading(true)
      setError(null)
      try {
        const effectiveFilter: DebtNoticeFilter = filterOverride ?? {
          status: statusFilter || undefined,
        }
        const items = await fetchDebtNotices(effectiveFilter, token)
        setNotices(items)
        return items
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการใบแจ้งเตือนหนี้ได้'
        setError(msg)
        return []
      } finally {
        setLoading(false)
      }
    },
    [statusFilter, token]
  )

  useEffect(() => {
    void reload()
  }, [reload])

  const getOutstanding = useCallback(
    async (userId: number): Promise<OutstandingBalanceResponse> => {
      return fetchUserOutstanding(userId, token)
    },
    [token]
  )

  const createNotice = useCallback(
    async (payload: CreateDebtNoticePayload): Promise<DebtNotice> => {
      setError(null)
      const created = await createDebtNotice(payload, token)
      setNotices((prev) => [created, ...prev])
      return created
    },
    [token]
  )

  const cut = useCallback(
    async (id: string, meterReading: number): Promise<DebtNotice> => {
      setError(null)
      const updated = await cutMeter(id, meterReading, token)
      setNotices((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      return updated
    },
    [token]
  )

  const restore = useCallback(
    async (id: string): Promise<DebtNotice> => {
      setError(null)
      const updated = await restoreMeter(id, token)
      setNotices((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      return updated
    },
    [token]
  )

  return {
    notices,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    reload,
    getOutstanding,
    createNotice,
    cut,
    restore,
  }
}
