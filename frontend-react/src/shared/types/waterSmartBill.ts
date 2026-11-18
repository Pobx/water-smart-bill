export interface OrganizationInfo {
  org_code: string
  org_name: string
  tambon_name: string
  district_name: string
  province_name: string
  zipcode: string
  phone: string
  dept_name: string
  vat: number
}

export interface VillageZone {
  id: number
  moo_no: number
  zone_name: string
  tambon_name: string
  subzone_name: string
}

export interface Homeowner {
  id: number
  prefix: string
  firstname: string
  lastname: string
  house_no: string
  zone_id: number
  zone_name: string
  tambon_name: string
  phone: string
  line_user_id: string
  image: string
  avatar_url: string
}

export interface WaterMeterItem {
  meter_id: number
  meternumber: string
  factory_no: string
  user_id: number
  homeowner_name: string
  house_no: string
  zone_id: number
  zone_name: string
  last_meter_recording: number
  status: 'active' | 'cutmeter'
}

export interface InvoiceItem {
  id: number
  inv_no: string
  client_reading_id?: string
  period_name: string
  meter_id: number
  meternumber: string
  homeowner_name: string
  house_no: string
  zone_name: string
  lastmeter: number
  currentmeter: number
  water_used: number
  paid: number
  reserve_meter: number
  vat: number
  totalpaid: number
  reading_photo_url: string
  ocr_text: string
  ocr_confidence: number
  status: 'invoice' | 'paid'
  payment_method?: string
  receipt_no?: string
  paid_at?: string
  cashier_id?: number
  recorded_at: string
}

export type WaterInvoiceItem = InvoiceItem

export function makeDefaultAvatarDataUri(name: string): string {
  void name
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" rx="60" fill="#0284c7"/><circle cx="60" cy="46" r="20" fill="#ffffff" opacity="0.95"/><path d="M26,104 C26,82 40,74 60,74 C80,74 94,82 94,104 Z" fill="#ffffff" opacity="0.95"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
