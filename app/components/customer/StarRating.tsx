'use client'

import { useState } from 'react'
import { StarIcon } from '@phosphor-icons/react'

interface StarDisplayProps {
  value: number | null | undefined
  size?: number
}

export function StarDisplay({ value, size = 16 }: StarDisplayProps) {
  const rating = Number.isFinite(value) ? Math.min(5, Math.max(0, value ?? 0)) : 0

  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating.toFixed(1)} จาก 5 ดาว`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index))
        return (
          <span key={index} className="relative inline-flex" aria-hidden="true">
            <StarIcon size={size} weight="regular" className="text-[#E5A900]" />
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <StarIcon size={size} weight="fill" className="max-w-none text-[#E5A900]" />
              </span>
            )}
          </span>
        )
      })}
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
            <StarIcon size={34} weight="fill" className={i <= shown ? 'text-[#E5A900]' : 'text-[#E5E7EB]'} />
          </button>
        ))}
      </div>
      <span className="min-w-[64px] text-sm font-semibold text-[#263544]">{RATING_WORD[shown]}</span>
    </div>
  )
}