import { createClient } from '@/utils/client'
import { addDays } from '@/utils/dateUtils'

export type BookingSettings = {
  shippingFlatRate: number
  bufferDaysBefore: number
  bufferDaysAfter: number
  minLeadDays: number
  lateFeePerDay: number
  maxPendingOrders: number
}

// ค่าสำรองใช้แสดงผลเท่านั้น ถ้าเรียก get_booking_settings() ไม่สำเร็จ
// ตัวเลขจริงที่ใช้คิดเงิน/ล็อกวันอยู่ใน create_booking() ฝั่งฐานข้อมูลเสมอ
export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  shippingFlatRate: 100,
  bufferDaysBefore: 1,
  bufferDaysAfter: 2,
  minLeadDays: 3,
  lateFeePerDay: 100,
  maxPendingOrders: 2,
}

export async function fetchBookingSettings(): Promise<BookingSettings> {
  const supabase = createClient()
  if (!supabase) return DEFAULT_BOOKING_SETTINGS

  const { data, error } = await supabase.rpc('get_booking_settings')
  if (error || !data) return DEFAULT_BOOKING_SETTINGS

  const s = data as Record<string, number | null>
  const d = DEFAULT_BOOKING_SETTINGS
  return {
    shippingFlatRate: s.shipping_flat_rate ?? d.shippingFlatRate,
    bufferDaysBefore: s.buffer_days_before ?? d.bufferDaysBefore,
    bufferDaysAfter: s.buffer_days_after ?? d.bufferDaysAfter,
    minLeadDays: s.min_lead_days ?? d.minLeadDays,
    lateFeePerDay: s.late_fee_per_day ?? d.lateFeePerDay,
    maxPendingOrders: s.max_pending_orders_per_user ?? d.maxPendingOrders,
  }
}

export type RentalTimeline = {
  receiveDate: string // วันที่ลูกค้าได้รับชุด
  useDate: string // วันใช้งาน
  returnBy: string // วันสุดท้ายที่ต้องส่งชุดคืน (= end_date ในฐานข้อมูล)
  lockStart: string
  lockEnd: string
}

// คำนวณแบบเดียวกับ create_booking(): ล็อก [ใช้งาน - before, ใช้งาน + package_days - 1 + after]
export function getRentalTimeline(useDate: string, packageDays: number, settings: BookingSettings): RentalTimeline {
  const returnBy = addDays(useDate, packageDays - 1)
  return {
    receiveDate: addDays(useDate, -settings.bufferDaysBefore),
    useDate,
    returnBy,
    lockStart: addDays(useDate, -settings.bufferDaysBefore),
    lockEnd: addDays(returnBy, settings.bufferDaysAfter),
  }
}

// จำนวนวันที่แสดงหลังราคา เช่น "฿350 / 3 วัน"
// นับเฉพาะวันที่ชุดอยู่กับลูกค้าจริง (วันรับ + วันใช้ + วันส่งคืน) ไม่รวม buffer หลังคืนของร้าน
// ถ้าอยากแสดงรวม buffer (5 วันตามดีไซน์) เปลี่ยนเป็น: before + packageDays + after
export function customerHeldDays(packageDays: number, settings: BookingSettings): number {
  return settings.bufferDaysBefore + packageDays
}
