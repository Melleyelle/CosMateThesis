import { createClient } from '@/utils/client'
import { fetchAllOrdersForAdmin, type OrderSummary } from '@/utils/customer/fetchOrders'
import {
  bufferBefore,
  fetchBookingSettings,
  type BookingSettings,
  type DeliveryMethod,
} from '@/utils/customer/bookingSettings'
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
  productCreatedAt: string | null
}

// รายการหักมัดจำ/ค่าปรับ (Step 17) — late_return = ค่าปรับคืนช้า, ที่เหลือ = ชุดเสียหาย/ของไม่ครบ
export type DeductionRow = {
  orderId: string
  orderItemId: string | null
  type: string
  amount: number
  createdAt: string
}

export type DashboardData = {
  orders: OrderSummary[]
  items: InventoryItem[]
  settings: BookingSettings
  reviews: (Review & { productName: string })[]
  ratingAvg: number | null
  ratingCount: number
  deductions: DeductionRow[]
}

// สภาพชุดจริงที่ไม่ใช่ available
export const CONDITION_LABEL: Record<string, string> = { cleaning: 'กำลังซัก', damaged: 'ซ่อม', retired: 'ปลดระวาง' }

type ItemRow = {
  id: string
  item_code: string
  condition_status: string
  product_variants: {
    size: string
    products: { id: string; name: string; status: string; created_at: string | null } | null
  } | null
}

export async function fetchDashboard(): Promise<{ data: DashboardData | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const [orders, itemsRes, settings, reviews, ratings, dedRes] = await Promise.all([
    fetchAllOrdersForAdmin(),
    supabase
      .from('product_items')
      .select('id, item_code, condition_status, product_variants ( size, products ( id, name, status, created_at ) )')
      .order('item_code'),
    fetchBookingSettings(),
    fetchAllReviewsForAdmin(),
    fetchRatingSummaries(),
    supabase.from('order_deductions').select('order_id, order_item_id, type, amount, created_at'),
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
    productCreatedAt: r.product_variants?.products?.created_at ?? null,
  }))

  // ตารางเสริม (Step 17) โหลดไม่ได้ → แผงที่ใช้แสดงว่าง แต่หน้าหลักยังใช้ได้
  type DedRow = { order_id: string; order_item_id: string | null; type: string; amount: number | string; created_at: string }
  const deductions = ((dedRes.error ? [] : dedRes.data ?? []) as DedRow[]).map((d) => ({
    orderId: d.order_id,
    orderItemId: d.order_item_id,
    type: d.type,
    amount: Number(d.amount),
    createdAt: d.created_at,
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
      deductions,
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
// รับเองที่ร้าน: เตรียมชุดให้พร้อมภายในวันใช้งาน (ลูกค้ามารับวันนั้น)
export function shipByDate(useDate: string, s: BookingSettings, method: DeliveryMethod = 'ship') {
  return method === 'pickup' ? useDate : addDays(useDate, -s.bufferDaysBefore - 1)
}

// ช่วงที่ชุดถูกล็อก — ตรงกับ blocked_during ใน order_items (รับเองไม่มีวันขนส่งก่อนวันใช้งาน)
export function lockRange(startDate: string, endDate: string, s: BookingSettings, method: DeliveryMethod = 'ship') {
  return { from: addDays(startDate, -bufferBefore(s, method)), to: addDays(endDate, s.bufferDaysAfter) }
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
      const r = lockRange(l.startDate, l.endDate, data.settings, o.deliveryMethod)
      const a = r.from > fromISO ? r.from : fromISO
      const b = r.to < toISO ? r.to : toISO
      if (a <= b) locked += dayDiff(a, b) + 1
    }
  }
  return locked / (rentable.length * days)
}

// สถิติจำนวนวันเช่า (v2): นับทุกรายการในออเดอร์ที่ชำระแล้ว ที่สั่งตั้งแต่ sinceISO
// ใช้ยอดที่บันทึกไว้ในรายการ ไม่คำนวณย้อนจากราคาชุดปัจจุบัน
export function rentalDaysStats(orders: OrderSummary[], sinceISO: string, maxDays: number) {
  const byDays = Array.from({ length: Math.max(1, maxDays) }, (_, i) => ({ days: i + 1, items: 0, extraFee: 0 }))
  let items = 0
  let totalDays = 0
  let baseRevenue = 0
  let extraRevenue = 0
  for (const o of orders) {
    if (!REVENUE.includes(o.status) || toISODate(new Date(o.createdAt)) < sinceISO) continue
    for (const l of o.lines) {
      items += 1
      totalDays += l.rentalDays
      baseRevenue += l.baseRentalPrice
      extraRevenue += l.extraDaysFee
      const bucket = byDays[Math.min(byDays.length, Math.max(1, l.rentalDays)) - 1]
      bucket.items += 1
      bucket.extraFee += l.extraDaysFee
    }
  }
  return { items, avgDays: items ? totalDays / items : null, baseRevenue, extraRevenue, byDays }
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
