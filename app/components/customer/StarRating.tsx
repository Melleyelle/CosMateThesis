'use client'

import { useState } from 'react'
import { StarIcon } from '@phosphor-icons/react'

const STAR_COLOR = '#F5B400'

// แสดงดาวแบบเติมสีตามสัดส่วน (รองรับทศนิยม เช่น 4.6)
export function StarDisplay({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} จาก 5 ดาว`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <StarIcon size={size} weight="fill" className="absolute inset-0 text-gray-200" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <StarIcon size={size} weight="fill" style={{ color: STAR_COLOR }} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

// ป้ายสั้นบนการ์ด: ★ 4.6 (36 รีวิว)
export function RatingBadge({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#263544]/70">
      <StarIcon size={13} weight="fill" style={{ color: STAR_COLOR }} />
      <span className="font-semibold text-[#263544]">{avg.toFixed(1)}</span>
      <span>({count} รีวิว)</span>
    </span>
  )
}

const RATING_WORD = ['', 'แย่มาก', 'ไม่ค่อยดี', 'พอใช้', 'ดี', 'ดีมาก']

// ให้คะแนน 1–5 ดาว (กดหรือใช้ลูกศรซ้าย/ขวาบนคีย์บอร์ด)
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label="ให้คะแนน"
        className="flex gap-1"
        onMouseLeave={() => setHover(0)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, (value || 0) + 1))
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(1, (value || 2) - 1))
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} ดาว`}
            tabIndex={value === i || (value === 0 && i === 1) ? 0 : -1}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            className="rounded transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5457F]/40"
          >
            <StarIcon
              size={34}
              weight="fill"
              style={{ color: i <= shown ? STAR_COLOR : '#E5E7EB' }}
            />
          </button>
        ))}
      </div>
      <span className="min-w-[64px] text-sm font-semibold text-[#263544]">{RATING_WORD[shown]}</span>
    </div>
  )
}
