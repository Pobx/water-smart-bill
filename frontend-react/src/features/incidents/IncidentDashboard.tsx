import { useState } from 'react'
import { IncidentDetailModal } from './IncidentDetailModal'
import {
  formatIncidentDate,
  getIncidentStatusDisplay,
  getIncidentTypeDisplay,
  resolveCurrentStaffId,
  type IncidentStatusFilter,
} from './incidentsApi'
import { useIncidents } from './useIncidents'

export interface IncidentDashboardProps {
  token?: string
  currentStaffId?: number
}

const FILTER_OPTIONS: ReadonlyArray<{ value: IncidentStatusFilter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'open', label: 'รอดำเนินการ' },
  { value: 'in_progress', label: 'กำลังดำเนินการ' },
  { value: 'resolved', label: 'แก้ไขแล้ว' },
]

export function IncidentDashboard({ token, currentStaffId }: IncidentDashboardProps) {
  const {
    incidents,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    reload,
    getDetail,
    assign,
    resolve,
  } = useIncidents({ token })

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const staffId = currentStaffId ?? resolveCurrentStaffId(token)

  const handleAssign = async (id: string) => {
    setAssigningId(id)
    setActionError(null)
    try {
      await assign(id, staffId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'ไม่สามารถรับงานได้')
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            รายการแจ้งเหตุขัดข้องน้ำประปา
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            ติดตามเหตุขัดข้องจากลูกบ้าน, กดรับงาน, ดูพิกัด Google Maps และบันทึกการแก้ไข
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span>สถานะ:</span>
            <select
              aria-label="กรองตามสถานะ"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as IncidentStatusFilter)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700"
        >
          {actionError ?? error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">วันที่แจ้ง</th>
                <th className="px-4 py-3">ประเภทเหตุ</th>
                <th className="px-4 py-3">ผู้แจ้ง</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3 text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && incidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    กำลังโหลดรายการแจ้งเหตุ...
                  </td>
                </tr>
              )}
              {!loading && incidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    ไม่พบรายการแจ้งเหตุขัดข้อง
                  </td>
                </tr>
              )}
              {incidents.map((inc) => {
                const typeInfo = getIncidentTypeDisplay(inc.incident_type)
                const statusInfo = getIncidentStatusDisplay(inc.status)
                const isOpen = inc.status === 'open'
                return (
                  <tr key={inc.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatIncidentDate(inc.created_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true">{typeInfo.icon}</span>
                        <span>{typeInfo.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {inc.reporter_name || `ผู้ใช้ #${inc.reporter_user_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        data-testid={`status-badge-${inc.id}`}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {isOpen && (
                          <button
                            type="button"
                            disabled={assigningId === inc.id}
                            onClick={() => void handleAssign(inc.id)}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 disabled:opacity-50"
                          >
                            {assigningId === inc.id ? 'กำลังรับงาน...' : 'รับงาน'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedIncidentId(inc.id)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          ดูรายละเอียด
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <IncidentDetailModal
        open={selectedIncidentId !== null}
        incidentId={selectedIncidentId}
        currentStaffId={staffId}
        onFetchDetail={getDetail}
        onAssign={assign}
        onResolve={resolve}
        onClose={() => setSelectedIncidentId(null)}
      />
    </section>
  )
}
