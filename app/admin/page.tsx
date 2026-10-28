'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowUUpLeftIcon,
  CheckCircleIcon,
  PackageIcon,
  ReceiptIcon,
} from '@phosphor-icons/react'
import AdminLayout from '../components/admin/AdminLayout'
import { Metric, MetricStrip, Panel, StatusBadge } from '../components/admin/ui'
import OccupancyBoard from '../components/admin/dashboard/OccupancyBoard'
import WeeklyRevenueChart from '../components/admin/dashboard/WeeklyRevenueChart'
import TopCostumes, { type TopCostume } from '../components/admin/dashboard/TopCostumes'
import RentalDaysChart from '../components/admin/dashboard/RentalDaysChart'
import { DamageByCause, IdleCostumes, UTIL_FULL, UtilizationBySize } from '../components/admin/dashboard/StockPanels'
import { StarDisplay } from '../components/customer/StarRating'
import {
  BLOCKING,
  dayDiff,
  fetchDashboard,
  rentalDaysStats,
  shipByDate,
  utilization,
  weeklyRevenue,
  type DashboardData,
} from '@/utils/admin/fetchDashboard'
import {
  damageSummary,
  depositsHeld,
  expiredRate,
  idleCostumes,
  incomeBySource,
  utilizationBySize,
} from '@/utils/admin/dashboardInsights'
import type { Tone } from '@/utils/admin/statusTone'
import type { OrderSummary } from '@/utils/customer/fetchOrders'
import { addDays, formatBaht, formatThaiDateWithWeekday, todayISO, toISODate } from '@/utils/dateUtils'

// หน้าแรกหลังร้าน แบ่งตามรอบที่เจ้าของร้านเปิดดู: ทุกเช้า / ทุกสัปดาห์ / ทุกเดือน
// ทุกแผงต้องตอบได้ว่า "ดูแล้วจะทำอะไรต่อ" — คำอธิบายใต้หัวแผงเขียนเป็นคู่ ข้อมูล → การตัดสินใจ

type Task = { order: OrderSummary; tone: Tone; when: string; sort: number }

function relativeHours(timestamp: string) {
  const h = Math.floor((Date.now() - new Date(timestamp).getTime()) / 3_600_000)
  if (h < 1) return 'เมื่อสักครู่'
  if (h < 24) return `${h} ชม.ที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

const orderHref = (o: OrderSummary) => `/admin/orders?q=${o.orderNumber}`

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboard().then(({ data: d, error: e }) => {
      if (e) setError(e)
      else setData(d)
    })
  }, [])

  const today = todayISO()

  // ---------------- ทุกเช้า: คิวงาน ----------------
  const queues = useMemo(() => {
    if (!data) return null
    const s = data.settings

    // เรื่องเงิน: คืนเงินที่ค้าง (ขึ้นก่อน เพราะเป็นเงินลูกค้า) + ตรวจยอดที่ลูกค้าแจ้งโอน
    const refunds: Task[] = data.orders
      .filter((o) => o.refundStatus === 'pending' || o.refundStatus === 'failed')
      .map((o) => ({
        order: o,
        tone: (o.refundStatus === 'failed' ? 'problem' : 'action') as Tone,
        when: o.refundStatus === 'failed' ? 'โอนคืนไม่สำเร็จ' : `คืนเงิน ${formatBaht(o.refundAmount ?? 0)}`,
        sort: -1e15 + Date.parse(o.updatedAt),
      }))
    const review: Task[] = [
      ...refunds,
      ...data.orders
        .filter((o) => o.status === 'manual_review')
        .map((o) => ({ order: o, tone: 'action' as Tone, when: `แจ้งโอน ${relativeHours(o.updatedAt)}`, sort: Date.parse(o.updatedAt) })),
    ].sort((a, b) => a.sort - b.sort)

    const ship: Task[] = data.orders
      .filter((o) => o.status === 'paid' && o.lines.length > 0)
      .map((o) => {
        const shipBy = o.lines.map((l) => shipByDate(l.startDate, s, o.deliveryMethod)).sort()[0]
        const diff = dayDiff(today, shipBy)
        const when =
          o.deliveryMethod === 'pickup'
            ? diff < 0 ? `ลูกค้ายังไม่มารับ ${-diff} วัน` : diff === 0 ? 'ลูกค้ามารับวันนี้' : `รับที่ร้าน ${formatThaiDateWithWeekday(shipBy)}`
            : diff < 0 ? `เลยกำหนดส่ง ${-diff} วัน` : diff === 0 ? 'ต้องส่งวันนี้' : diff === 1 ? 'ส่งพรุ่งนี้' : `ส่งภายใน ${formatThaiDateWithWeekday(shipBy)}`
        return { order: o, tone: (diff < 0 ? 'problem' : diff === 0 ? 'action' : 'waiting') as Tone, when, sort: diff }
      })
      .sort((a, b) => a.sort - b.sort)

    const back: Task[] = data.orders
      .flatMap((o): Task[] => {
        if (o.status === 'returned' || o.status === 'inspecting') {
          return [{ order: o, tone: 'action', when: o.status === 'returned' ? 'ได้รับคืนแล้ว รอตรวจสภาพ' : 'กำลังตรวจสภาพ', sort: -100 }]
        }
        if ((o.status === 'shipped' || o.status === 'active') && o.lines.length > 0) {
          const returnBy = o.lines.map((l) => l.endDate).sort().slice(-1)[0]
          const diff = dayDiff(today, returnBy) // ลูกค้าส่งคืนภายในวันนี้ = 0
          if (diff > 2) return []
          const when =
            diff < -1 ? `เกินกำหนดคืน ${-diff - 1} วัน` : diff <= 0 ? 'ควรได้รับคืนวันนี้–พรุ่งนี้' : `ลูกค้าส่งคืนภายใน ${formatThaiDateWithWeekday(returnBy)}`
          return [{ order: o, tone: diff < -1 ? 'problem' : 'progress', when, sort: diff }]
        }
        return []
      })
      .sort((a, b) => a.sort - b.sort)

    return { review, ship, back }
  }, [data, today])

  // ---------------- ทุกสัปดาห์: เงินและคิว ----------------
  const weekly = useMemo(() => {
    if (!data) return null
    const monthStart = `${today.slice(0, 7)}-01`
    const lastMonthStart = toISODate(new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1))
    const createdDay = (o: OrderSummary) => toISODate(new Date(o.createdAt))
    const tomorrow = addDays(today, 1)

    return {
      income: incomeBySource(data, monthStart, tomorrow),
      incomeLast: incomeBySource(data, lastMonthStart, monthStart),
      deposits: depositsHeld(data, today, 7),
      orders: data.orders.filter((o) => BLOCKING.includes(o.status) && createdDay(o) >= monthStart).length,
      util: utilization(data, today, 30),
      rentable: data.items.filter((i) => i.productActive && i.condition === 'available').length,
      expired: expiredRate(data.orders, today, 30),
    }
  }, [data, today])

  const weeks = useMemo(() => (data ? weeklyRevenue(data.orders, 8) : []), [data])

  // ---------------- ทุกเดือน: สต็อกชุด ----------------
  const monthly = useMemo(() => {
    if (!data) return null
    return {
      sizes: utilizationBySize(data, today, 30),
      idle: idleCostumes(data, today, 60),
      damage: damageSummary(data, today, 90),
      days: rentalDaysStats(data.orders, addDays(today, -90), data.settings.maxRentalDays),
    }
  }, [data, today])

  const top: TopCostume[] = useMemo(() => {
    if (!data) return []
    const since = addDays(today, -90)
    const map = new Map<string, TopCostume>()
    for (const o of data.orders) {
      if (!BLOCKING.includes(o.status)) continue
      for (const l of o.lines) {
        if (!l.productId || l.startDate < since) continue
        const cur = map.get(l.productId) ?? {
          productId: l.productId,
          name: l.productName,
          coverImageUrl: l.coverImageUrl,
          bookings: 0,
          rating: null,
        }
        cur.bookings += 1
        map.set(l.productId, cur)
      }
    }
    const ratingOf = new Map<string, { sum: number; n: number }>()
    for (const r of data.reviews) {
      if (r.isHidden) continue
      const cur = ratingOf.get(r.productId) ?? { sum: 0, n: 0 }
      ratingOf.set(r.productId, { sum: cur.sum + r.rating, n: cur.n + 1 })
    }
    return Array.from(map.values())
      .map((t) => {
        const r = ratingOf.get(t.productId)
        return { ...t, rating: r ? r.sum / r.n : null }
      })
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5)
  }, [data, today])

  // รีวิว 1–2 ดาวที่ยังไม่ตอบขึ้นก่อน แล้วตามด้วยรีวิวล่าสุด
  const needsReply = (r: DashboardData['reviews'][number]) => !r.isHidden && r.rating <= 2 && !r.adminReply
  const reviews = useMemo(
    () => (data ? [...data.reviews.filter(needsReply), ...data.reviews.filter((r) => !needsReply(r))] : []),
    [data],
  )
  const unansweredLow = data ? data.reviews.filter(needsReply).length : 0

  const taskCount = queues ? queues.review.length + queues.ship.length + queues.back.filter((t) => t.tone !== 'progress').length : 0
  const dateLabel = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })
  const fullSizes = monthly ? monthly.sizes.filter((s) => s.rate >= UTIL_FULL).length : 0
  const skeleton = (h = 'h-48') => <div className={`m-5 ${h} animate-pulse rounded-xl bg-[#F5F4F8]`} />

  return (
    <AdminLayout>
      <div className="px-5 py-7 sm:px-8">
        <header className="mb-6">
          <p className="text-sm text-[#5B6472]">{dateLabel}</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight text-[#263544]">
            {!queues ? 'กำลังโหลด…' : taskCount === 0 ? 'วันนี้ไม่มีงานค้าง' : `วันนี้มีงานรอ ${taskCount} รายการ`}
          </h1>
        </header>

        {error && (
          <p role="alert" className="mb-6 rounded-xl bg-[#FDE8E8] px-4 py-3 text-sm text-[#B42318]">
            โหลดข้อมูลไม่สำเร็จ: {error}
          </p>
        )}

        {/* ================= ทุกเช้า ================= */}
        <SectionHeading eyebrow="ทุกเช้า" title="วันนี้ต้องทำอะไร มีอะไรไฟไหม้ไหม" first />

        {/* คิวงานประจำ: จุดเดียวในหน้าที่ใช้กรอบหนา เพราะเป็นสิ่งที่ต้องลงมือ */}
        <section
          aria-label="งานวันนี้"
          className={`grid overflow-hidden rounded-2xl bg-white md:grid-cols-3 ${
            taskCount > 0 ? 'border-2 border-[#263544] shadow-[4px_4px_0_0_#263544]' : 'border border-[#E4E3EA]'
          }`}
        >
          <QueueColumn
            icon={<ReceiptIcon size={18} />}
            title="ตรวจยอดและคืนเงิน"
            hint="ตรวจสลิปที่ลูกค้าแจ้งโอน และโอนคืนออเดอร์ที่ถูกยกเลิก"
            tasks={queues?.review}
            href="/admin/orders?tab=review"
          />
          <QueueColumn
            icon={<PackageIcon size={18} />}
            title="แพ็กและส่งออก"
            hint="ส่งด้วยขนส่งที่ลูกค้าเลือก ก่อนวันรับชุด 1 วัน · รับเองที่ร้าน เตรียมไว้ภายในวันใส่"
            tasks={queues?.ship}
            href="/admin/orders?tab=to_ship"
          />
          <QueueColumn
            icon={<ArrowUUpLeftIcon size={18} />}
            title="รับคืนและตรวจสภาพ"
            hint="ชุดที่ใกล้ครบกำหนดคืน และชุดที่ได้รับคืนแล้ว"
            tasks={queues?.back}
            href="/admin/orders?tab=returning"
          />
        </section>

        {/* ================= ทุกสัปดาห์ ================= */}
        <SectionHeading eyebrow="ทุกสัปดาห์" title="เงินกับคิวเป็นยังไง" />

        <MetricStrip>
          <Metric
            label="รายได้ค่าเช่า + ค่าซัก เดือนนี้"
            value={weekly ? formatBaht(weekly.income.rental) : '—'}
            note={weekly ? `เดือนก่อน ${formatBaht(weekly.incomeLast.rental)}` : undefined}
          />
          <Metric
            label="ค่าปรับ + หักมัดจำ เดือนนี้"
            value={weekly ? formatBaht(weekly.income.lateFee + weekly.income.damage) : '—'}
            note={
              weekly
                ? `คืนช้า ${formatBaht(weekly.income.lateFee)} · เสียหาย ${formatBaht(weekly.income.damage)} · ยิ่งสูงยิ่งต้องหาสาเหตุ`
                : undefined
            }
          />
          <Metric
            label="มัดจำที่ร้านถืออยู่"
            value={weekly ? formatBaht(weekly.deposits.held) : '—'}
            note="เงินของลูกค้า ห้ามนำไปใช้"
          />
          <Metric
            label="ต้องโอนคืนภายใน 7 วัน"
            value={weekly ? formatBaht(weekly.deposits.dueSoon) : '—'}
            note={weekly ? `รอโอนตอนนี้ ${formatBaht(weekly.deposits.pendingNow)} · ที่เหลือก่อนหักค่าเสียหาย` : undefined}
          />
        </MetricStrip>

        <div className="mt-4">
          <MetricStrip>
            <Metric label="ออเดอร์เดือนนี้" value={weekly ? weekly.orders : '—'} note="รวมที่รอชำระ ไม่นับที่ยกเลิก" />
            <Metric
              label="อัตราการจองชุด 30 วันข้างหน้า"
              value={weekly?.util != null ? `${Math.round(weekly.util * 100)}%` : '—'}
              note={weekly ? `จากชุดพร้อมเช่า ${weekly.rentable} ตัว · ต่ำ = ถึงเวลาโปรโมต` : undefined}
            />
            <Metric
              label="ออเดอร์หมดอายุเพราะไม่จ่าย"
              value={weekly?.expired.rate != null ? `${Math.round(weekly.expired.rate * 100)}%` : '—'}
              note={
                weekly
                  ? `${weekly.expired.expired} จาก ${weekly.expired.total} ออเดอร์ · 30 วัน · สูง = จ่ายยากหรือมีคนจองกั๊กชุด`
                  : undefined
              }
            />
            <Metric
              label="คะแนนรีวิวเฉลี่ย"
              value={
                data?.ratingAvg != null ? (
                  <span className="inline-flex items-center gap-2">
                    {data.ratingAvg.toFixed(1)}
                    <StarDisplay value={data.ratingAvg} size={14} />
                  </span>
                ) : (
                  '—'
                )
              }
              note={data ? (data.ratingCount ? `จาก ${data.ratingCount} รีวิว` : 'ยังไม่มีรีวิว') : undefined}
            />
          </MetricStrip>
        </div>

        <Panel
          className="mt-4"
          bodyClassName=""
          title="คิวชุด 3 สัปดาห์"
          description="ชุดจริงแต่ละตัวถูกล็อกวันไหน → ช่วงที่ว่างเยอะให้โปรโมต ช่วงที่เต็มไม่ต้องลดราคา · ชี้แถบเพื่อดูรายละเอียด กดเพื่อเปิดออเดอร์"
        >
          {data ? <OccupancyBoard data={data} /> : skeleton()}
        </Panel>

        <Panel
          className="mt-4"
          bodyClassName=""
          title="รายได้รายสัปดาห์"
          description="ค่าเช่า + ค่าซัก จากออเดอร์ที่ชำระแล้ว ตามวันที่สั่ง (ไม่รวมมัดจำ) → ดูแนวโน้ม เทียบกับช่วงที่มีงานอีเวนต์"
        >
          {data ? <WeeklyRevenueChart weeks={weeks} /> : skeleton()}
        </Panel>

        {/* ================= ทุกเดือน ================= */}
        <SectionHeading eyebrow="ทุกเดือน" title="ชุดตัวไหนควรซื้อเพิ่ม ซ่อม หรือเลิกเช่า" />

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            bodyClassName=""
            title="อัตราการใช้งานรายชุดและไซส์"
            description={`30 วันล่าสุด วันที่ถูกล็อก ÷ วันทั้งหมด → เกิน ${Math.round(UTIL_FULL * 100)}% ซื้อเพิ่มเฉพาะไซส์นั้น${
              monthly ? ` (ตอนนี้ ${fullSizes} ไซส์)` : ''
            }`}
          >
            {monthly ? <UtilizationBySize rows={monthly.sizes} /> : skeleton()}
          </Panel>
          <Panel
            title="ชุดที่ไม่ถูกเช่า 60 วัน"
            description="ชุดนอนตู้ = ทุนจม → ลดราคา จัดเซ็ตกับชุดยอดนิยม ถ่ายรูปใหม่ หรือขายออก"
            bodyClassName=""
          >
            {monthly ? <IdleCostumes rows={monthly.idle} today={today} /> : skeleton()}
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel
            title="ความเสียหายแยกตามสาเหตุ"
            description="90 วันล่าสุด → ชิ้นส่วนหายบ่อยใส่ถุงแยก ติดป้าย · เสียบ่อยขึ้นมัดจำ · เสียซ้ำหลายครั้งปลดระวาง"
            bodyClassName=""
          >
            {monthly ? <DamageByCause summary={monthly.damage} /> : skeleton()}
          </Panel>
          <Panel title="ชุดที่ถูกเช่ามากที่สุด" description="90 วันล่าสุด → ใช้คู่กับอัตราการใช้งานก่อนตัดสินใจซื้อเพิ่ม" bodyClassName="">
            {data ? <TopCostumes items={top} /> : skeleton()}
          </Panel>
          <Panel
            title="ลูกค้าเช่ากี่วัน"
            description="รายการที่ชำระแล้ว สั่งใน 90 วันล่าสุด → ใช้กำหนดแพ็กเกจระยะเช่า"
            bodyClassName=""
          >
            {monthly ? <RentalDaysChart stats={monthly.days} /> : skeleton()}
          </Panel>
        </div>

        <Panel
          className="mt-4"
          title="รีวิว"
          description={
            unansweredLow > 0
              ? `รีวิว 1–2 ดาวที่ยังไม่ตอบ ${unansweredLow} รายการ ขึ้นก่อน → ตอบทุกอัน และตรวจสภาพจริงของชุดนั้น`
              : 'รีวิวล่าสุด · รีวิว 1–2 ดาวที่ยังไม่ตอบจะขึ้นก่อนเสมอ'
          }
          bodyClassName=""
          action={
            <Link href="/admin/reviews" className="text-xs font-medium text-[#C92D67] hover:underline">
              จัดการรีวิว
            </Link>
          }
        >
          {!data ? (
            skeleton('h-24')
          ) : reviews.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#6B7280]">
              ยังไม่มีรีวิว ลูกค้ารีวิวได้หลังออเดอร์ &quot;เสร็จสิ้น&quot;
            </p>
          ) : (
            <ul className="divide-y divide-[#EEEDF2]">
              {reviews.slice(0, Math.max(4, unansweredLow)).map((r) => (
                <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3.5">
                  <div className="w-full min-w-0 sm:w-56">
                    <p className="truncate text-sm font-medium text-[#263544]">{r.productName}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <StarDisplay value={r.rating} size={12} />
                      <span className="text-xs text-[#6B7280]">{r.reviewerName}</span>
                    </div>
                  </div>
                  <p className="line-clamp-2 min-w-0 flex-1 text-sm text-[#5B6472]">
                    {r.comment ?? <span className="italic text-[#9AA3AF]">ไม่มีข้อความ</span>}
                  </p>
                  <div className="flex items-center gap-2">
                    {r.isHidden ? (
                      <StatusBadge tone="closed">ซ่อนอยู่</StatusBadge>
                    ) : needsReply(r) ? (
                      <StatusBadge tone="problem">ควรตอบ</StatusBadge>
                    ) : r.adminReply ? (
                      <StatusBadge tone="done">ตอบแล้ว</StatusBadge>
                    ) : (
                      <StatusBadge tone="waiting">ยังไม่ตอบ</StatusBadge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminLayout>
  )
}

function SectionHeading({ eyebrow, title, first = false }: { eyebrow: string; title: string; first?: boolean }) {
  return (
    <div className={`mb-3 flex items-baseline gap-3 ${first ? '' : 'mt-10 border-t border-[#E4E3EA] pt-6'}`}>
      <span className="rounded-full bg-[#263544] px-2.5 py-0.5 text-xs font-semibold text-white">{eyebrow}</span>
      <h2 className="text-lg font-bold text-[#263544]">{title}</h2>
    </div>
  )
}

function QueueColumn({
  icon,
  title,
  hint,
  tasks,
  href,
}: {
  icon: ReactNode
  title: string
  hint: string
  tasks: Task[] | undefined
  href: string
}) {
  const count = tasks?.length ?? 0
  const urgent = tasks?.some((t) => t.tone === 'action' || t.tone === 'problem')
  return (
    <div className="flex flex-col border-b border-[#EEEDF2] last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#263544]">
            <span className="text-[#5B6472]">{icon}</span>
            {title}
          </h2>
          <p className="mt-1 text-xs text-[#6B7280]">{hint}</p>
        </div>
        <span
          className={`flex h-9 min-w-[36px] items-center justify-center rounded-full px-2 text-lg font-bold tabular-nums ${
            !tasks ? 'bg-[#F5F4F8] text-[#9AA3AF]' : urgent ? 'bg-[#FFF1D6] text-[#875200]' : count ? 'bg-[#E4EFFB] text-[#1D5FA8]' : 'bg-[#F5F4F8] text-[#9AA3AF]'
          }`}
        >
          {tasks ? count : '·'}
        </span>
      </div>

      <div className="flex-1 px-3 pb-3">
        {!tasks ? (
          <div className="mx-2 h-20 animate-pulse rounded-xl bg-[#F5F4F8]" />
        ) : count === 0 ? (
          <p className="flex items-center gap-2 px-2 py-5 text-sm text-[#6B7280]">
            <CheckCircleIcon size={18} weight="fill" className="text-[#2E9E62]" />
            ไม่มีงานค้าง
          </p>
        ) : (
          <ul>
            {tasks.slice(0, 4).map((t) => (
              <li key={t.order.id}>
                <Link
                  href={orderHref(t.order)}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#F7F6FA]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#263544]">{t.order.shipName}</span>
                    <span className="block text-xs tabular-nums text-[#6B7280]">
                      {t.order.orderNumber} · {formatBaht(t.order.grandTotal)}
                    </span>
                  </span>
                  <StatusBadge tone={t.tone}>{t.when}</StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {count > 4 && (
        <Link href={href} className="border-t border-[#EEEDF2] px-5 py-2.5 text-xs font-medium text-[#C92D67] hover:bg-[#FAFAFC]">
          ดูทั้งหมด {count} รายการ
        </Link>
      )}
    </div>
  )
}
