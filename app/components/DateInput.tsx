'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { isISODate, parseISODate, todayISO, toISODate } from '@/utils/dateUtils'

// ช่องวันที่แบบ วัน/เดือน/ปี (ค.ศ.) — input type="date" ของเบราว์เซอร์เรียงตามภาษาเครื่อง (มัก mm/dd/yyyy) บังคับไม่ได้
// value/onChange เป็น 'YYYY-MM-DD' เหมือนเดิม ว่าง = ยังไม่เลือก · พิมพ์เองได้หรือกดไอคอนเปิดปฏิทิน
type Props = {
  id?: string
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  invalid?: boolean
  className?: string // class ของช่องพิมพ์
  'aria-describedby'?: string
}

const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function toDisplay(iso: string) {
  if (!isISODate(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ตัวเลขที่พิมพ์ → dd/mm/yyyy ใส่ / ให้อัตโนมัติ
function maskDigits(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/')
}

function parseDisplay(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!match) return null
  const iso = `${match[3]}-${match[2]}-${match[1]}`
  // กัน 31/02 ที่ Date เลื่อนไปเดือนถัดไปเอง
  return toISODate(parseISODate(iso)) === iso ? iso : null
}

const inRange = (iso: string, min?: string, max?: string) => (!min || iso >= min) && (!max || iso <= max)

export default function DateInput({ id, value, onChange, min, max, invalid, className = '', ...aria }: Props) {
  const [text, setText] = useState(toDisplay(value))
  const [syncedValue, setSyncedValue] = useState(value)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => (value || todayISO()).slice(0, 7) + '-01')
  const rootRef = useRef<HTMLDivElement>(null)

  // ค่าเปลี่ยนจากข้างนอก (preset, ล้างตัวกรอง) → อัปเดตข้อความในช่อง
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(toDisplay(value))
  }

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function handleType(raw: string) {
    const masked = maskDigits(raw)
    setText(masked)
    if (!masked) return onChange('')
    const iso = parseDisplay(masked)
    if (iso && inRange(iso, min, max)) {
      setMonth(iso.slice(0, 7) + '-01')
      onChange(iso)
    }
  }

  function pick(iso: string) {
    setText(toDisplay(iso))
    onChange(iso)
    setOpen(false)
  }

  function toggle() {
    if (!open) setMonth((value || todayISO()).slice(0, 7) + '-01')
    setOpen((o) => !o)
  }

  const first = parseISODate(month)
  const shift = (n: number) => setMonth(toISODate(new Date(first.getFullYear(), first.getMonth() + n, 1)))
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISODate(new Date(first.getFullYear(), first.getMonth(), i + 1))),
  ]
  const today = todayISO()
  const monthLabel = first.toLocaleDateString('th-TH-u-ca-gregory', { month: 'long', year: 'numeric' })

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="วว/ดด/ปปปป"
        value={text}
        onChange={(e) => handleType(e.target.value)}
        // พิมพ์ไม่ครบหรือวันไม่ถูกต้อง → กลับไปแสดงค่าที่เลือกไว้
        onBlur={() => setText(toDisplay(value))}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={aria['aria-describedby']}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label="เปิดปฏิทิน"
        aria-expanded={open}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#263544]"
      >
        <CalendarBlankIcon size={18} />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-full min-w-64 max-w-xs rounded-2xl border border-gray-100 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} aria-label="เดือนก่อนหน้า" className="flex h-8 w-8 items-center justify-center rounded-full text-[#263544] hover:bg-[#F3F4F6]">
              <CaretLeftIcon size={16} />
            </button>
            <p className="text-sm font-semibold text-[#263544]">{monthLabel}</p>
            <button type="button" onClick={() => shift(1)} aria-label="เดือนถัดไป" className="flex h-8 w-8 items-center justify-center rounded-full text-[#263544] hover:bg-[#F3F4F6]">
              <CaretRightIcon size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1 text-[11px] font-medium text-[#9AA3AF]">
                {w}
              </span>
            ))}
            {cells.map((iso, i) =>
              iso ? (
                <button
                  key={iso}
                  type="button"
                  disabled={!inRange(iso, min, max)}
                  onClick={() => pick(iso)}
                  aria-label={parseISODate(iso).toLocaleDateString('th-TH', { dateStyle: 'long' })}
                  aria-pressed={iso === value}
                  className={`h-9 rounded-full text-sm tabular-nums transition disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent ${
                    iso === value
                      ? 'bg-[#E5457F] font-semibold text-white'
                      : iso === today
                        ? 'font-semibold text-[#E5457F] ring-1 ring-inset ring-[#E5457F]/40 hover:bg-[#FCE7EF]'
                        : 'text-[#263544] hover:bg-[#FCE7EF]'
                  }`}
                >
                  {Number(iso.slice(8))}
                </button>
              ) : (
                <span key={`blank-${i}`} />
              ),
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setText('')
                onChange('')
                setOpen(false)
              }}
              className="rounded-full px-2 py-1 text-gray-400 hover:text-gray-600"
            >
              ล้าง
            </button>
            {inRange(today, min, max) && (
              <button type="button" onClick={() => pick(today)} className="rounded-full px-2 py-1 text-[#E5457F] hover:bg-[#FCE7EF]">
                วันนี้
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
