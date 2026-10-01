'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { CaretDownIcon, CheckIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { COLOR_OPTIONS, THEME_OPTIONS } from '@/utils/customer/filterOptions'
import { SIZE_ORDER } from '@/utils/customer/labels'
import { formatBaht } from '@/utils/dateUtils'

export type ExploreFilterState = {
  categories: string[]
  genders: string[]
  sizes: string[]
  colors: string[]
  themes: string[]
  series: string[]
  priceMin: number | null // null = ไม่จำกัด
  priceMax: number | null
}

export const EMPTY_FILTERS: ExploreFilterState = {
  categories: [],
  genders: [],
  sizes: [],
  colors: [],
  themes: [],
  series: [],
  priceMin: null,
  priceMax: null,
}

export function countActiveFilters(f: ExploreFilterState): number {
  return (
    f.categories.length +
    f.genders.length +
    f.sizes.length +
    f.colors.length +
    f.themes.length +
    f.series.length +
    (f.priceMin !== null || f.priceMax !== null ? 1 : 0)
  )
}

const CATEGORY_OPTIONS = [
  { value: 'cosplay', label: 'Cosplay' },
  { value: 'fancy', label: 'Fancy' },
  { value: 'props_shoes', label: 'Props' },
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'ชาย' },
  { value: 'female', label: 'หญิง' },
  { value: 'unisex', label: 'Unisex' },
]

type Props = {
  value: ExploreFilterState
  onChange: (next: ExploreFilterState) => void
  categoryCounts: Record<string, number>
  seriesOptions: { name: string; count: number }[] // เรียงจากมากไปน้อยแล้ว
  priceBounds: { min: number; max: number }
}

// แถบตัวกรองด้านซ้ายตาม wireframe: หัวข้อพับได้ + checkbox 2 คอลัมน์ + จุดสี + เส้นลากราคา + ชิปยอดนิยม
export default function ExploreFilters({ value, onChange, categoryCounts, seriesOptions, priceBounds }: Props) {
  const [seriesQuery, setSeriesQuery] = useState('')

  function toggle(key: 'categories' | 'genders' | 'sizes' | 'colors' | 'themes' | 'series', item: string) {
    const list = value[key]
    onChange({ ...value, [key]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item] })
  }

  const visibleSeries = useMemo(() => {
    const q = seriesQuery.trim().toLowerCase()
    return q ? seriesOptions.filter((s) => s.name.toLowerCase().includes(q)) : seriesOptions
  }, [seriesOptions, seriesQuery])

  const popular = seriesOptions.slice(0, 6)

  return (
    <div className="space-y-1">
      <FilterSection title="ประเภทชุด">
        <div className="space-y-2.5">
          {CATEGORY_OPTIONS.map((c) => (
            <CheckRow
              key={c.value}
              label={c.label}
              count={categoryCounts[c.value] ?? 0}
              checked={value.categories.includes(c.value)}
              onToggle={() => toggle('categories', c.value)}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="เพศตัวละคร">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {GENDER_OPTIONS.map((g) => (
            <CheckRow
              key={g.value}
              label={g.label}
              checked={value.genders.includes(g.value)}
              onToggle={() => toggle('genders', g.value)}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="ไซส์">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {SIZE_ORDER.map((s) => (
            <CheckRow key={s} label={s} checked={value.sizes.includes(s)} onToggle={() => toggle('sizes', s)} />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="สีชุด">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {COLOR_OPTIONS.map((c) => {
            const checked = value.colors.includes(c.key)
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle('colors', c.key)}
                aria-pressed={checked}
                className="flex items-center gap-2 text-left text-sm text-[#263544]"
              >
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                    checked ? 'border-[#E5457F] ring-2 ring-[#E5457F]/30' : 'border-[#263544]/20'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {checked && (
                    <CheckIcon size={12} weight="bold" className={c.key === 'white' || c.key === 'yellow' ? 'text-[#263544]' : 'text-white'} />
                  )}
                </span>
                <span className={checked ? 'font-semibold' : ''}>{c.label}</span>
              </button>
            )
          })}
        </div>
      </FilterSection>

      <FilterSection title="ธีมงาน">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {THEME_OPTIONS.map((t) => (
            <CheckRow
              key={t.key}
              label={t.label}
              checked={value.themes.includes(t.key)}
              onToggle={() => toggle('themes', t.key)}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="ราคา">
        <PriceRange value={value} onChange={onChange} bounds={priceBounds} />
      </FilterSection>

      <FilterSection title="ตัวละคร/ชื่อเรื่อง" last>
        <div className="relative mb-3">
          <MagnifyingGlassIcon
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={seriesQuery}
            onChange={(e) => setSeriesQuery(e.target.value)}
            placeholder="พิมพ์ชื่อเรื่อง..."
            className="w-full rounded-full border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
          />
        </div>

        {seriesOptions.length === 0 ? (
          <p className="text-xs text-[#263544]/50">ยังไม่มีข้อมูลชื่อเรื่อง</p>
        ) : (
          <div className="max-h-44 space-y-2.5 overflow-y-auto pr-1">
            {visibleSeries.map((s) => (
              <CheckRow
                key={s.name}
                label={s.name}
                count={s.count}
                checked={value.series.includes(s.name)}
                onToggle={() => toggle('series', s.name)}
              />
            ))}
            {visibleSeries.length === 0 && <p className="text-xs text-[#263544]/50">ไม่พบชื่อเรื่องนี้</p>}
          </div>
        )}

        {popular.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-xs font-medium text-[#263544]/60">ยอดนิยม</p>
            <div className="flex flex-wrap gap-2">
              {popular.map((s) => {
                const active = value.series.includes(s.name)
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => toggle('series', s.name)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? 'border-[#263544] bg-[#263544] text-white'
                        : 'border-[#263544]/30 bg-white text-[#263544] hover:border-[#263544]'
                    }`}
                  >
                    {s.name}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </FilterSection>

      <div className="pt-6">
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          disabled={countActiveFilters(value) === 0}
          className="w-full rounded-xl bg-[#263544] py-3 text-sm font-semibold text-white transition hover:bg-[#1a2632] disabled:opacity-40"
        >
          ล้างตัวกรองทั้งหมด
        </button>
      </div>
    </div>
  )
}

function FilterSection({ title, children, last = false }: { title: string; children: ReactNode; last?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <section className={`py-5 ${last ? '' : 'border-b border-[#263544]/10'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-lg font-semibold text-[#263544]">{title}</span>
        <CaretDownIcon
          size={18}
          weight="bold"
          className={`text-[#263544] transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </section>
  )
}

function CheckRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string
  count?: number
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-[#263544]">
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#E5457F]/40 ${
          checked ? 'border-[#E5457F] bg-[#E5457F] text-white' : 'border-transparent bg-[#E4E4E7]'
        }`}
      >
        {checked && <CheckIcon size={14} weight="bold" />}
      </span>
      <span className={`min-w-0 truncate ${checked ? 'font-semibold' : ''}`}>{label}</span>
      {count !== undefined && <span className="text-xs text-[#263544]/40">({count})</span>}
    </label>
  )
}

// เส้นลากราคาแบบ 2 หัว (ต่ำสุด-สูงสุด) ทำจาก input range 2 ตัวซ้อนกัน
function PriceRange({
  value,
  onChange,
  bounds,
}: {
  value: ExploreFilterState
  onChange: (next: ExploreFilterState) => void
  bounds: { min: number; max: number }
}) {
  if (bounds.max <= bounds.min) {
    return <p className="text-xs text-[#263544]/50">ราคาทุกชุดเท่ากัน ({formatBaht(bounds.min)})</p>
  }

  const step = bounds.max - bounds.min > 1000 ? 50 : 10
  const lo = value.priceMin ?? bounds.min
  const hi = value.priceMax ?? bounds.max
  const pct = (n: number) => ((n - bounds.min) / (bounds.max - bounds.min)) * 100

  const thumb =
    'pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#263544] [&::-webkit-slider-thumb]:bg-white ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#263544] [&::-moz-range-thumb]:bg-white'

  return (
    <div>
      <div className="relative h-6">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-[#E4E4E7]" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#E5457F]"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input
          type="range"
          aria-label="ราคาต่ำสุด"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={lo}
          onChange={(e) => {
            const n = Math.min(Number(e.target.value), hi)
            onChange({ ...value, priceMin: n <= bounds.min ? null : n })
          }}
          className={thumb}
        />
        <input
          type="range"
          aria-label="ราคาสูงสุด"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={hi}
          onChange={(e) => {
            const n = Math.max(Number(e.target.value), lo)
            onChange({ ...value, priceMax: n >= bounds.max ? null : n })
          }}
          className={thumb}
        />
      </div>
      <div className="mt-2 flex justify-between text-sm font-semibold text-[#263544]">
        <span>{formatBaht(lo)}</span>
        <span>{formatBaht(hi)}</span>
      </div>
    </div>
  )
}
