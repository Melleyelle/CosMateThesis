'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarIcon } from '@phosphor-icons/react'
import { addDays, formatThaiDate, todayISO } from '@/utils/dateUtils'

export type DateRange = { from: string; to: string } // ISO 'YYYY-MM-DD', ว่าง = ไม่จำกัด

type Props = {
  value: DateRange
  onChange: (range: DateRange) => void
  emptyLabel?: string // ข้อความบนปุ่มตอนยังไม่เลือกช่วง
}

// ใช้วันที่ตามเวลาเครื่อง (ไทย) — toISOString() เป็นเวลา UTC ทำให้ช่วงตี 0–7 ได้วันที่ของเมื่อวาน
const PRESETS = [
  { label: 'วันนี้', from: () => todayISO() },
  { label: '7 วันล่าสุด', from: () => addDays(todayISO(), -6) },
  { label: '30 วันล่าสุด', from: () => addDays(todayISO(), -29) },
  { label: 'เดือนนี้', from: () => todayISO().slice(0, 8) + '01' },
]

// วันที่ (YYYY-MM-DD ตามเวลาไทย) ของ timestamp — ใช้เทียบกับช่วงที่เลือก
export function localDateOf(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
}

export function inDateRange(timestamp: string, range: DateRange): boolean {
  const d = localDateOf(timestamp)
  return (!range.from || d >= range.from) && (!range.to || d <= range.to)
}

function formatDisplay(range: DateRange, emptyLabel: string) {
  if (!range.from && !range.to) return emptyLabel
  const fmt = (iso: string) => formatThaiDate(iso)
  if (range.from && range.to) return `${fmt(range.from)} - ${fmt(range.to)}`
  if (range.from) return `ตั้งแต่ ${fmt(range.from)}`
  return `ถึง ${fmt(range.to)}`
}

export default function DateRangeFilter({ value, onChange, emptyLabel = 'ทุกวันที่อัปโหลด' }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange>(value)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function openPanel() {
    setDraft(value)
    setOpen(true)
  }

  function applyPreset(fromFn: () => string) {
    const range = { from: fromFn(), to: todayISO() }
    setDraft(range)
    onChange(range)
    setOpen(false)
  }

  function apply() {
    onChange(draft)
    setOpen(false)
  }

  function clear() {
    const empty = { from: '', to: '' }
    setDraft(empty)
    onChange(empty)
    setOpen(false)
  }

  const active = Boolean(value.from || value.to)

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
          active
            ? 'border-[#E5457F] bg-[#FCE7EF] text-[#E5457F]'
            : 'border-[#D5D9E0] bg-white text-[#263544] hover:border-[#9AA3AF]'
        }`}
      >
        <CalendarIcon size={18} weight={active ? 'fill' : 'regular'} />
        {formatDisplay(value, emptyLabel)}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-gray-500">ช่วงเวลายอดนิยม</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.from)}
                className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#FCE7EF] hover:text-[#E5457F]"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">จากวันที่</label>
              <input
                type="date"
                value={draft.from}
                max={draft.to || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">ถึงวันที่</label>
              <input
                type="date"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={clear}
              className="text-xs font-medium text-gray-400 hover:text-gray-600"
            >
              ล้างตัวกรอง
            </button>
            <button
              type="button"
              onClick={apply}
              className="rounded-full bg-[#E5457F] px-5 py-1.5 text-xs font-semibold text-white hover:bg-[#d13a72]"
            >
              ใช้ตัวกรอง
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
