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
}

function settingValue(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

// วันใส่ที่เร็วที่สุด (นับจากวันนี้) — ตรงกับ greatest(min_lead_days, buffer_days_before) ใน SQL
export function minStartOffset(settings: BookingSettings): number {
  return Math.max(settings.minLeadDays, settings.bufferDaysBefore)
}

// จำนวนวันเช่าที่ใช้ได้ (ปัดเข้าช่วง min–max) — ค่าที่ไม่ใช่ตัวเลขถือเป็นค่าต่ำสุด
export function clampRentalDays(days: unknown, settings: BookingSettings): number {
  const n = Math.floor(Number(days))
  if (!Number.isFinite(n)) return settings.minRentalDays
  return Math.min(settings.maxRentalDays, Math.max(settings.minRentalDays, n))
}

// buffer ก่อน/หลัง (ขนส่ง ตรวจ ซัก) กันคิวอยู่ในฐานข้อมูล แต่ไม่นับเป็นวันเช่าที่ลูกค้าเห็น
export function getRentalTimeline(useDate: string, rentalDays: number, settings: BookingSettings) {
  return {
    receiveDate: addDays(useDate, -settings.bufferDaysBefore),
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
  }
}
