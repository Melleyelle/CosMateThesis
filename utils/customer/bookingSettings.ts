import { createClient } from '@/utils/client'
import { addDays } from '@/utils/dateUtils'

export type BookingSettings = {
  bufferDaysBefore: number
  bufferDaysAfter: number
  minLeadDays: number
  shippingFlatRate: number
  lateFeePerDay: number
  maxPendingOrders: number | null // null = ฐานข้อมูลยังไม่มีคอลัมน์ max_pending_orders
  // ลูกค้าเลือกจำนวนวันเช่าเอง (v2) — อ่านจาก app_settings ผ่าน get_rental_day_settings()
  minRentalDays: number
  maxRentalDays: number
  extraDayRate: number // ค่าเช่าเพิ่มต่อวันตั้งแต่วันที่ 2 (เช่าทั้งชุด) และเป็นเพดานของการเช่าแยกชิ้น
  pieceExtraDayPercent: number // ค่าเช่าเพิ่มต่อวันของการเช่าแยกชิ้น เป็น % ของราคาชิ้นรวม
  // รับเองที่ร้าน (v3) — pickupLocation = null คือร้านไม่เปิดให้รับเอง (ซ่อนตัวเลือก)
  pickupLeadDays: number
  pickupCutoffHour: number // จองหลังเวลานี้ (เวลาไทย) รับวันนี้ไม่ได้ — ใช้เมื่อ pickupLeadDays = 0
  pickupLocation: PickupLocation | null
}

// จัดส่ง (EMS) หรือ รับเองที่ร้าน (ลูกค้ามารับเอง / ลูกค้าเรียกไรเดอร์มารับ)
export type DeliveryMethod = 'ship' | 'pickup'

export type PickupLocation = {
  name: string
  address: string
  hours: string
  phone: string
  mapUrl: string
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  bufferDaysBefore: 1,
  bufferDaysAfter: 1,
  minLeadDays: 1,
  shippingFlatRate: 0,
  lateFeePerDay: 0,
  maxPendingOrders: null,
  minRentalDays: 1,
  maxRentalDays: 10,
  extraDayRate: 100,
  pieceExtraDayPercent: 50,
  pickupLeadDays: 0,
  pickupCutoffHour: 15,
  pickupLocation: null,
}

function settingValue(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function bangkokHour(): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bangkok' }).format(new Date()))
}

// วันใส่ที่เร็วที่สุด นับจากวันนี้ — ตรงกับ public.earliest_start_date() ใน SQL
//   จัดส่ง:       greatest(min_lead_days, buffer_days_before)
//   รับเองที่ร้าน: pickup_lead_days (+1 ถ้า = 0 และเลยเวลาตัดรอบแล้ว)
export function minStartOffset(settings: BookingSettings, method: DeliveryMethod = 'ship'): number {
  if (method === 'pickup') {
    const afterCutoff = settings.pickupLeadDays === 0 && bangkokHour() >= settings.pickupCutoffHour
    return settings.pickupLeadDays + (afterCutoff ? 1 : 0)
  }
  return Math.max(settings.minLeadDays, settings.bufferDaysBefore)
}

// วันกันไว้ก่อนวันใส่ (ขนส่ง) — รับเองที่ร้านไม่มี
export function bufferBefore(settings: BookingSettings, method: DeliveryMethod = 'ship'): number {
  return method === 'pickup' ? 0 : settings.bufferDaysBefore
}

export function shippingFee(settings: BookingSettings, method: DeliveryMethod): number {
  return method === 'pickup' ? 0 : settings.shippingFlatRate
}

// จำนวนวันเช่าที่ใช้ได้ (ปัดเข้าช่วง min–max) — ค่าที่ไม่ใช่ตัวเลขถือเป็นค่าต่ำสุด
export function clampRentalDays(days: unknown, settings: BookingSettings): number {
  const n = Math.floor(Number(days))
  if (!Number.isFinite(n)) return settings.minRentalDays
  return Math.min(settings.maxRentalDays, Math.max(settings.minRentalDays, n))
}

// buffer ก่อน/หลัง (ขนส่ง ตรวจ ซัก) กันคิวอยู่ในฐานข้อมูล แต่ไม่นับเป็นวันเช่าที่ลูกค้าเห็น
// รับเองที่ร้าน: วันรับชุด = วันใส่
export function getRentalTimeline(
  useDate: string,
  rentalDays: number,
  settings: BookingSettings,
  method: DeliveryMethod = 'ship',
) {
  return {
    receiveDate: addDays(useDate, -bufferBefore(settings, method)),
    useDate,
    returnBy: addDays(useDate, Math.max(0, rentalDays - 1)),
  }
}

export async function fetchBookingSettings(): Promise<BookingSettings> {
  const supabase = createClient()
  if (!supabase) return DEFAULT_BOOKING_SETTINGS

  const [{ data, error }, rental] = await Promise.all([
    supabase
      .from('booking_settings')
      // ใช้ * เพื่อให้คอลัมน์เสริม (max_pending_orders) ที่อาจยังไม่มี ไม่ทำให้ทั้ง query error
      .select('*')
      .limit(1)
      .maybeSingle(),
    supabase.rpc('get_rental_day_settings'),
  ])

  const base = error || !data ? DEFAULT_BOOKING_SETTINGS : {
    ...DEFAULT_BOOKING_SETTINGS,
    bufferDaysBefore: settingValue(data.buffer_days_before, DEFAULT_BOOKING_SETTINGS.bufferDaysBefore),
    bufferDaysAfter: settingValue(data.buffer_days_after, DEFAULT_BOOKING_SETTINGS.bufferDaysAfter),
    minLeadDays: settingValue(data.min_lead_days, DEFAULT_BOOKING_SETTINGS.minLeadDays),
    shippingFlatRate: settingValue(data.shipping_flat_rate, DEFAULT_BOOKING_SETTINGS.shippingFlatRate),
    lateFeePerDay: settingValue(data.late_fee_per_day, DEFAULT_BOOKING_SETTINGS.lateFeePerDay),
    maxPendingOrders: data.max_pending_orders == null ? null : settingValue(data.max_pending_orders, 0) || null,
  }

  const r = (rental.error ? null : rental.data) as Record<string, unknown> | null
  if (!r) return base
  const minRentalDays = Math.max(1, settingValue(r.min_rental_days, DEFAULT_BOOKING_SETTINGS.minRentalDays))
  return {
    ...base,
    minRentalDays,
    maxRentalDays: Math.max(minRentalDays, settingValue(r.max_rental_days, DEFAULT_BOOKING_SETTINGS.maxRentalDays)),
    extraDayRate: settingValue(r.extra_day_rate, DEFAULT_BOOKING_SETTINGS.extraDayRate),
    pieceExtraDayPercent: settingValue(r.piece_extra_day_percent, DEFAULT_BOOKING_SETTINGS.pieceExtraDayPercent),
    pickupLeadDays: settingValue(r.pickup_lead_days, DEFAULT_BOOKING_SETTINGS.pickupLeadDays),
    pickupCutoffHour: settingValue(r.pickup_cutoff_hour, DEFAULT_BOOKING_SETTINGS.pickupCutoffHour),
    pickupLocation: parsePickupLocation(r.pickup_location),
  }
}

// ไม่มีชื่อหรือที่อยู่ร้าน = ถือว่าร้านไม่เปิดให้รับเอง
function parsePickupLocation(value: unknown): PickupLocation | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const text = (k: string) => (typeof v[k] === 'string' ? (v[k] as string).trim() : '')
  if (!text('name') || !text('address')) return null
  return { name: text('name'), address: text('address'), hours: text('hours'), phone: text('phone'), mapUrl: text('map_url') }
}
