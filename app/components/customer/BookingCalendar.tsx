'use client'

import { useMemo, useState } from 'react'
import { CaretLeftIcon, CaretRightIcon, MapPinIcon } from '@phosphor-icons/react'
import { addDays, formatThaiDateWithWeekday, todayISO, toISODate } from '@/utils/dateUtils'
import { EVENT_TONE, eventsByDate, type CalendarEvent } from '@/utils/customer/events'

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
}

const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const shifted = new Date(year, monthNumber - 1 + amount, 1)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`
}

export default function BookingCalendar({
  unavailable,
  selected,
  onSelect,
  daysAhead,
  loading,
  getTimeline,
  events = [],
}: BookingCalendarProps) {
  const today = todayISO()
  const lastDate = addDays(today, Math.max(0, daysAhead))
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
    <div className="rounded-2xl border border-[#263544]/15 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="เดือนก่อนหน้า"
          disabled={visibleMonth <= firstMonth}
          onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
          className="nudge flex h-9 w-9 items-center justify-center rounded-full text-[#263544] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CaretLeftIcon size={20} weight="bold" />
        </button>
        <h3 className="font-bold text-[#263544]">{monthLabel}</h3>
        <button
          type="button"
          aria-label="เดือนถัดไป"
          disabled={visibleMonth >= lastMonth}
          onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
          className="nudge flex h-9 w-9 items-center justify-center rounded-full text-[#263544] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CaretRightIcon size={20} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-1.5 text-sm font-medium text-[#263544]/55">
            {weekday}
          </div>
        ))}
        {days.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />
          const disabled = isDisabled(date)
          const dayEvents = eventMap.get(date)

          const isUse = range?.useDate === date
          const isReceive = range?.receiveDate === date
          const isReturn = range?.returnBy === date
          const inRange = !!range && date > range.receiveDate && date < range.returnBy
          // แพ็กเกจ 1 วัน วันใส่กับวันคืนเป็นวันเดียวกัน จึงแสดงได้หลายป้ายในช่องเดียว
          const labels = [isReceive && 'รับชุด', isUse && 'ใส่', isReturn && 'คืน'].filter(Boolean).join('·')

          const tone = isUse
            ? 'bg-[#E5457F] text-white font-bold'
            : isReceive || isReturn
              ? 'bg-[#FBD3E1] text-[#B8285D] font-semibold'
              : inRange
                ? 'bg-[#FEF1F5] text-[#263544]'
                  : disabled
                    ? 'cursor-not-allowed text-gray-300 line-through'
                    : 'nudge text-[#263544]'

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              aria-label={`${formatThaiDateWithWeekday(date)}${dayEvents ? ` มีงาน ${dayEvents.map((e) => e.name).join(', ')}` : ''}`}
              aria-pressed={selected === date}
              title={dayEvents?.map((e) => e.name).join('\n')}
              onClick={() => onSelect(date)}
              className={`relative flex h-14 flex-col items-center justify-center rounded-xl text-base transition sm:h-16 ${tone} ${
                selected === date ? 'ring-2 ring-[#263544] ring-offset-1' : ''
              }`}
            >
              <span>{Number(date.slice(-2))}</span>
              {labels && <span className="mt-0.5 text-xs font-medium leading-none">{labels}</span>}
              {dayEvents && (
                <span className="absolute right-1.5 top-1.5 flex gap-0.5" aria-hidden="true">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span key={ev.id} className={`h-1.5 w-1.5 rounded-full ${EVENT_TONE.yellow.dot} ring-1 ring-white`} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* บรรทัดอธิบายช่วงเช่าของวันที่เลือก */}
      <p className="mt-3 min-h-10 rounded-xl bg-[#F7F7F8] px-3 py-2.5 text-center text-base text-[#263544]/75" aria-live="polite">
        {loading ? (
          'กำลังตรวจสอบวันที่ว่าง…'
        ) : range ? (
          <>
            ใส่วัน <b className="text-[#E5457F]">{formatThaiDateWithWeekday(range.useDate)}</b>
            {' → '}ได้รับชุด <b className="text-[#B8285D]">{formatThaiDateWithWeekday(range.receiveDate)}</b>
            {' · '}ส่งคืนภายใน <b className="text-[#B8285D]">{formatThaiDateWithWeekday(range.returnBy)}</b>
          </>
        ) : (
          'เลือกวันที่จะใส่ชุด เพื่อดูว่าจะได้รับชุดวันไหนและต้องส่งคืนวันไหน'
        )}
      </p>

      {/* คำอธิบายสี */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm text-[#263544]/70">
        <Legend swatch="bg-[#FBD3E1]" label="วันรับชุด / ส่งคืน" />
        <Legend swatch="bg-[#E5457F]" label="วันใส่ชุด" />
        {events.length > 0 && <Legend swatch="bg-[#E5A900]" label="มีงานอีเวนต์" dot />}
        <span className="flex items-center gap-1.5">
          <span className="text-gray-300 line-through">12</span>
          ไม่ว่าง
        </span>
      </div>

      {/* งานอีเวนต์ของเดือนที่แสดง */}
      {events.length > 0 && (
        <div className="mt-4 border-t border-[#263544]/10 pt-4">
          <p className="mb-2 text-base font-bold text-[#263544]">งานอีเวนต์เดือนนี้</p>
          {monthEvents.length === 0 ? (
            <p className="text-base text-[#263544]/50">ยังไม่มีงานอีเวนต์ในเดือนนี้</p>
          ) : (
            <ul className="space-y-2">
              {monthEvents.map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 rounded-xl border border-[#263544]/10 p-2.5">
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-center text-sm font-bold leading-tight ${EVENT_TONE.yellow.chip}`}>
                    {formatThaiDateWithWeekday(ev.startDate)}
                    {ev.endDate !== ev.startDate && (
                      <span className="block font-medium">ถึง {formatThaiDateWithWeekday(ev.endDate)}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-[#263544]">{ev.name}</p>
                    <p className="flex items-center gap-1 truncate text-base text-[#263544]/55">
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
