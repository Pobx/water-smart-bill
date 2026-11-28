import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  buildGoogleMapsUrl,
  formatIncidentDate,
  getIncidentStatusDisplay,
  getIncidentTypeDisplay,
  sanitizePhotoUrl,
  type Incident,
} from './incidentsApi'

export interface IncidentDetailModalProps {
  open: boolean
  incidentId: string | null
  currentStaffId?: number
  onFetchDetail: (id: string) => Promise<Incident>
  onAssign?: (id: string, staffId: number) => Promise<Incident | void>
  onResolve: (id: string, resolutionNote: string) => Promise<Incident | void>
  onClose: () => void
}

export function IncidentDetailModal({
  open,
  incidentId,
  currentStaffId = 1,
  onFetchDetail,
  onAssign,
  onResolve,
  onClose,
}: IncidentDetailModalProps) {
  const [detail, setDetail] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    if (!open || !incidentId) {
      requestSeqRef.current += 1
      setDetail(null)
      setLoading(false)
      setLoadError(null)
      setResolutionNote('')
      setActionError(null)
      setSubmitting(false)
      return
    }

    let cancelled = false
    const seq = ++requestSeqRef.current
    setDetail(null)
    setLoading(true)
    setLoadError(null)
    setResolutionNote('')
    setActionError(null)
    setSubmitting(false)

    void onFetchDetail(incidentId)
      .then((data) => {
        if (cancelled || seq !== requestSeqRef.current) return
        setDetail(data)
      })
      .catch((err) => {
        if (cancelled || seq !== requestSeqRef.current) return
        setLoadError(
          err instanceof Error ? err.message : 'ไม่สามารถโหลดรายละเอียดเหตุขัดข้องได้'
        )
      })
      .finally(() => {
        if (!cancelled && seq === requestSeqRef.current) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, incidentId, onFetchDetail])

  if (!open || !incidentId) return null

  const handleAssignFromModal = async () => {
    if (!detail || !onAssign) return
    setSubmitting(true)
    setActionError(null)
    try {
      const updated = await onAssign(detail.id, currentStaffId)
      if (updated) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                ...updated,
                lat: updated.lat ?? prev.lat,
                lng: updated.lng ?? prev.lng,
              }
            : updated
        )
      } else {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                status: 'in_progress',
                assigned_to: currentStaffId,
              }
            : prev
        )
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'ไม่สามารถรับงานได้')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolveSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!detail) return

    const trimmedNote = resolutionNote.trim()
    if (!trimmedNote) {
      setActionError('กรุณาระบุบันทึกการแก้ไขก่อนปิดงาน')
      return
    }

    setSubmitting(true)
    setActionError(null)
    try {
      const updated = await onResolve(detail.id, trimmedNote)
      if (updated) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                ...updated,
                lat: updated.lat ?? prev.lat,
                lng: updated.lng ?? prev.lng,
              }
            : updated
        )
      } else {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                status: 'resolved',
                resolution_note: trimmedNote,
              }
            : prev
        )
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'ไม่สามารถปิดงานได้')
    } finally {
      setSubmitting(false)
    }
  }

  const typeInfo = detail ? getIncidentTypeDisplay(detail.incident_type) : null
  const statusInfo = detail ? getIncidentStatusDisplay(detail.status) : null
  const mapsUrl = detail ? buildGoogleMapsUrl(detail.lat, detail.lng) : null
  const safePhotoUrl = detail ? sanitizePhotoUrl(detail.photo_url) : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="รายละเอียดเหตุขัดข้อง"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">รายละเอียดเหตุขัดข้องน้ำประปา</h2>
            <p className="mt-0.5 text-xs text-slate-500">รหัสเหตุการณ์: {incidentId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {loading && (
            <p className="py-8 text-center text-xs font-medium text-slate-500">
              กำลังโหลดรายละเอียดเหตุขัดข้อง...
            </p>
          )}

          {loadError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700"
            >
              {loadError}
            </div>
          )}

          {!loading && detail && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <span aria-hidden="true">{typeInfo?.icon}</span>
                    <span>{typeInfo?.label}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    ผู้แจ้ง: <span className="font-semibold text-slate-800">{detail.reporter_name || `ผู้ใช้ #${detail.reporter_user_id}`}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    แจ้งเมื่อ: {formatIncidentDate(detail.created_at)}
                  </div>
                </div>
                {statusInfo && (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.className}`}
                  >
                    {statusInfo.label}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-700">รายละเอียดปัญหา</h3>
                <p className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 whitespace-pre-wrap">
                  {detail.description?.trim() ? detail.description : 'ไม่ได้ระบุรายละเอียดเพิ่มเติม'}
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-700">ตำแหน่งพิกัด GPS</h3>
                {mapsUrl ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/60 px-3.5 py-2.5">
                    <span className="text-xs text-slate-700">
                      พิกัด: {detail.lat}, {detail.lng}
                    </span>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-700"
                    >
                      📍 เปิดใน Google Maps
                    </a>
                  </div>
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
                    ไม่มีพิกัด GPS
                  </p>
                )}
              </div>

              {safePhotoUrl && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-700">ภาพประกอบ</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img
                      src={safePhotoUrl}
                      alt="ภาพประกอบเหตุขัดข้อง"
                      className="max-h-72 w-full object-contain"
                    />
                  </div>
                </div>
              )}

              {actionError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700"
                >
                  {actionError}
                </div>
              )}

              {detail.status === 'open' && onAssign && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <p className="text-xs text-amber-900">
                    รับงานนี้เพื่อเริ่มดำเนินการตรวจสอบและแก้ไขหน้างาน
                  </p>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleAssignFromModal()}
                    className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50"
                  >
                    {submitting ? 'กำลังรับงาน...' : 'รับงาน'}
                  </button>
                </div>
              )}

              {detail.status === 'in_progress' && (
                <form
                  onSubmit={handleResolveSubmit}
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  noValidate
                >
                  <label
                    htmlFor="incident-resolution-note"
                    className="block text-xs font-bold text-slate-700"
                  >
                    บันทึกการแก้ไข (จำเป็นสำหรับปิดงาน)
                  </label>
                  <textarea
                    id="incident-resolution-note"
                    rows={3}
                    value={resolutionNote}
                    onChange={(e) => {
                      setResolutionNote(e.target.value)
                      if (actionError) setActionError(null)
                    }}
                    placeholder="ระบุรายละเอียดการซ่อมแซมหรือแนวทางแก้ไขที่ดำเนินการแล้ว..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {submitting ? 'กำลังปิดงาน...' : 'ปิดงาน'}
                    </button>
                  </div>
                </form>
              )}

              {detail.status === 'resolved' && (
                <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="text-xs font-bold text-emerald-900">บันทึกการแก้ไข</div>
                  <p className="text-sm text-emerald-950 whitespace-pre-wrap">
                    {detail.resolution_note || '-'}
                  </p>
                  {detail.resolved_at && (
                    <div className="text-[11px] text-emerald-700">
                      ปิดงานเมื่อ: {formatIncidentDate(detail.resolved_at)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
