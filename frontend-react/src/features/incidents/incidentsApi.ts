import { parseJwtPayload } from '@/features/auth'
import { apiRequest } from '@/shared/api/httpClient'

export type IncidentType = 'no_water' | 'cloudy_water' | 'broken_pipe' | 'other'
export type IncidentStatus = 'open' | 'in_progress' | 'resolved'
export type IncidentStatusFilter = 'all' | IncidentStatus

export interface Incident {
  id: string
  org_id: number
  reporter_user_id: number
  reporter_name?: string
  incident_type: IncidentType
  description?: string
  lat?: number | null
  lng?: number | null
  photo_url?: string
  status: IncidentStatus | string
  assigned_to?: number | null
  assigned_at?: string
  resolved_at?: string
  resolution_note?: string
  created_at: string
}

export interface IncidentFilter {
  status?: string
  assigned_to?: number
}

export const INCIDENT_TYPE_LABELS: Record<IncidentType, { label: string; icon: string }> = {
  no_water: { label: 'น้ำไม่ไหล', icon: '🚱' },
  cloudy_water: { label: 'น้ำขุ่น', icon: '💧' },
  broken_pipe: { label: 'ท่อแตก', icon: '🔧' },
  other: { label: 'อื่น ๆ', icon: '📝' },
}

export const INCIDENT_STATUS_BADGES: Record<
  IncidentStatus,
  { label: string; className: string }
> = {
  open: {
    label: 'รอดำเนินการ',
    className: 'bg-rose-50 text-rose-800 ring-1 ring-rose-500/30',
  },
  in_progress: {
    label: 'กำลังดำเนินการ',
    className: 'bg-amber-50 text-amber-800 ring-1 ring-amber-500/30',
  },
  resolved: {
    label: 'แก้ไขแล้ว',
    className: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30',
  },
}

export function getIncidentTypeDisplay(type: string): { label: string; icon: string } {
  return (
    INCIDENT_TYPE_LABELS[type as IncidentType] ?? {
      label: type || 'ไม่ระบุ',
      icon: '📌',
    }
  )
}

export function getIncidentStatusDisplay(status: string): {
  label: string
  className: string
} {
  return (
    INCIDENT_STATUS_BADGES[status as IncidentStatus] ?? {
      label: status || 'ไม่ทราบสถานะ',
      className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300',
    }
  )
}

export function formatIncidentDate(isoDate?: string): string {
  if (!isoDate) return '-'
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function sanitizePhotoUrl(rawUrl?: string): string | null {
  const trimmed = rawUrl?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
  } catch {
    return null
  }
  return null
}

export function buildGoogleMapsUrl(lat?: number | null, lng?: number | null): string | null {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null
  }
  return `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`
}

export function resolveCurrentStaffId(token?: string): number {
  if (token) {
    const payload = parseJwtPayload(token) as {
      sub?: string
      user_id?: unknown
    } | null
    if (payload) {
      if (
        typeof payload.user_id === 'number' &&
        Number.isInteger(payload.user_id) &&
        payload.user_id > 0
      ) {
        return payload.user_id
      }
      const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
      if (/^\d+$/.test(sub)) {
        const parsed = Number.parseInt(sub, 10)
        if (parsed > 0) return parsed
      }
      if (sub.startsWith('demo-user-')) {
        const parsed = Number.parseInt(sub.slice('demo-user-'.length), 10)
        if (Number.isInteger(parsed) && parsed > 0) return parsed
      }
    }
  }
  return 1
}

export async function fetchIncidents(
  filter?: IncidentFilter,
  token?: string
): Promise<Incident[]> {
  const params = new URLSearchParams()
  const status = filter?.status?.trim()
  if (status && status !== 'all') {
    params.set('status', status)
  }
  if (filter?.assigned_to !== undefined && filter.assigned_to > 0) {
    params.set('assigned_to', String(filter.assigned_to))
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await apiRequest<{ items?: Incident[] | null }>(
    `/api/v1/incidents${query}`,
    { token }
  )
  return res.items ?? []
}

export async function fetchIncidentDetail(id: string, token?: string): Promise<Incident> {
  return apiRequest<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}`, {
    token,
  })
}

export async function assignIncident(
  id: string,
  staffId: number,
  token?: string
): Promise<Incident> {
  return apiRequest<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ staff_id: staffId }),
    token,
  })
}

export async function resolveIncident(
  id: string,
  resolutionNote: string,
  token?: string
): Promise<Incident> {
  return apiRequest<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolution_note: resolutionNote.trim() }),
    token,
  })
}

export const incidentsApi = {
  fetchIncidents,
  fetchIncidentDetail,
  assignIncident,
  resolveIncident,
}
