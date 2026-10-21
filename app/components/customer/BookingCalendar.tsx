'use client'

import { useMemo, useState } from 'react'
import { CaretLeftIcon, CaretRightIcon, MapPinIcon } from '@phosphor-icons/react'
import { addDays, formatThaiDateWithWeekday, parseISODate, todayISO, toISODate } from '@/utils/dateUtils'
import { eventsByDate, type CalendarEvent } from '@/utils/customer/events'

type Timeline = { receiveDate: string; returnBy: string }

interface BookingCalendarProps {
  unavailable: Set<string>
  selected: string | null
  onSelect: (date: string) => void
  daysAhead: number
  loading: boolean
  // คำนวณวันรับ/วันคืนจากวันใช้งาน
  getTimeline: (useDate: string) => Timeline
  events?: CalendarEvent[]
  /** จองล่วงหน้าอย่างน้อยกี่วัน — วันก่อนหน้านั้นปิดรับจอง ไม่ใช่ "จองแล้ว" */
  minLeadDays?: number
  /** วันกันไว้หลังวันคืน (ขนส่งกลับ/ตรวจ/ซัก) ตาม booking_settings — ใช้ถอดว่าวันไหนชุดถูกใช้อยู่จริง */
  bufferDaysAfter?: number
  /** วันเริ่มเช่าไม่ได้ของทุกไซส์ในชุดนี้ (เรียงไซส์แล้ว) — ใช้บอกใต้วันที่ว่าไซส์ไหนถูกจองวันนั้น */
  sizeBookings?: SizeBooking[]
}

export type SizeBooking = {
  size: string
  unavailable: Set<string>
  getTimeline: (useDate: string) => Timeline
}

// ป้ายไซส์ใต้วันที่: ช่องแคบบนมือถือ จึงแสดงสูงสุด 2 ไซส์ ที่เหลือเป็น +n (ชื่อเต็มอยู่ใน aria-label/title)
function sizesCaption(sizes: string[]) {
  return sizes.length <= 2 ? sizes.join('·') : `${sizes.slice(0, 2).join('·')}+${sizes.length - 2}`
}

function daysBetween(fromISO: string, toISO: string) {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86_400_000)
}

/**
 * แปลง "วันที่เริ่มเช่าไม่ได้" (จาก RPC) เป็น "วันที่ชุดถูกใช้อยู่จริง"
 * RPC บอกว่าเริ่มวัน D ไม่ได้เมื่อช่วงล็อกของเรา [D - before, D + span + after] ชนกับการจองเดิม
 * ดังนั้นช่วงเริ่มไม่ได้ที่ต่อกัน [s, e] เกิดจากการจองที่ล็อกชุดไว้ [s + span + after, e - before]
 * (ไม่หดฝั่งที่ชนขอบช่วงเปิดจอง เพราะไม่รู้ว่าช่วงจริงเริ่ม/จบตรงไหน)
 */
function occupiedDays(
  unavailable: Set<string>,
  firstBookable: string,
  lastDate: string,
  before: number,
  span: number,
  after: number,
): Set<string> {
  const out = new Set<string>()
  let runStart: string | null = null
  for (let d = firstBookable; d <= addDays(lastDate, 1); d = addDays(d, 1)) {
    const blocked = d <= lastDate && unavailable.has(d)
    if (blocked && !runStart) runStart = d
    if (!blocked && runStart) {
      const runEnd = addDays(d, -1)
      const from = runStart === firstBookable ? runStart : addDays(runStart, span + after)
      const to = runEnd === lastDate ? runEnd : addDays(runEnd, -before)
      for (let x = from; x <= to; x = addDays(x, 1)) out.add(x)
      runStart = null
    }
  }
  return out
}

const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const shifted = new Date(year, monthNumber - 1 + amount, 1)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`
}

const navButtonClass =
  'focus-ring flex h-11 w-11 items-center justify-center rounded-full text-ink transition hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'

// ปฏิทินเลือกวันใส่ชุด — สีตาม design system: ชมพู = ช่วงเช่าที่เลือก · ฟ้า (info) = งานอีเวนต์
export default function BookingCalendar({
  unavailable,
  selected,
  onSelect,
  daysAhead,
  loading,
  getTimeline,
  events = [],
  minLeadDays = 0,
  bufferDaysAfter = 0,
  sizeBookings = [],
}: BookingCalendarProps) {
  const today = todayISO()
  const firstBookable = addDays(today, minLeadDays)
  const lastDate = addDays(today, Math.max(0, daysAhead))

  // "จองแล้ว" = วันที่ชุดอยู่กับลูกค้าคนอื่นจริง ไม่ใช่ทุกวันที่เริ่มเช่าไม่ได้
  // (วันก่อนหน้าการจองเดิมเริ่มเช่าไม่ได้เพราะช่วงเช่าของเราจะยาวไปชน แต่ชุดยังว่างอยู่)
  const booked = useMemo(() => {
    if (loading || unavailable.size === 0) return new Set<string>()
    const ref = getTimeline(today)
    return occupiedDays(
      unavailable,
      firstBookable,
      lastDate,
      daysBetween(ref.receiveDate, today),
      daysBetween(today, ref.returnBy),
      bufferDaysAfter,
    )
  }, [loading, unavailable, getTimeline, today, firstBookable, lastDate, bufferDaysAfter])

  // วันที่ → ไซส์ที่ถูกจองวันนั้น (ถอดแบบเดียวกับ booked แต่ทำทุกไซส์ — แต่ละไซส์อาจมีจำนวนวันเช่าต่างกัน)
  // แสดงเฉพาะชุดที่มีมากกว่า 1 ไซส์ ชุดไซส์เดียวใช้คำว่า "จองแล้ว" ตามเดิม
  const multiSize = sizeBookings.length > 1
  const bookedSizes = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!multiSize) return map
    for (const sb of sizeBookings) {
      if (sb.unavailable.size === 0) continue
      const ref = sb.getTimeline(today)
      const days = occupiedDays(
        sb.unavailable,
        firstBookable,
        lastDate,
        daysBetween(ref.receiveDate, today),
        daysBetween(today, ref.returnBy),
        bufferDaysAfter,
      )
      for (const d of days) map.set(d, [...(map.get(d) ?? []), sb.size])
    }
    return map
  }, [multiSize, sizeBookings, today, firstBookable, lastDate, bufferDaysAfter])

  const firstMonth = today.slice(0, 7)
  const lastMonth = lastDate.slice(0, 7)
  const [visibleMonth, setVisibleMonth] = useState(firstMonth)

  const eventMap = useMemo(() => eventsByDate(events), [events])

  const [year, monthNumber] = visibleMonth.split('-').map(Number)
  const firstDay = new Date(year, monthNumber - 1, 1)
  const dayCount = new Date(year, monthNumber, 0).getDate()
  const cellCount = Math.ceil((firstDay.getDay() + dayCount) / 7) * 7
  const days = Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstDay.getDay() + 1
    if (day < 1 || day > dayCount) return null
    return toISODate(new Date(year, monthNumber - 1, day))
  })
  const monthLabel = firstDay.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  const isDisabled = (date: string) => loading || date < today || date > lastDate || unavailable.has(date)

  // ช่วงเช่าของวันที่เลือกไว้ (รับชุด → ใส่ → คืน)
  const range = selected ? { useDate: selected, ...getTimeline(selected) } : null

  const monthEvents = events.filter(
    (ev) => ev.startDate.slice(0, 7) === visibleMonth || ev.endDate.slice(0, 7) === visibleMonth,
  )

  return (
    <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="เดือนก่อนหน้า"
          disabled={visibleMonth <= firstMonth}
          onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
          className={navButtonClass}
        >
          <CaretLeftIcon size={20} weight="bold" />
        </button>
        <h3 className="text-h3 font-bold text-ink" aria-live="polite">
          {monthLabel}
        </h3>
        <button
          type="button"
          aria-label="เดือนถัดไป"
          disabled={visibleMonth >= lastMonth}
          onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
          className={navButtonClass}
        >
          <CaretRightIcon size={20} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-1.5 text-body-sm font-medium text-muted">
            {weekday}
          </div>
        ))}
        {days.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />
          const disabled = isDisabled(date)
          const isBooked = booked.has(date)
          const dayEvents = eventMap.get(date)

          const isUse = range?.useDate === date
          const isReceive = range?.receiveDate === date
          const isReturn = range?.returnBy === date
          const inRange = !!range && date > range.receiveDate && date < range.returnBy
          // แพ็กเกจ 1 วัน วันใส่กับวันคืนเป็นวันเดียวกัน จึงแสดงได้หลายป้ายในช่องเดียว
          const labels = [isReceive && 'รับชุด', isUse && 'ใส่', isReturn && 'คืน'].filter(Boolean).join('·')
          const sizesHere = bookedSizes.get(date) ?? []

          const tone = isUse
            ? 'bg-brand text-white font-bold'
            : isReceive || isReturn
              ? 'bg-brand-soft text-brand-strong font-semibold'
              : inRange
                ? 'bg-brand-subtle text-ink'
                : isBooked
                  ? 'cursor-not-allowed bg-sunken text-muted'
                  : disabled
                    ? 'cursor-not-allowed text-muted/50 line-through'
                    : 'text-ink hover:bg-sunken'

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              aria-label={`${formatThaiDateWithWeekday(date)}${isBooked ? ' ถูกจองแล้ว' : disabled ? ' เลือกเป็นวันใส่ไม่ได้' : ''}${sizesHere.length ? ` ไซส์ ${sizesHere.join(', ')} ถูกจองวันนี้` : ''}${dayEvents ? ` มีงาน ${dayEvents.map((e) => e.name).join(', ')}` : ''}`}
              aria-pressed={selected === date}
              title={
                [sizesHere.length ? `ไซส์ที่ถูกจอง: ${sizesHere.join(', ')}` : '', ...(dayEvents?.map((e) => e.name) ?? [])]
                  .filter(Boolean)
                  .join('\n') || undefined
              }
              onClick={() => onSelect(date)}
              className={`focus-ring relative flex h-12 flex-col items-center justify-center rounded-control text-body tabular-nums transition sm:h-14 ${tone} ${
                selected === date ? 'ring-2 ring-ink ring-offset-1' : ''
              }`}
            >
              <span>{Number(date.slice(-2))}</span>
              {labels && <span className="mt-0.5 text-caption font-medium leading-none">{labels}</span>}
              {!labels && sizesHere.length > 0 ? (
                <span
                  className={`mt-0.5 max-w-full truncate px-0.5 text-caption font-semibold leading-none ${
                    isBooked ? '' : 'text-secondary'
                  }`}
                >
                  {sizesCaption(sizesHere)}
                </span>
              ) : (
                isBooked &&
                !labels && (
                  <span className="mt-0.5 whitespace-nowrap text-caption font-medium leading-none">จองแล้ว</span>
                )
              )}
              {dayEvents && (
                <span className="absolute right-1.5 top-1.5 flex gap-0.5" aria-hidden="true">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span key={ev.id} className="h-1.5 w-1.5 rounded-full bg-info ring-1 ring-white" />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* บรรทัดอธิบายช่วงเช่าของวันที่เลือก */}
      <p
        className="mt-3 min-h-10 rounded-control bg-canvas px-3 py-2.5 text-center text-body-sm text-secondary"
        aria-live="polite"
      >
        {loading ? (
          'กำลังตรวจสอบวันที่ว่าง…'
        ) : range ? (
          <>
            ใส่วัน <b className="text-brand-strong">{formatThaiDateWithWeekday(range.useDate)}</b>
            {' → '}ได้รับชุด <b className="text-ink">{formatThaiDateWithWeekday(range.receiveDate)}</b>
            {' · '}ส่งคืนภายใน <b className="text-ink">{formatThaiDateWithWeekday(range.returnBy)}</b>
          </>
        ) : (
          'เลือกวันที่จะใส่ชุด เพื่อดูว่าจะได้รับชุดวันไหนและต้องส่งคืนวันไหน'
        )}
      </p>

      {/* คำอธิบายสี */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-body-sm text-secondary">
        <Legend swatch="bg-brand-soft" label="วันรับชุด / ส่งคืน" />
        <Legend swatch="bg-brand" label="วันใส่ชุด" />
        {events.length > 0 && <Legend swatch="bg-info" label="มีงานอีเวนต์" dot />}
        <Legend swatch="bg-sunken ring-1 ring-inset ring-line-subtle" label="ไซส์ที่เลือกถูกจองแล้ว" />
        {multiSize && (
          <span className="flex items-center gap-1.5">
            <span className="text-caption font-semibold text-secondary">S·M</span>
            ใต้วันที่ = ไซส์ที่ถูกจองวันนั้น
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="text-muted/50 line-through">12</span>
          เลือกเป็นวันใส่ไม่ได้
        </span>
      </div>

      {/* งานอีเวนต์ของเดือนที่แสดง */}
      {events.length > 0 && (
        <div className="mt-4 border-t border-line-subtle pt-4">
          <p className="mb-2 text-body font-bold text-ink">งานอีเวนต์เดือนนี้</p>
          {monthEvents.length === 0 ? (
            <p className="text-body-sm text-muted">ยังไม่มีงานอีเวนต์ในเดือนนี้</p>
          ) : (
            <ul className="space-y-2">
              {monthEvents.map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 rounded-control border border-line-subtle p-2.5">
                  <span className="shrink-0 rounded-control bg-info-subtle px-2 py-1 text-center text-body-sm font-bold leading-tight text-info">
                    {formatThaiDateWithWeekday(ev.startDate)}
                    {ev.endDate !== ev.startDate && (
                      <span className="block font-medium">ถึง {formatThaiDateWithWeekday(ev.endDate)}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-ink">{ev.name}</p>
                    <p className="flex items-center gap-1 truncate text-body-sm text-muted">
                      <MapPinIcon size={12} className="shrink-0" />
                      {ev.location}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Legend({ swatch, label, dot = false }: { swatch: string; label: string; dot?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`${swatch} ${dot ? 'h-1.5 w-1.5 rounded-full' : 'h-3 w-3 rounded'}`} />
      {label}
    </span>
  )
}
