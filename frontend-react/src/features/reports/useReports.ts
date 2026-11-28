import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchCollectionReport,
  type CollectionInvoiceItem,
  type CollectionSummaryReport,
} from './reportsApi'

export interface UseReportsOptions {
  token?: string
  initialFrom?: string
  initialTo?: string
  autoFetch?: boolean
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useReports(options: UseReportsOptions = {}) {
  const {
    token,
    initialFrom = getTodayIsoDate(),
    initialTo = getTodayIsoDate(),
    autoFetch = true,
  } = options

  const [from, setFrom] = useState<string>(initialFrom)
  const [to, setTo] = useState<string>(initialTo)
  const [report, setReport] = useState<CollectionSummaryReport | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const requestSeqRef = useRef(0)

  const reload = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<CollectionSummaryReport | null> => {
      const targetFrom = overrideFrom ?? from
      const targetTo = overrideTo ?? to
      const reqId = ++requestSeqRef.current
      setLoading(true)
      setError(null)
      try {
        const data = await fetchCollectionReport({ from: targetFrom, to: targetTo }, token)
        if (requestSeqRef.current === reqId) {
          setReport(data)
        }
        return data
      } catch (err) {
        if (requestSeqRef.current === reqId) {
          const msg = err instanceof Error ? err.message : 'ไม่สามารถโหลดรายงานการรับชำระได้'
          setError(msg)
        }
        return null
      } finally {
        if (requestSeqRef.current === reqId) {
          setLoading(false)
        }
      }
    },
    [from, to, token]
  )

  useEffect(() => {
    if (autoFetch) {
      void reload()
    }
  }, [autoFetch, reload])

  const rows: CollectionInvoiceItem[] = useMemo(() => report?.invoices ?? [], [report])

  const totalUnits = useMemo(() => {
    if (report && rows.length === 0) {
      return report.total_units_used
    }
    return rows.reduce((sum, inv) => sum + (inv.water_used || 0), 0)
  }, [report, rows])

  const totalAmount = useMemo(() => {
    if (report && rows.length === 0) {
      return report.total_collected
    }
    return rows.reduce((sum, inv) => sum + (inv.totalpaid || 0), 0)
  }, [report, rows])

  return {
    from,
    to,
    setFrom,
    setTo,
    report,
    rows,
    totalUnits,
    totalAmount,
    loading,
    error,
    reload,
  }
}
