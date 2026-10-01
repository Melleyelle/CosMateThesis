'use client'

import { useMemo, useRef, useState, type CSSProperties, type FocusEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import type { DashboardData } from '@/utils/admin/fetchDashboard'
import { BLOCKING, dayDiff, lockRange } from '@/utils/admin/fetchDashboard'
import { ADMIN_STATUS_LABEL } from '@/utils/admin/statusTone'
import { addDays, formatThaiDateWithWeekday, parseISODate, todayISO } from '@/utils/dateUtils'
import type { OrderStatus } from '@/utils/orderStatus'

// กระดานคิวชุด: ชุดจริงแต่ละตัว × วัน แสดงช่วงล็อก 5 วันของแต่ละการจองเป็นแถบสี
// สีผ่านตัวตรวจ (CVD ΔE ≥ 13.7 คู่ติดกัน, คอนทราสต์ ≥ 3:1) และวันเผื่อใช้ลายเส้นแทนสี

const DAY_W = 34
const LABEL_W = 208
const PAST_DAYS = 3
const SPAN_DAYS = 21

type SegType = 'transit' | 'use' | 'return' | 'buffer'

const SEG_STYLE: Record<SegType, CSSProperties> = {
  transit: { background: '#2F7FD6' },
  use: { background: '#E5457F' },
  return: { background: '#6E4FC0' },
  buffer: {
    background: 'repeating-linear-gradient(135deg, #C5CAD3 0 2px, #EEF0F3 2px 6px)',
    boxShadow: 'inset 0 0 0 1px #C5CAD3',
  },
}

const LEGEND: { type: SegType; label: string }[] = [
  { type: 'transit', label: 'ขนส่ง / ลูกค้ารับชุด' },
  { type: 'use', label: 'วันใช้งาน' },
  { type: 'return', label: 'วันส่งคืน' },
  { type: 'buffer', label: 'เผื่อส่งช้า / ซัก' },
]

const CONDITION_LABEL: Record<string, string> = { cleaning: 'กำลังซัก', damaged: 'ซ่อม', retired: 'ปลดระวาง' }

type Booking = {
  key: string
  orderId: string
  orderNumber: string
  customer: string
  status: OrderStatus
  useDate: string
  returnBy: string
  from: string
  to: string
  segments: { type: SegType; days: number }[]
}

type Tip = { x: number; y: number; booking: Booking } | null

export default function OccupancyBoard({ data }: { data: DashboardData }) {
  const today = todayISO()
  const start = addDays(today, -PAST_DAYS)
  const end = addDays(start, SPAN_DAYS - 1)
  const days = useMemo(() => Array.from({ length: SPAN_DAYS }, (_, i) => addDays(start, i)), [start])
  const [showAll, setShowAll] = useState(false)
  const [tip, setTip] = useState<Tip>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // การจองทั้งหมดที่ยังล็อกชุด แยกตามรหัสชุดจริง
  const byItem = useMemo(() => {
    const map = new Map<string, Booking[]>()
    const s = data.settings
    for (const o of data.orders) {
      if (!BLOCKING.includes(o.status)) continue
      for (const l of o.lines) {
        if (!l.itemCode) continue
        const r = lockRange(l.startDate, l.endDate, s)
        if (r.to < start || r.from > end) continue
        const useDays = Math.max(1, dayDiff(l.startDate, l.endDate))
        const all: Booking['segments'] = [
          { type: 'transit', days: s.bufferDaysBefore },
          { type: 'use', days: useDays },
          ...(l.endDate > l.startDate ? [{ type: 'return' as SegType, days: 1 }] : []),
          { type: 'buffer', days: s.bufferDaysAfter },
        ]
        const segments = all.filter((seg) => seg.days > 0)
        const list = map.get(l.itemCode) ?? []
        list.push({
          key: l.id,
          orderId: o.id,
          orderNumber: o.orderNumber,
          customer: o.shipName,
          status: o.status,
          useDate: l.startDate,
          returnBy: l.endDate,
          from: r.from,
          to: r.to,
          segments,
        })
        map.set(l.itemCode, list)
      }
    }
    return map
  }, [data, start, end])

  const allRows = data.items.filter((i) => i.productActive || byItem.has(i.itemCode))
  const busyRows = allRows.filter((i) => byItem.has(i.itemCode))
  const rows = showAll || busyRows.length === 0 ? allRows : busyRows
  const idle = allRows.length - busyRows.length

  function showTip(e: MouseEvent | FocusEvent, booking: Booking) {
    const box = boxRef.current?.getBoundingClientRect()
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (!box) return
    setTip({ x: el.left - box.left + Math.min(el.width / 2, 80), y: el.top - box.top, booking })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#5B6472]">
          {LEGEND.map((l) => (
            <li key={l.type} className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-[3px]" style={SEG_STYLE[l.type]} aria-hidden />
              {l.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-[3px] border border-dashed border-[#5B6472]" aria-hidden />
            ยังไม่ชำระเงิน
          </li>
        </ul>
        {busyRows.length > 0 && idle > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-[#C92D67] hover:underline"
          >
            {showAll ? 'แสดงเฉพาะชุดที่มีคิว' : `แสดงชุดที่ว่างด้วย (${idle})`}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 pb-8 pt-4 text-center text-sm text-[#6B7280]">
          ยังไม่มีชุดที่เปิดให้เช่า{' '}
          <Link href="/admin/inventory" className="font-medium text-[#C92D67] hover:underline">
            ไปที่คลังชุด
          </Link>
        </p>
      ) : (
        <div ref={boxRef} className="relative" onMouseLeave={() => setTip(null)}>
          <div className="overflow-x-auto pb-2">
            <div style={{ width: LABEL_W + DAY_W * SPAN_DAYS }} className="relative">
              {/* หัวตาราง: วันที่ */}
              <div className="flex border-y border-[#EEEDF2] bg-[#FAFAFC]">
                <div
                  style={{ width: LABEL_W }}
                  className="sticky left-0 z-20 flex items-end border-r border-[#EEEDF2] bg-[#FAFAFC] px-5 py-2 text-xs font-medium text-[#6B7280]"
                >
                  ชุด / รหัส
                </div>
                {days.map((d) => {
                  const date = parseISODate(d)
                  const isToday = d === today
                  const weekend = date.getDay() === 0 || date.getDay() === 6
                  const firstOfMonth = date.getDate() === 1 || d === start
                  return (
                    <div
                      key={d}
                      style={{ width: DAY_W }}
                      className={`relative flex flex-col items-center py-1.5 text-[11px] leading-tight ${
                        weekend ? 'bg-[#F3F1F8]' : ''
                      }`}
                    >
                      {firstOfMonth && (
                        <span className="absolute -top-0 left-1 text-[9px] font-semibold text-[#6B7280]">
                          {date.toLocaleDateString('th-TH', { month: 'short' })}
                        </span>
                      )}
                      <span className={`mt-2 ${isToday ? 'font-semibold text-[#C92D67]' : 'text-[#6B7280]'}`}>
                        {date.toLocaleDateString('th-TH', { weekday: 'narrow' })}
                      </span>
                      <span
                        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full tabular-nums ${
                          isToday ? 'bg-[#E5457F] font-bold text-white' : 'font-medium text-[#263544]'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* แถว: ชุดจริงแต่ละตัว */}
              {rows.map((item, rowIdx) => {
                const bookings = byItem.get(item.itemCode) ?? []
                const prevName = rowIdx > 0 ? rows[rowIdx - 1].productName : null
                const newGroup = item.productName !== prevName
                return (
                  <div key={item.id} className={`relative flex ${newGroup && rowIdx > 0 ? 'border-t border-[#EEEDF2]' : ''}`}>
                    <div
                      style={{ width: LABEL_W }}
                      className="sticky left-0 z-10 flex min-h-[44px] flex-col justify-center border-r border-[#EEEDF2] bg-white px-5 py-1.5"
                    >
                      {newGroup && <p className="truncate text-[13px] font-medium text-[#263544]">{item.productName}</p>}
                      <p className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                        <span className="tabular-nums">{item.itemCode}</span>
                        {CONDITION_LABEL[item.condition] && (
                          <span className="rounded bg-[#EEF0F3] px-1 text-[10px] text-[#56606E]">
                            {CONDITION_LABEL[item.condition]}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* พื้นหลังคอลัมน์ (เสาร์-อาทิตย์ + วันนี้) */}
                    {days.map((d) => {
                      const dow = parseISODate(d).getDay()
                      return (
                        <div
                          key={d}
                          style={{ width: DAY_W }}
                          className={`${dow === 0 || dow === 6 ? 'bg-[#F7F6FA]' : ''} ${
                            d === today ? 'border-x border-[#E5457F]/30 bg-[#FDF2F6]' : ''
                          }`}
                        />
                      )
                    })}

                    {/* แถบการจอง */}
                    {bookings.map((b) => {
                      const from = b.from < start ? start : b.from
                      const to = b.to > end ? end : b.to
                      const left = LABEL_W + dayDiff(start, from) * DAY_W + 2
                      const width = (dayDiff(from, to) + 1) * DAY_W - 4
                      const clipStart = dayDiff(b.from, from) // จำนวนวันที่ถูกตัดทางซ้าย
                      const unpaid = b.status === 'pending_payment'
                      let skip = clipStart
                      return (
                        <Link
                          key={b.key}
                          href={`/admin/orders?q=${b.orderNumber}`}
                          onMouseEnter={(e) => showTip(e, b)}
                          onFocus={(e) => showTip(e, b)}
                          onBlur={() => setTip(null)}
                          aria-label={`${b.orderNumber} ${b.customer} ใช้งาน ${formatThaiDateWithWeekday(b.useDate)}`}
                          className={`absolute top-1/2 flex h-5 -translate-y-1/2 gap-[2px] overflow-hidden rounded-[5px] outline-none transition focus-visible:ring-2 focus-visible:ring-[#263544] focus-visible:ring-offset-2 ${
                            unpaid ? 'opacity-55 outline-dashed outline-1 outline-offset-1 outline-[#5B6472]' : ''
                          }`}
                          style={{ left, width }}
                        >
                          {b.segments.map((seg, i) => {
                            const visible = Math.max(0, seg.days - skip)
                            skip = Math.max(0, skip - seg.days)
                            if (visible === 0) return null
                            return (
                              <span
                                key={i}
                                className="h-full"
                                style={{ ...SEG_STYLE[seg.type], flexGrow: visible, flexBasis: 0 }}
                              />
                            )
                          })}
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {tip && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-30 w-60 -translate-x-1/2 -translate-y-full rounded-xl border border-[#E4E3EA] bg-white p-3 text-xs shadow-[0_8px_24px_rgba(38,53,68,0.14)]"
              style={{ left: tip.x, top: tip.y - 8 }}
            >
              <p className="font-semibold tabular-nums text-[#263544]">{tip.booking.orderNumber}</p>
              <p className="text-[#5B6472]">{tip.booking.customer}</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                <dt className="text-[#6B7280]">วันใช้งาน</dt>
                <dd className="font-medium text-[#263544]">{formatThaiDateWithWeekday(tip.booking.useDate)}</dd>
                <dt className="text-[#6B7280]">ส่งคืนภายใน</dt>
                <dd className="font-medium text-[#263544]">{formatThaiDateWithWeekday(tip.booking.returnBy)}</dd>
                <dt className="text-[#6B7280]">สถานะ</dt>
                <dd className="font-medium text-[#263544]">{ADMIN_STATUS_LABEL[tip.booking.status]}</dd>
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
