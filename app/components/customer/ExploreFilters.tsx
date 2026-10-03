'use client'

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { CheckIcon } from '@phosphor-icons/react'
import { COLOR_OPTIONS, THEME_OPTIONS } from '@/utils/customer/filterOptions'
import { formatBaht } from '@/utils/dateUtils'

export type ExploreFilterState = {
  categories: string[]
  genders: string[]
  sizes: string[]
  colors: string[]
  themes: string[]
  series: string | null // เลือกจากแถวบนของผลลัพธ์
  character: string | null // เลือกได้หลังเลือกเรื่องแล้วเท่านั้น
  priceMin: number | null // null = ไม่จำกัด (ต่ำกว่า PRICE_FLOOR ก็ผ่าน)
  priceMax: number | null // null = ไม่จำกัด (เกิน PRICE_CEILING ก็ผ่าน)
}

export const EMPTY_FILTERS: ExploreFilterState = {
  categories: [],
  genders: [],
  sizes: [],
  colors: [],
  themes: [],
  series: null,
  character: null,
  priceMin: null,
  priceMax: null,
}

// แถบเลื่อนราคา: ซ้ายสุด = "ต่ำกว่า ฿250" (ไม่จำกัดขั้นต่ำ) / ขวาสุด = ฿2,500 ขึ้นไป (ไม่จำกัดเพดาน)
export const PRICE_FLOOR = 250
export const PRICE_CEILING = 2500
const PRICE_STEP = 50

type ListField = 'categories' | 'genders' | 'sizes' | 'colors' | 'themes'

interface ExploreFiltersProps {
  value: ExploreFilterState
  onChange: Dispatch<SetStateAction<ExploreFilterState>>
  categoryCounts: Record<string, number>
}

const CATEGORY_OPTIONS = [
  { key: 'cosplay', label: 'คอสเพลย์' },
  { key: 'fancy', label: 'แฟนซี' },
  { key: 'props_shoes', label: 'พร็อพ / รองเท้า' },
]

const GENDER_OPTIONS = [
  { key: 'male', label: 'ชาย' },
  { key: 'female', label: 'หญิง' },
  { key: 'unisex', label: 'Unisex' },
]

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size']

export function countActiveFilters(filters: ExploreFilterState): number {
  return (
    filters.categories.length +
    filters.genders.length +
    filters.sizes.length +
    filters.colors.length +
    filters.themes.length +
    (filters.series ? 1 : 0) +
    (filters.character ? 1 : 0) +
    (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0)
  )
}

export function priceRangeLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'ทุกราคา'
  if (min === null) return `ไม่เกิน ${formatBaht(max ?? 0)}`
  if (max === null) return `${formatBaht(min)} ขึ้นไป`
  return `${formatBaht(min)} – ${formatBaht(max)}`
}

export default function ExploreFilters({ value, onChange, categoryCounts }: ExploreFiltersProps) {
  function toggle(field: ListField, key: string) {
    onChange((current) => ({
      ...current,
      [field]: current[field].includes(key)
        ? current[field].filter((item) => item !== key)
        : [...current[field], key],
    }))
  }

  const lo = value.priceMin ?? PRICE_FLOOR
  const hi = value.priceMax ?? PRICE_CEILING

  function setRange(nextLo: number, nextHi: number) {
    onChange((current) => ({
      ...current,
      priceMin: nextLo <= PRICE_FLOOR ? null : nextLo,
      priceMax: nextHi >= PRICE_CEILING ? null : nextHi,
    }))
  }

  const pct = (n: number) => ((n - PRICE_FLOOR) / (PRICE_CEILING - PRICE_FLOOR)) * 100

  return (
    <div className="space-y-6 py-6">
      <FilterSection title="ประเภทชุด">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((option) => (
            <Pill
              key={option.key}
              active={value.categories.includes(option.key)}
              onClick={() => toggle('categories', option.key)}
            >
              {option.label}
              <span className="ml-1 opacity-60">{categoryCounts[option.key] ?? 0}</span>
            </Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="เพศ">
        <div className="flex flex-wrap gap-2">
          {GENDER_OPTIONS.map((option) => (
            <Pill key={option.key} active={value.genders.includes(option.key)} onClick={() => toggle('genders', option.key)}>
              {option.label}
            </Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="ไซส์">
        <div className="flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((size) => (
            <Pill key={size} active={value.sizes.includes(size)} onClick={() => toggle('sizes', size)}>
              {size}
            </Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="สี">
        <div className="flex flex-wrap gap-2.5">
          {COLOR_OPTIONS.map((option) => {
            const active = value.colors.includes(option.key)
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => toggle('colors', option.key)}
                aria-pressed={active}
                aria-label={`สี${option.label}`}
                title={option.label}
                className={`nudge flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                  active ? 'border-[#263544] ring-2 ring-[#E5457F] ring-offset-2' : 'border-black/10'
                }`}
                style={{ backgroundColor: option.hex }}
              >
                {active && (
                  <CheckIcon size={16} weight="bold" className="text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                )}
              </button>
            )
          })}
        </div>
      </FilterSection>

      <FilterSection title="ธีม">
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => (
            <Pill key={option.key} active={value.themes.includes(option.key)} onClick={() => toggle('themes', option.key)}>
              {option.label}
            </Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="ราคาเช่า">
        <p className="mb-3 text-base font-semibold text-[#E5457F]">
          {priceRangeLabel(value.priceMin, value.priceMax)}
        </p>
        <div className="relative h-6">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#263544]/10" />
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#E5457F]"
            style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
          />
          <input
            type="range"
            min={PRICE_FLOOR}
            max={PRICE_CEILING}
            step={PRICE_STEP}
            value={lo}
            onChange={(e) => setRange(Math.min(Number(e.target.value), hi - PRICE_STEP), hi)}
            aria-label="ราคาต่ำสุด"
            className="range-thumb absolute inset-0 w-full"
          />
          <input
            type="range"
            min={PRICE_FLOOR}
            max={PRICE_CEILING}
            step={PRICE_STEP}
            value={hi}
            onChange={(e) => setRange(lo, Math.max(Number(e.target.value), lo + PRICE_STEP))}
            aria-label="ราคาสูงสุด"
            className="range-thumb absolute inset-0 w-full"
          />
        </div>
        <div className="mt-2 flex justify-between text-sm text-[#263544]/55">
          <span>ต่ำกว่า {formatBaht(PRICE_FLOOR)}</span>
          <span>{formatBaht(PRICE_CEILING)}</span>
        </div>
      </FilterSection>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#263544]/10 pb-6 last:border-0 last:pb-0">
      <h2 className="mb-3 text-base font-bold text-[#263544]">{title}</h2>
      {children}
    </section>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border-2 px-3.5 py-1.5 text-base font-medium transition ${
        active
          ? 'border-[#263544] bg-[#E5457F] text-white shadow-[2px_2px_0_0_#263544]'
          : 'border-transparent bg-white text-[#263544] hover:border-[#263544]/30'
      }`}
    >
      {children}
    </button>
  )
}
