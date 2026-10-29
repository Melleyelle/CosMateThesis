// ตัวเลขของ dashboard ที่ตอบ "ดูแล้วจะทำอะไรต่อ" (docs: dashboard-requirements)
// คำนวณจากข้อมูลที่ fetchDashboard() โหลดมาแล้วทั้งหมด ไม่ยิง query เพิ่ม
import type { OrderLine, OrderSummary } from '@/utils/customer/fetchOrders'
import { BLOCKING, REVENUE, dayDiff, lockRange, type DashboardData } from '@/utils/admin/fetchDashboard'
import { returnByDate } from '@/utils/admin/orderOps'
import { addDays, toISODate } from '@/utils/dateUtils'

const createdDay = (o: OrderSummary) => toISODate(new Date(o.createdAt))

// กลับถึงร้านแล้วแต่ยังตรวจสภาพไม่เสร็จ
const BACK_NOT_CHECKED = ['returned', 'inspecting'] as const
// ออเดอร์ที่จ่ายแล้วหรือรอตรวจสลิป = คิวจองจริง (รอชำระหมดอายุได้ใน 30 นาที ไม่นับ)
const UPCOMING = ['manual_review', 'paid'] as const

const isIn = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v)

// ---------------------------------------------------------------------------
// ทุกสัปดาห์ — เงิน
// ---------------------------------------------------------------------------

// รายได้ตามที่มา: ค่าเช่า+ค่าซัก (ตามวันที่สั่ง) / ค่าปรับคืนช้า / หักมัดจำ (ตามวันที่บันทึก)
export function incomeBySource(data: DashboardData, fromISO: string, toISOExclusive: string) {
  const inRange = (day: string) => day >= fromISO && day < toISOExclusive
  const rental = data.orders
    .filter((o) => REVENUE.includes(o.status) && inRange(createdDay(o)))
    .reduce((s, o) => s + o.rentalTotal + o.laundryTotal, 0)
  let lateFee = 0
  let damage = 0
  for (const d of data.deductions) {
    if (!inRange(toISODate(new Date(d.createdAt)))) continue
    if (d.type === 'late_return') lateFee += d.amount
    else damage += d.amount
  }
  return { rental, lateFee, damage }
}

// มัดจำที่ร้านถืออยู่ = เงินของลูกค้า ต้องเตรียมไว้โอนคืน
//   ออเดอร์ที่จ่ายแล้วแต่ยังไม่ปิด → มัดจำเต็ม · ตรวจเสร็จรอโอน → ยอดคืนจริง (หักแล้ว)
export function depositsHeld(data: DashboardData, today: string, days = 7) {
  let held = 0
  let pendingNow = 0
  let dueSoon = 0
  const soon = addDays(today, days)
  for (const o of data.orders) {
    if (o.refundStatus === 'pending' || o.refundStatus === 'failed') {
      const amount = o.refundAmount ?? 0
      held += amount
      pendingNow += amount
      continue
    }
    if (o.refundStatus || !['paid', 'shipped', 'active', 'returned', 'inspecting'].includes(o.status)) continue
    held += o.depositTotal
    // กลับถึงร้านแล้ว หรือครบกำหนดคืนภายในช่วงนี้ → ต้องโอนคืนเร็ว ๆ นี้ (ยอดเต็มก่อนหัก)
    const returnBy = returnByDate(o)
    if (isIn(BACK_NOT_CHECKED, o.status) || (returnBy && returnBy <= soon && o.status !== 'paid')) dueSoon += o.depositTotal
  }
  return { held, pendingNow, dueSoon: dueSoon + pendingNow }
}

// ---------------------------------------------------------------------------
// ทุกสัปดาห์ — คิว
// ---------------------------------------------------------------------------

// ออเดอร์ที่หมดอายุเพราะไม่จ่ายในเวลา (ไม่นับที่ยังรอชำระอยู่ เพราะยังไม่รู้ผล)
export function expiredRate(orders: OrderSummary[], today: string, days = 30) {
  const since = addDays(today, -(days - 1))
  const recent = orders.filter((o) => createdDay(o) >= since && o.status !== 'pending_payment' && o.status !== 'awaiting_id')
  const expired = recent.filter((o) => o.status === 'expired').length
  return { expired, total: recent.length, rate: recent.length ? expired / recent.length : null }
}

// ---------------------------------------------------------------------------
// ทุกเดือน — สต็อกชุด
// ---------------------------------------------------------------------------

export type SizeUtilization = {
  productId: string
  productName: string
  size: string
  units: number
  rate: number
}

// อัตราการใช้งานรายชุด×ไซส์ ย้อนหลัง days วัน: วันที่ชุดจริงถูกล็อก ÷ (จำนวนตัว × จำนวนวัน)
// ไม่นับตัวที่ปลดระวางแล้ว
export function utilizationBySize(data: DashboardData, today: string, days = 30): SizeUtilization[] {
  const from = addDays(today, -(days - 1))
  type Group = SizeUtilization & { codes: Set<string>; locked: number }
  const groups = new Map<string, Group>()
  for (const i of data.items) {
    if (!i.productActive || !i.productId || i.condition === 'retired') continue
    const key = `${i.productId}|${i.size ?? ''}`
    const g = groups.get(key) ?? { productId: i.productId, productName: i.productName, size: i.size ?? '-', units: 0, rate: 0, codes: new Set<string>(), locked: 0 }
    g.units += 1
    g.codes.add(i.itemCode)
    groups.set(key, g)
  }
  const groupByCode = new Map<string, Group>()
  for (const g of groups.values()) for (const c of g.codes) groupByCode.set(c, g)

  for (const o of data.orders) {
    if (!BLOCKING.includes(o.status) || o.status === 'pending_payment' || o.status === 'awaiting_id') continue
    for (const l of o.lines) {
      const g = l.itemCode ? groupByCode.get(l.itemCode) : undefined
      if (!g) continue
      const r = lockRange(l.startDate, l.endDate, data.settings, o.deliveryMethod)
      const a = r.from > from ? r.from : from
      const b = r.to < today ? r.to : today
      if (a <= b) g.locked += dayDiff(a, b) + 1
    }
  }
  return Array.from(groups.values())
    .map(({ productId, productName, size, units, locked }) => ({ productId, productName, size, units, rate: locked / (units * days) }))
    .sort((a, b) => b.rate - a.rate)
}

export type IdleCostume = {
  productId: string
  productName: string
  units: number
  lastRentedEnd: string | null // null = ไม่เคยถูกเช่า
}

// ชุดที่ไม่มีใครเช่าเลย days วัน (นับทั้งที่เช่าไปแล้วและที่จองล่วงหน้า) — ไม่นับชุดที่เพิ่งเพิ่มเข้าคลัง
export function idleCostumes(data: DashboardData, today: string, days = 60): IdleCostume[] {
  const since = addDays(today, -days)
  const products = new Map<string, IdleCostume & { createdAt: string | null }>()
  for (const i of data.items) {
    if (!i.productActive || !i.productId || i.condition === 'retired') continue
    const p = products.get(i.productId) ?? { productId: i.productId, productName: i.productName, units: 0, lastRentedEnd: null, createdAt: i.productCreatedAt }
    p.units += 1
    products.set(i.productId, p)
  }
  const busy = new Set<string>()
  for (const o of data.orders) {
    if (!REVENUE.includes(o.status) && !isIn(UPCOMING, o.status)) continue
    for (const l of o.lines) {
      const p = l.productId ? products.get(l.productId) : undefined
      if (!p) continue
      if (l.endDate >= since) busy.add(p.productId)
      if (!p.lastRentedEnd || l.endDate > p.lastRentedEnd) p.lastRentedEnd = l.endDate
    }
  }
  return Array.from(products.values())
    .filter((p) => !busy.has(p.productId) && (!p.createdAt || toISODate(new Date(p.createdAt)) <= since))
    .map(({ productId, productName, units, lastRentedEnd }) => ({ productId, productName, units, lastRentedEnd }))
    .sort((a, b) => (a.lastRentedEnd ?? '').localeCompare(b.lastRentedEnd ?? ''))
}

export type DamageSummary = {
  byType: { type: string; count: number; amount: number }[]
  byCostume: { productId: string | null; productName: string; count: number; types: string[] }[]
}

// ชุดเสียหาย/ของไม่ครบ ย้อนหลัง days วัน แยกตามสาเหตุและตามชุด (ไม่นับค่าปรับคืนช้า)
export function damageSummary(data: DashboardData, today: string, days = 90): DamageSummary {
  const since = addDays(today, -days)
  const lineById = new Map<string, OrderLine>()
  const ordersById = new Map(data.orders.map((o) => [o.id, o]))
  for (const o of data.orders) for (const l of o.lines) lineById.set(l.id, l)

  const byType = new Map<string, { type: string; count: number; amount: number }>()
  const byCostume = new Map<string, DamageSummary['byCostume'][number]>()
  for (const d of data.deductions) {
    if (d.type === 'late_return' || toISODate(new Date(d.createdAt)) < since) continue
    const t = byType.get(d.type) ?? { type: d.type, count: 0, amount: 0 }
    t.count += 1
    t.amount += d.amount
    byType.set(d.type, t)

    // ไม่ได้ระบุรายการ แต่ออเดอร์มีชุดเดียว → รู้ว่าเป็นชุดไหน
    const parents = ordersById.get(d.orderId)?.lines.filter((l) => !l.parentLineId) ?? []
    const line = (d.orderItemId && lineById.get(d.orderItemId)) || (parents.length === 1 ? parents[0] : null)
    const key = line?.productId ?? `order:${d.orderId}`
    const c = byCostume.get(key) ?? {
      productId: line?.productId ?? null,
      productName: line?.productName ?? `หลายชุดใน ${ordersById.get(d.orderId)?.orderNumber ?? 'ออเดอร์'}`,
      count: 0,
      types: [],
    }
    c.count += 1
    if (!c.types.includes(d.type)) c.types.push(d.type)
    byCostume.set(key, c)
  }
  return {
    byType: Array.from(byType.values()).sort((a, b) => b.count - a.count),
    byCostume: Array.from(byCostume.values()).sort((a, b) => b.count - a.count),
  }
}
