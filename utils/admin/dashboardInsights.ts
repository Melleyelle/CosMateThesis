// ตัวเลขของ dashboard ที่ตอบ "ดูแล้วจะทำอะไรต่อ" (docs: dashboard-requirements)
// คำนวณจากข้อมูลที่ fetchDashboard() โหลดมาแล้วทั้งหมด ไม่ยิง query เพิ่ม
import type { OrderSummary } from '@/utils/customer/fetchOrders'
import { REVENUE, type DashboardData } from '@/utils/admin/fetchDashboard'
import { returnByDate } from '@/utils/admin/orderOps'
import { addDays, toISODate } from '@/utils/dateUtils'

const createdDay = (o: OrderSummary) => toISODate(new Date(o.createdAt))

// กลับถึงร้านแล้วแต่ยังตรวจสภาพไม่เสร็จ
const BACK_NOT_CHECKED = ['returned', 'inspecting'] as const

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
