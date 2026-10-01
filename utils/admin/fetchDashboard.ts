import { createClient } from '@/utils/client'
import { fetchAllOrdersForAdmin, type OrderSummary } from '@/utils/customer/fetchOrders'
import { fetchBookingSettings, type BookingSettings } from '@/utils/customer/bookingSettings'
import { fetchAllReviewsForAdmin, fetchRatingSummaries, type Review } from '@/utils/customer/reviews'
import { addDays, parseISODate, todayISO, toISODate } from '@/utils/dateUtils'
import type { OrderStatus } from '@/utils/orderStatus'

export type InventoryItem = {
  id: string
  itemCode: string
  condition: string
  size: string | null
  productId: string | null
  productName: string
  productActive: boolean
}

export type DashboardData = {
  orders: OrderSummary[]
  items: InventoryItem[]
  settings: BookingSettings
  reviews: (Review & { productName: string })[]
  ratingAvg: number | null
  ratingCount: number
}

type ItemRow = {
  id: string
  item_code: string
  condition_status: string
  product_variants: { size: string; products: { id: string; name: string; status: string } | null } | null
}

export async function fetchDashboard(): Promise<{ data: DashboardData | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const [orders, itemsRes, settings, reviews, ratings] = await Promise.all([
    fetchAllOrdersForAdmin(),
    supabase
      .from('product_items')
      .select('id, item_code, condition_status, product_variants ( size, products ( id, name, status ) )')
      .order('item_code'),
    fetchBookingSettings(),
    fetchAllReviewsForAdmin(),
    fetchRatingSummaries(),
  ])

  if (orders.error) return { data: null, error: orders.error }
  if (itemsRes.error) return { data: null, error: itemsRes.error.message }

  const items = ((itemsRes.data ?? []) as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    itemCode: r.item_code,
    condition: r.condition_status,
    size: r.product_variants?.size ?? null,
    productId: r.product_variants?.products?.id ?? null,
    productName: r.product_variants?.products?.name ?? 'ไม่ทราบชื่อชุด',
    productActive: r.product_variants?.products?.status === 'active',
  }))

  const summaries = Object.values(ratings)
  const ratingCount = summaries.reduce((s, r) => s + r.reviewCount, 0)
  const ratingAvg = ratingCount
    ? summaries.reduce((s, r) => s + r.avgRating * r.reviewCount, 0) / ratingCount
    : null

  return {
    data: {
      orders: orders.data,
      items,
      settings,
      reviews: reviews.error ? [] : reviews.data,
      ratingAvg,
      ratingCount,
    },
    error: null,
  }
}

// ---------------------------------------------------------------------------
// ตัวช่วยคำนวณ (ใช้กติกาเดียวกับ create_booking เพื่อให้ตัวเลขตรงกับฐานข้อมูล)
// ---------------------------------------------------------------------------

// ออเดอร์ที่ยังล็อกชุดอยู่ (is_blocking = true ในฐานข้อมูล)
export const BLOCKING: OrderStatus[] = [
  'pending_payment',
  'manual_review',
  'paid',
  'shipped',
  'active',
  'returned',
  'inspecting',
  'completed',
]

// ออเดอร์ที่ "ได้เงินแล้ว" (ใช้คิดรายได้) — ไม่นับรอชำระ/ยกเลิก/หมดอายุ
export const REVENUE: OrderStatus[] = ['paid', 'shipped', 'active', 'returned', 'inspecting', 'completed']

export function dayDiff(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86_400_000)
}

// วันที่ต้องส่งของออก: ลูกค้าต้องได้รับ (วันใช้งาน - buffer ก่อน) และ EMS ใช้ 1 วัน
export function shipByDate(useDate: string, s: BookingSettings) {
  return addDays(useDate, -s.bufferDaysBefore - 1)
}

export function lockRange(startDate: string, endDate: string, s: BookingSettings) {
  return { from: addDays(startDate, -s.bufferDaysBefore), to: addDays(endDate, s.bufferDaysAfter) }
}

// อัตราการจองชุด: วันที่ชุดถูกล็อก ÷ (จำนวนชุดที่พร้อมให้เช่า × จำนวนวัน) ในช่วงที่กำหนด
export function utilization(data: DashboardData, fromISO: string, days: number): number | null {
  const rentable = data.items.filter((i) => i.productActive && i.condition === 'available')
  if (rentable.length === 0) return null
  const toISO = addDays(fromISO, days - 1)
  const codes = new Set(rentable.map((i) => i.itemCode))
  let locked = 0
  for (const o of data.orders) {
    if (!BLOCKING.includes(o.status)) continue
    for (const l of o.lines) {
      if (!l.itemCode || !codes.has(l.itemCode)) continue
      const r = lockRange(l.startDate, l.endDate, data.settings)
      const a = r.from > fromISO ? r.from : fromISO
      const b = r.to < toISO ? r.to : toISO
      if (a <= b) locked += dayDiff(a, b) + 1
    }
  }
  return locked / (rentable.length * days)
}

// รายได้ค่าเช่า + ค่าซักต่อสัปดาห์ (เริ่มวันจันทร์) ย้อนหลัง n สัปดาห์ นับตามวันที่สั่ง
export function weeklyRevenue(orders: OrderSummary[], weeks: number) {
  const today = parseISODate(todayISO())
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(monday)
    start.setDate(monday.getDate() - 7 * (weeks - 1 - i))
    return { start: toISODate(start), total: 0, orders: 0 }
  })
  const firstStart = buckets[0].start
  for (const o of orders) {
    if (!REVENUE.includes(o.status)) continue
    const day = toISODate(new Date(o.createdAt))
    if (day < firstStart) continue
    const idx = Math.min(weeks - 1, Math.floor(dayDiff(firstStart, day) / 7))
    buckets[idx].total += o.rentalTotal + o.laundryTotal
    buckets[idx].orders += 1
  }
  return buckets
}
