import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { liffPortalApi, type Incident, type IncidentType } from './liffPortalApi'

const MAX_DESCRIPTION_LENGTH = 500
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const INCIDENT_TYPE_OPTIONS: ReadonlyArray<{
  value: IncidentType
  label: string
  icon: string
}> = [
  { value: 'no_water', label: 'น้ำไม่ไหล', icon: '🚱' },
  { value: 'cloudy_water', label: 'น้ำขุ่น', icon: '💧' },
  { value: 'broken_pipe', label: 'ท่อแตก', icon: '🔧' },
  { value: 'other', label: 'อื่น ๆ', icon: '📝' },
]

export interface ReportIncidentFormProps {
  token?: string
  onSubmit?: (formData: FormData) => Promise<Incident | void>
  onSuccess?: (incident: Incident | void) => void
  onCancel?: () => void
}

export function ReportIncidentForm({
  token,
  onSubmit,
  onSuccess,
  onCancel,
}: ReportIncidentFormProps) {
  const descriptionId = useId()
  const photoInputId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [incidentType, setIncidentType] = useState<IncidentType | null>(null)
  const [description, setDescription] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'saved' | 'unavailable'>('idle')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!photo || typeof URL.createObjectURL !== 'function') {
      setPhotoPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(photo)
    setPhotoPreviewUrl(objectUrl)
    return () => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [photo])

  const handleRequestGps = () => {
    setErrorMessage(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
      setGpsStatus('unavailable')
      return
    }
    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setGpsStatus('saved')
      },
      () => {
        setCoords(null)
        setGpsStatus('unavailable')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!file) {
      setPhoto(null)
      return
    }

    const isAllowedMime =
      file.type.startsWith('image/') &&
      (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)

    if (!isAllowedMime) {
      setPhoto(null)
      event.target.value = ''
      setErrorMessage('รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ WebP เท่านั้น')
      return
    }

    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
      setPhoto(null)
      event.target.value = ''
      setErrorMessage('ขนาดไฟล์รูปภาพต้องไม่เกิน 10MB')
      return
    }

    setPhoto(file)
  }

  const handleRemovePhoto = () => {
    setPhoto(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!incidentType) {
      setErrorMessage('กรุณาเลือกประเภทเหตุที่ต้องการแจ้ง')
      return
    }

    const formData = new FormData()
    formData.append('incident_type', incidentType)
    formData.append('description', description.trim())
    if (coords) {
      formData.append('lat', String(coords.lat))
      formData.append('lng', String(coords.lng))
    }
    if (photo) {
      formData.append('photo', photo)
    }

    setIsSubmitting(true)
    try {
      const created = onSubmit
        ? await onSubmit(formData)
        : await liffPortalApi.submitIncident(formData, token)

      setSuccessMessage('ส่งแจ้งเหตุเรียบร้อยแล้ว เจ้าหน้าที่จะดำเนินการตรวจสอบโดยเร็ว')
      setIncidentType(null)
      setDescription('')
      setCoords(null)
      setGpsStatus('idle')
      setPhoto(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      onSuccess?.(created)
    } catch {
      setErrorMessage('ไม่สามารถส่งแจ้งเหตุได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">แจ้งเหตุขัดข้องน้ำประปา</h3>
          <p className="text-xs text-slate-500">ระบุประเภทเหตุ รายละเอียด และภาพประกอบ (ถ้ามี)</p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            ปิด
          </button>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
        >
          {successMessage}
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-xs font-bold text-slate-700">1. เลือกประเภทเหตุ</legend>
        <div className="grid grid-cols-2 gap-2">
          {INCIDENT_TYPE_OPTIONS.map((opt) => {
            const isSelected = incidentType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setIncidentType(opt.value)
                  setErrorMessage(null)
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                  isSelected
                    ? 'border-sky-600 bg-sky-50 text-sky-900 ring-1 ring-sky-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {opt.icon}
                </span>
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-700">2. รายละเอียดเพิ่มเติม (ไม่บังคับ)</div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRequestGps}
            disabled={gpsStatus === 'loading'}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <span aria-hidden="true">📍</span>
            <span>ใช้ตำแหน่งปัจจุบัน</span>
          </button>

          {gpsStatus === 'saved' && coords && (
            <span className="text-xs font-semibold text-emerald-700">
              ✅ ตำแหน่งถูกบันทึกแล้ว
            </span>
          )}
          {gpsStatus === 'unavailable' && (
            <span className="text-xs text-slate-500">
              ไม่สามารถระบุตำแหน่งได้ สามารถส่งแจ้งเหตุได้ตามปกติ
            </span>
          )}
        </div>

        <div>
          <label htmlFor={descriptionId} className="sr-only">
            รายละเอียดเหตุการณ์
          </label>
          <textarea
            id={descriptionId}
            rows={3}
            maxLength={MAX_DESCRIPTION_LENGTH}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
            placeholder="อธิบายเหตุการณ์..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
          />
          <div className="mt-1 text-right text-[11px] text-slate-400">
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={photoInputId}
            className="block text-xs font-semibold text-slate-700"
          >
            แนบรูปภาพประกอบ (JPEG, PNG, WebP ไม่เกิน 10MB)
          </label>
          <input
            ref={fileInputRef}
            id={photoInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handlePhotoChange}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-700 hover:file:bg-sky-100"
          />

          {photoPreviewUrl && (
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-2">
              <img
                src={photoPreviewUrl}
                alt="ตัวอย่างรูปภาพเหตุการณ์"
                className="h-20 w-20 rounded-lg object-cover"
              />
              <div className="flex flex-1 items-center justify-between gap-2 text-xs">
                <span className="truncate text-slate-700">{photo?.name}</span>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  ลบรูป
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-60"
        >
          {isSubmitting ? 'กำลังส่งแจ้งเหตุ...' : 'ส่งแจ้งเหตุ'}
        </button>
      </div>
    </form>
  )
}
