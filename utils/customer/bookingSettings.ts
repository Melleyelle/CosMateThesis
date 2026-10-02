import { createClient } from '@/utils/client'
import { addDays } from '@/utils/dateUtils'

export type BookingSettings = {
  bufferDaysBefore: number
  bufferDaysAfter: number
  minLeadDays: number
  shippingFlatRate: number
  lateFeePerDay: number
  maxPendingOrders: number | null // null = ฐานข้อมูลยังไม่มีคอลัมน์ max_pending_orders
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  bufferDaysBefore: 1,
  bufferDaysAfter: 1,
  minLeadDays: 1,
  shippingFlatRate: 0,
  lateFeePerDay: 0,
  maxPendingOrders: null,
}

function settingValue(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function customerHeldDays(packageDays: number | null | undefined, settings: BookingSettings): number {
  return Math.max(0, packageDays ?? 0) + settings.bufferDaysBefore + settings.bufferDaysAfter
}

export function getRentalTimeline(useDate: string, packageDays: number, settings: BookingSettings) {
  return {
    receiveDate: addDays(useDate, -settings.bufferDaysBefore),
    useDate,
    returnBy: addDays(useDate, Math.max(0, packageDays - 1)),
  }
}

export async function fetchBookingSettings(): Promise<BookingSettings> {
  const supabase = createClient()
  if (!supabase) return DEFAULT_BOOKING_SETTINGS

  const { data, error } = await supabase
    .from('booking_settings')
    // ใช้ * เพื่อให้คอลัมน์เสริม (max_pending_orders) ที่อาจยังไม่มี ไม่ทำให้ทั้ง query error
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error || !data) return DEFAULT_BOOKING_SETTINGS

  return {
    bufferDaysBefore: settingValue(data.buffer_days_before, DEFAULT_BOOKING_SETTINGS.bufferDaysBefore),
    bufferDaysAfter: settingValue(data.buffer_days_after, DEFAULT_BOOKING_SETTINGS.bufferDaysAfter),
    minLeadDays: settingValue(data.min_lead_days, DEFAULT_BOOKING_SETTINGS.minLeadDays),
    shippingFlatRate: settingValue(data.shipping_flat_rate, DEFAULT_BOOKING_SETTINGS.shippingFlatRate),
    lateFeePerDay: settingValue(data.late_fee_per_day, DEFAULT_BOOKING_SETTINGS.lateFeePerDay),
    maxPendingOrders: data.max_pending_orders == null ? null : settingValue(data.max_pending_orders, 0) || null,
  }
}