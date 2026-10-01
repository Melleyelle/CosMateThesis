'use client'

import { useState } from 'react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { addDays, formatThaiDateWithWeekday, todayISO, toISODate } from '@/utils/dateUtils'

interface BookingCalendarProps {
  unavailable: Set<string>
  selected: string | null
  onSelect: (date: string) => void
  daysAhead: number
  loading: boolean
  receiveDate?: string
  returnBy?: string
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
  receiveDate,
  returnBy,
}: BookingCalendarProps) {
  const today = todayISO()
  const lastDate = addDays(today, Math.max(0, daysAhead))
  const firstMonth = today.slice(0, 7)
  const lastMonth = lastDate.slice(0, 7)
  const [visibleMonth, setVisibleMonth] = useState(firstMonth)

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

  return (
    <div className="rounded-2xl border border-[#263544]/15 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="เดือนก่อนหน้า"
          disabled={visibleMonth <= firstMonth}
          onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#263544] transition hover:bg-[#FDE3EE] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CaretLeftIcon size={20} weight="bold" />
        </button>
        <h3 className="font-bold text-[#263544]">{monthLabel}</h3>
        <button
          type="button"
          aria-label="เดือนถัดไป"
          disabled={visibleMonth >= lastMonth}
          onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#263544] transition hover:bg-[#FDE3EE] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CaretRightIcon size={20} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-2 text-xs font-medium text-[#263544]/55">
            {weekday}
          </div>
        ))}
        {days.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />
          const disabled = loading || date < today || date > lastDate || unavailable.has(date)
          const isSelected = selected === date

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              aria-label={formatThaiDateWithWeekday(date)}
              aria-pressed={isSelected}
              onClick={() => onSelect(date)}
              className={`aspect-square rounded-full text-sm transition ${
                isSelected
                  ? 'bg-[#E5457F] font-bold text-white'
                  : disabled
                    ? 'cursor-not-allowed text-gray-300 line-through'
                    : 'text-[#263544] hover:bg-[#FDE3EE]'
              }`}
            >
              {Number(date.slice(-2))}
            </button>
          )
        })}
      </div>

      {loading && <p className="mt-3 text-center text-xs text-[#263544]/55">กำลังตรวจสอบวันที่ว่าง…</p>}
      {selected && (receiveDate || returnBy) && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#263544]/10 pt-3 text-xs">
          {receiveDate && (
            <p className="text-[#263544]/65">
              รับชุด <span className="block font-semibold text-[#263544]">{formatThaiDateWithWeekday(receiveDate)}</span>
            </p>
          )}
          {returnBy && (
            <p className="text-right text-[#263544]/65">
              คืนภายใน <span className="block font-semibold text-[#263544]">{formatThaiDateWithWeekday(returnBy)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}