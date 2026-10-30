'use client'

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { CheckIcon, XIcon } from '@phosphor-icons/react'
import { COLOR_OPTIONS, THEME_OPTIONS } from '@/utils/customer/filterOptions'
import { addDays, formatBaht, formatThaiDateWithWeekday, todayISO } from '@/utils/dateUtils'
import DateInput from '../DateInput'

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
  useDate: string | null // วันที่จะใส่ชุด (YYYY-MM-DD) → แสดงชุดที่ยังไม่มีคนจองไปใส่ครบทุกตัววันนั้น
}

// เลือกวันใส่ชุดล่วงหน้าได้เท่ากับปฏิทินหน้ารายละเอียดชุด
export const USE_DATE_DAYS_AHEAD = 120

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
  useDate: null,
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
// ไซส์รองเท้า EU 35–45 ตรงกับ shoe_size_defaults (Step 18) — เก็บใน filters.sizes ช่องเดียวกับเสื้อผ้า เพราะค่าไม่ซ้ำกัน
const SHOE_SIZE_OPTIONS = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']

/** ป้ายชิปตัวกรองของไซส์รองเท้า — เลขเปล่า ๆ อ่านไม่ออกว่าเป็นไซส์อะไร */
export const SHOE_SIZE_LABEL: Record<string, string> = Object.fromEntries(
  SHOE_SIZE_OPTIONS.map((s) => [s, `รองเท้า EU ${s}`]),
)

export function countActiveFilters(filters: ExploreFilterState): number {
  return (
    filters.categories.length +
    filters.genders.length +
    filters.sizes.length +
    filters.colors.length +
    filters.themes.length +
    (filters.series ? 1 : 0) +
    (filters.character ? 1 : 0) +
    (filters.useDate ? 1 : 0) +
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

  const today = todayISO()

  return (
    <div className="space-y-6 py-6">
      <FilterSection title="วันที่ใช้ชุด">
        <label htmlFor="explore-use-date" className="sr-only">
          วันที่ใช้ชุด
        </label>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <DateInput
              id="explore-use-date"
              min={today}
              max={addDays(today, USE_DATE_DAYS_AHEAD)}
              value={value.useDate ?? ''}
              onChange={(iso) => onChange((current) => ({ ...current, useDate: iso || null }))}
              className="focus-ring h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-body text-ink outline-none transition hover:border-secondary"
            />
          </div>
          {value.useDate && (
            <button
              type="button"
              onClick={() => onChange((current) => ({ ...current, useDate: null }))}
              aria-label="ล้างวันที่ใช้ชุด"
              className="focus-ring flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-secondary transition hover:bg-sunken hover:text-ink"
            >
              <XIcon size={16} weight="bold" />
            </button>
          )}
        </div>
        <p className="mt-2 text-body-sm text-muted">
          {value.useDate
            ? `แสดงชุดที่ยังไม่มีคนจองใส่วัน${formatThaiDateWithWeekday(value.useDate)} ตรวจวันจองได้อีกครั้งที่หน้าชุด`
            : 'เลือกวันที่จะใส่ เพื่อดูเฉพาะชุดที่ยังว่างวันนั้น'}
        </p>
      </FilterSection>

      <FilterSection title="ประเภทชุด">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((option) => (
            <Pill
              key={option.key}
              active={value.categories.includes(option.key)}
              onClick={() => toggle('categories', option.key)}
            >
              {option.label}
              <span className="ml-0.5 font-normal tabular-nums">{categoryCounts[option.key] ?? 0}</span>
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
        <h3 className="mb-2 text-body-sm font-semibold text-secondary">เสื้อผ้า</h3>
        <div className="flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((size) => (
            <Pill key={size} active={value.sizes.includes(size)} onClick={() => toggle('sizes', size)}>
              {size}
            </Pill>
          ))}
        </div>
        <h3 className="mb-2 mt-4 text-body-sm font-semibold text-secondary">รองเท้า (EU)</h3>
        <div className="flex flex-wrap gap-2">
          {SHOE_SIZE_OPTIONS.map((size) => (
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
                className={`focus-ring flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  active ? 'border-ink ring-2 ring-ink ring-offset-2' : 'border-black/15 hover:scale-105'
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
        <p className="mb-3 text-body font-semibold text-ink">
          {priceRangeLabel(value.priceMin, value.priceMax)}
        </p>
        <div className="relative h-6">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sunken" />
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand"
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
        <div className="mt-2 flex justify-between text-body-sm text-muted">
          <span>ต่ำกว่า {formatBaht(PRICE_FLOOR)}</span>
          <span>{formatBaht(PRICE_CEILING)}</span>
        </div>
      </FilterSection>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line-subtle pb-6 last:border-0 last:pb-0">
      <h2 className="mb-3 text-h3 font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}

// ตัวเลือกแบบเปิด/ปิด: เลือกแล้วมีเครื่องหมายถูกคู่กับสี (ไม่บอกด้วยสีอย่างเดียว)
// design v2: ที่เลือก = พื้น brand-soft เส้นดำ ตัวดำหนา · ไม่ได้เลือก = เส้นบาง hover แล้วเส้นดำโผล่
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring inline-flex min-h-10 items-center gap-1 rounded-full border px-3.5 text-body-sm transition ${
        active
          ? 'border-line bg-brand-soft font-bold text-ink'
          : 'border-line-subtle bg-surface font-medium text-ink hover:border-line'
      }`}
    >
      {active && <CheckIcon size={14} weight="bold" />}
      {children}
    </button>
  )
}
