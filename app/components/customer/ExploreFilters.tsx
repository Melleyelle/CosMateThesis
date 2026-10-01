'use client'

import type { Dispatch, SetStateAction } from 'react'
import { COLOR_OPTIONS, THEME_OPTIONS } from '@/utils/customer/filterOptions'

export type ExploreFilterState = {
  categories: string[]
  genders: string[]
  sizes: string[]
  colors: string[]
  themes: string[]
  series: string[]
  priceMin: number | null
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

type FilterField = 'categories' | 'genders' | 'sizes' | 'colors' | 'themes' | 'series'

interface ExploreFiltersProps {
  value: ExploreFilterState
  onChange: Dispatch<SetStateAction<ExploreFilterState>>
  categoryCounts: Record<string, number>
  seriesOptions: { name: string; count: number }[]
  priceBounds: { min: number; max: number }
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
    filters.series.length +
    (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0)
  )
}

export default function ExploreFilters({
  value,
  onChange,
  categoryCounts,
  seriesOptions,
  priceBounds,
}: ExploreFiltersProps) {
  function toggle(field: FilterField, key: string) {
    onChange((current) => ({
      ...current,
      [field]: current[field].includes(key)
        ? current[field].filter((item) => item !== key)
        : [...current[field], key],
    }))
  }

  function setPrice(field: 'priceMin' | 'priceMax', raw: string) {
    const parsed = raw === '' ? null : Number(raw)
    onChange((current) => ({ ...current, [field]: parsed !== null && Number.isFinite(parsed) ? parsed : null }))
  }

  return (
    <div className="space-y-6 py-5">
      <FilterSection title="ประเภทชุด">
        {CATEGORY_OPTIONS.map((option) => (
          <FilterCheckbox
            key={option.key}
            label={option.label}
            count={categoryCounts[option.key] ?? 0}
            checked={value.categories.includes(option.key)}
            onChange={() => toggle('categories', option.key)}
          />
        ))}
      </FilterSection>

      <FilterSection title="เพศ">
        {GENDER_OPTIONS.map((option) => (
          <FilterCheckbox
            key={option.key}
            label={option.label}
            checked={value.genders.includes(option.key)}
            onChange={() => toggle('genders', option.key)}
          />
        ))}
      </FilterSection>

      <FilterSection title="ไซส์">
        {SIZE_OPTIONS.map((size) => (
          <FilterCheckbox
            key={size}
            label={size}
            checked={value.sizes.includes(size)}
            onChange={() => toggle('sizes', size)}
          />
        ))}
      </FilterSection>

      <FilterSection title="สี">
        {COLOR_OPTIONS.map((option) => (
          <FilterCheckbox
            key={option.key}
            label={option.label}
            checked={value.colors.includes(option.key)}
            onChange={() => toggle('colors', option.key)}
            swatch={option.hex}
          />
        ))}
      </FilterSection>

      <FilterSection title="ธีม">
        {THEME_OPTIONS.map((option) => (
          <FilterCheckbox
            key={option.key}
            label={option.label}
            checked={value.themes.includes(option.key)}
            onChange={() => toggle('themes', option.key)}
          />
        ))}
      </FilterSection>

      {seriesOptions.length > 0 && (
        <FilterSection title="เรื่อง / ซีรีส์">
          {seriesOptions.map((option) => (
            <FilterCheckbox
              key={option.name}
              label={option.name}
              count={option.count}
              checked={value.series.includes(option.name)}
              onChange={() => toggle('series', option.name)}
            />
          ))}
        </FilterSection>
      )}

      <FilterSection title="ราคาเริ่มต้น">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[#263544]/65">
            ต่ำสุด
            <input
              type="number"
              min={priceBounds.min}
              max={priceBounds.max}
              value={value.priceMin ?? ''}
              onChange={(event) => setPrice('priceMin', event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#263544]/20 bg-white px-2 py-2 text-sm text-[#263544] outline-none focus:border-[#E5457F]"
            />
          </label>
          <label className="text-xs text-[#263544]/65">
            สูงสุด
            <input
              type="number"
              min={priceBounds.min}
              max={priceBounds.max}
              value={value.priceMax ?? ''}
              onChange={(event) => setPrice('priceMax', event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#263544]/20 bg-white px-2 py-2 text-sm text-[#263544] outline-none focus:border-[#E5457F]"
            />
          </label>
        </div>
      </FilterSection>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#263544]/10 pb-5 last:border-0 last:pb-0">
      <h2 className="mb-3 text-sm font-bold text-[#263544]">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function FilterCheckbox({
  label,
  count,
  checked,
  onChange,
  swatch,
}: {
  label: string
  count?: number
  checked: boolean
  onChange: () => void
  swatch?: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#263544]/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-[#E5457F]"
      />
      {swatch && <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border border-black/15" style={{ backgroundColor: swatch }} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && <span className="text-xs text-[#263544]/45">{count}</span>}
    </label>
  )
}