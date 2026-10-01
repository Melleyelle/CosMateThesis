'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  PackageIcon,
  PlusIcon,
  ReceiptIcon,
  ArrowUUpLeftIcon,
} from '@phosphor-icons/react'
import AdminLayout from '../components/admin/AdminLayout'
import { Metric, MetricStrip, Panel, StatusBadge, primaryButtonClass, secondaryButtonClass } from '../components/admin/ui'
import OccupancyBoard from '../components/admin/dashboard/OccupancyBoard'
import WeeklyRevenueChart from '../components/admin/dashboard/WeeklyRevenueChart'
import TopCostumes, { type TopCostume } from '../components/admin/dashboard/TopCostumes'
import { StarDisplay } from '../components/customer/StarRating'
import {
  BLOCKING,
  REVENUE,
  dayDiff,
  fetchDashboard,
  shipByDate,
  utilization,
  weeklyRevenue,
  type DashboardData,
} from '@/utils/admin/fetchDashboard'
import type { Tone } from '@/utils/admin/statusTone'
import type { OrderSummary } from '@/utils/customer/fetchOrders'
import { addDays, formatBaht, formatThaiDateWithWeekday, todayISO, toISODate } from '@/utils/dateUtils'

type Task = { order: OrderSummary; tone: Tone; when: string; sort: number }

function relativeHours(timestamp: string) {
  const h = Math.floor((Date.now() - new Date(timestamp).getTime()) / 3_600_000)
  if (h < 1) return 'เมื่อสักครู่'
  if (h < 24) return `${h} ชม.ที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

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

  // ---------------- งานวันนี้ ----------------
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
        const shipBy = o.lines.map((l) => shipByDate(l.startDate, s)).sort()[0]
        const diff = dayDiff(today, shipBy)
        const when =
          diff < 0 ? `เลยกำหนดส่ง ${-diff} วัน` : diff === 0 ? 'ต้องส่งวันนี้' : diff === 1 ? 'ส่งพรุ่งนี้' : `ส่งภายใน ${formatThaiDateWithWeekday(shipBy)}`
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

  // ---------------- ตัวเลขสรุป ----------------
  const metrics = useMemo(() => {
    if (!data) return null
    const monthStart = `${today.slice(0, 7)}-01`
    const lastMonthStart = (() => {
      const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)
      return toISODate(d)
    })()
    const createdDay = (o: OrderSummary) => toISODate(new Date(o.createdAt))
    const revenueOf = (list: OrderSummary[]) => list.reduce((s, o) => s + o.rentalTotal + o.laundryTotal, 0)

    const paid = data.orders.filter((o) => REVENUE.includes(o.status))
    const thisMonth = paid.filter((o) => createdDay(o) >= monthStart)
    const lastMonth = paid.filter((o) => createdDay(o) >= lastMonthStart && createdDay(o) < monthStart)
    const bookedThisMonth = data.orders.filter((o) => BLOCKING.includes(o.status) && createdDay(o) >= monthStart)

    return {
      revenue: revenueOf(thisMonth),
      revenueLast: revenueOf(lastMonth),
      orders: bookedThisMonth.length,
      util: utilization(data, today, 30),
      rentable: data.items.filter((i) => i.productActive && i.condition === 'available').length,
    }
  }, [data, today])

  const weeks = useMemo(() => (data ? weeklyRevenue(data.orders, 8) : []), [data])

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

  const taskCount = queues ? queues.review.length + queues.ship.length + queues.back.filter((t) => t.tone !== 'progress').length : 0
  const dateLabel = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <AdminLayout>
      <div className="px-5 py-7 sm:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[#5B6472]">{dateLabel}</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight text-[#263544]">
              {!queues ? 'กำลังโหลด…' : taskCount === 0 ? 'วันนี้ไม่มีงานค้าง' : `วันนี้มีงานรอ ${taskCount} รายการ`}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" target="_blank" className={secondaryButtonClass}>
              <ArrowSquareOutIcon size={16} />
              ดูหน้าร้าน
            </Link>
            <Link href="/admin/inventory/new" className={primaryButtonClass}>
              <PlusIcon size={16} weight="bold" />
              เพิ่มชุดใหม่
            </Link>
          </div>
        </header>

        {error && (
          <p role="alert" className="mb-6 rounded-xl bg-[#FDE8E8] px-4 py-3 text-sm text-[#B42318]">
            โหลดข้อมูลไม่สำเร็จ: {error}
          </p>
        )}

        {/* ---------------- งานวันนี้: จุดเดียวในหน้าที่ใช้กรอบหนา เพราะเป็นสิ่งที่ต้องลงมือ ---------------- */}
        <section
          aria-label="งานวันนี้"
          className={`grid overflow-hidden rounded-2xl bg-white md:grid-cols-3 ${
            taskCount > 0
              ? 'border-2 border-[#263544] shadow-[4px_4px_0_0_#263544]'
              : 'border border-[#E4E3EA]'
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
            hint="ส่ง EMS ก่อนวันรับชุด 1 วัน"
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

        {/* ---------------- ตัวเลขสรุป ---------------- */}
        <div className="mt-6">
          <MetricStrip>
            <Metric
              label="รายได้เดือนนี้"
              value={metrics ? formatBaht(metrics.revenue) : '—'}
              note={metrics ? `เดือนก่อน ${formatBaht(metrics.revenueLast)} · ไม่รวมมัดจำ` : undefined}
            />
            <Metric label="ออเดอร์เดือนนี้" value={metrics ? metrics.orders : '—'} note="รวมที่รอชำระ ไม่นับที่ยกเลิก" />
            <Metric
              label="อัตราการจองชุด 30 วันข้างหน้า"
              value={metrics?.util != null ? `${Math.round(metrics.util * 100)}%` : '—'}
              note={metrics ? `จากชุดพร้อมเช่า ${metrics.rentable} ตัว` : undefined}
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

        {/* ---------------- กระดานคิวชุด ---------------- */}
        <Panel
          className="mt-6"
          bodyClassName=""
          title="คิวชุด 3 สัปดาห์"
          description="ชุดจริงแต่ละตัวถูกล็อกวันไหนบ้าง แถบหนึ่งคือการจองหนึ่งครั้ง ชี้เพื่อดูรายละเอียด กดเพื่อเปิดออเดอร์"
        >
          {data ? <OccupancyBoard data={data} /> : <div className="m-5 h-48 animate-pulse rounded-xl bg-[#F5F4F8]" />}
        </Panel>

        {/* ---------------- รายได้ + ชุดยอดนิยม ---------------- */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            bodyClassName=""
            title="รายได้รายสัปดาห์"
            description="ค่าเช่า + ค่าซัก จากออเดอร์ที่ชำระแล้ว ตามวันที่สั่ง (ไม่รวมมัดจำ)"
          >
            {data ? <WeeklyRevenueChart weeks={weeks} /> : <div className="m-5 h-48 animate-pulse rounded-xl bg-[#F5F4F8]" />}
          </Panel>
          <Panel title="ชุดที่ถูกเช่ามากที่สุด" description="90 วันล่าสุด" bodyClassName="">
            {data ? <TopCostumes items={top} /> : <div className="m-5 h-48 animate-pulse rounded-xl bg-[#F5F4F8]" />}
          </Panel>
        </div>

        {/* ---------------- รีวิวล่าสุด ---------------- */}
        <Panel
          className="mt-6"
          title="รีวิวล่าสุด"
          bodyClassName=""
          action={
            <Link href="/admin/reviews" className="text-xs font-medium text-[#C92D67] hover:underline">
              จัดการรีวิว
            </Link>
          }
        >
          {!data ? (
            <div className="m-5 h-24 animate-pulse rounded-xl bg-[#F5F4F8]" />
          ) : data.reviews.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#6B7280]">
              ยังไม่มีรีวิว ลูกค้ารีวิวได้หลังออเดอร์ &quot;เสร็จสิ้น&quot;
            </p>
          ) : (
            <ul className="divide-y divide-[#EEEDF2]">
              {data.reviews.slice(0, 4).map((r) => (
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
                    ) : r.rating <= 2 ? (
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
                  href={`/admin/orders?q=${t.order.orderNumber}`}
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
