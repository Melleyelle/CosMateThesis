'use client'

import { useMemo, useState } from 'react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { addDays, parseISODate, todayISO, toISODate } from '@/utils/dateUtils'

type Props = {
  unavailable: Set<string> // วันเริ่มใช้งานที่เลือกไม่ได้ (จาก get_unavailable_start_dates)
  selected: string | null
  onSelect: (iso: string) => void
  daysAhead: number
  loading?: boolean
  // ไฮไลต์วันรับชุด/วันส่งคืน ให้ลูกค้าเห็นภาพช่วงเช่าจริงทันทีที่เลือกวัน
  receiveDate?: string | null
  returnBy?: string | null
}

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function monthStart(iso: string): Date {
  const d = parseISODate(iso)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export default function BookingCalendar({
  unavailable,
  selected,
  onSelect,
  daysAhead,
  loading = false,
  receiveDate,
  returnBy,
}: Props) {
  const today = todayISO()
  const maxDate = addDays(today, daysAhead)
  const [cursor, setCursor] = useState<Date>(() => monthStart(selected ?? today))

  const minMonth = monthStart(today)
  const maxMonth = monthStart(maxDate)
  const canPrev = cursor > minMonth
  const canNext = cursor < maxMonth

  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const list: (string | null)[] = Array.from({ length: firstWeekday }, () => null)
    for (let day = 1; day <= daysInMonth; day++) {
      list.push(toISODate(new Date(year, month, day)))
    }
    return list
  }, [cursor])

  const monthLabel = cursor.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  // วันระหว่างวันรับชุดถึงวันส่งคืน (ช่วงที่ชุดอยู่กับลูกค้า)
  function inRentalRange(iso: string) {
    return !!receiveDate && !!returnBy && iso >= receiveDate && iso <= returnBy
  }

  return (
    <div className={`rounded-2xl border-2 border-[#263544] bg-white p-4 ${loading ? 'opacity-60' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          disabled={!canPrev}
          aria-label="เดือนก่อนหน้า"
          className="rounded-full p-1.5 text-[#263544] transition hover:bg-[#FDE3EE] disabled:opacity-20 disabled:hover:bg-transparent"
        >
          <CaretLeftIcon size={18} weight="bold" />
        </button>
        <p className="font-semibold text-[#263544]">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          disabled={!canNext}
          aria-label="เดือนถัดไป"
          className="rounded-full p-1.5 text-[#263544] transition hover:bg-[#FDE3EE] disabled:opacity-20 disabled:hover:bg-transparent"
        >
          <CaretRightIcon size={18} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-xs font-medium text-[#263544]/50">
            {w}
          </div>
        ))}

        {cells.map((iso, index) => {
          if (!iso) return <div key={`blank-${index}`} />

          const outOfRange = iso < today || iso > maxDate
          const blocked = unavailable.has(iso)
          const disabled = loading || outOfRange || blocked
          const isSelected = iso === selected
          const isReceive = iso === receiveDate && !isSelected
          const isReturn = iso === returnBy && !isSelected
          const inRange = inRentalRange(iso) && !isSelected

          let style = 'text-[#263544] hover:bg-[#FDE3EE]'
          if (outOfRange) style = 'text-gray-200'
          else if (blocked) style = 'text-gray-300 line-through'
          if (inRange) style = 'bg-[#FDE3EE] text-[#E5457F] font-semibold'
          if (isSelected) style = 'bg-[#E5457F] text-white font-bold ring-2 ring-[#263544]'

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled && !isSelected}
              onClick={() => onSelect(iso)}
              title={
                isReceive
                  ? 'วันที่ได้รับชุด'
                  : isReturn
                    ? 'วันส่งชุดคืน'
                    : blocked
                      ? 'วันนี้ไม่ว่าง'
                      : undefined
              }
              className={`relative aspect-square rounded-lg text-sm transition disabled:cursor-not-allowed ${style}`}
            >
              {parseISODate(iso).getDate()}
              {(isReceive || isReturn) && (
                <span className="absolute inset-x-0 bottom-0.5 text-[9px] font-medium leading-none">
                  {isReceive ? 'รับ' : 'คืน'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-[#263544]/60">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#E5457F]" /> วันใช้งาน
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#FDE3EE]" /> ชุดอยู่กับคุณ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-gray-300 line-through">12</span> ไม่ว่าง
        </span>
      </div>
    </div>
  )
}
