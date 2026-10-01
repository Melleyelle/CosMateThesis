'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowsDownUpIcon, FunnelSimpleIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import CostumeGridCard from '@/app/components/customer/CostumeGridCard'
import Pagination from '@/app/components/customer/Pagination'
import ExploreFilters, {
  EMPTY_FILTERS,
  countActiveFilters,
  type ExploreFilterState,
} from '@/app/components/customer/ExploreFilters'
import { fetchCatalog, type CatalogCostume } from '@/utils/customer/fetchCatalog'
import {
  DEFAULT_BOOKING_SETTINGS,
  customerHeldDays,
  fetchBookingSettings,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'
import { COLOR_OPTIONS, THEME_OPTIONS } from '@/utils/customer/filterOptions'
import { formatBaht } from '@/utils/dateUtils'

const PAGE_SIZE = 12

const SORT_OPTIONS = [
  { value: 'newest', label: 'สินค้าใหม่' },
  { value: 'rating', label: 'คะแนนรีวิวสูงสุด' },
  { value: 'price_asc', label: 'ราคาต่ำ → สูง' },
  { value: 'price_desc', label: 'ราคาสูง → ต่ำ' },
  { value: 'name', label: 'ชื่อ A → Z' },
] as const
type SortValue = (typeof SORT_OPTIONS)[number]['value']

const CATEGORY_LABEL: Record<string, string> = { cosplay: 'Cosplay', fancy: 'Fancy', props_shoes: 'Props' }
const GENDER_LABEL: Record<string, string> = { male: 'ชาย', female: 'หญิง', unisex: 'Unisex' }
const COLOR_LABEL = Object.fromEntries(COLOR_OPTIONS.map((c) => [c.key, `สี${c.label}`]))
const THEME_LABEL = Object.fromEntries(THEME_OPTIONS.map((t) => [t.key, t.label]))

function ExploreInner() {
  const searchParams = useSearchParams()
  const gridTopRef = useRef<HTMLDivElement>(null)

  const [costumes, setCostumes] = useState<CatalogCostume[]>([])
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [filters, setFilters] = useState<ExploreFilterState>(() => {
    const cat = searchParams.get('category')
    return cat && CATEGORY_LABEL[cat] ? { ...EMPTY_FILTERS, categories: [cat] } : EMPTY_FILTERS
  })
  const [sort, setSort] = useState<SortValue>('newest')
  const [page, setPage] = useState(1)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  useEffect(() => {
    Promise.all([fetchCatalog(), fetchBookingSettings()]).then(([res, s]) => {
      setSettings(s)
      if (res.error) setLoadError(res.error)
      else setCostumes(res.data)
      setLoading(false)
    })
  }, [])

  // เปลี่ยนเงื่อนไขค้นหา/กรอง/เรียง → กลับไปหน้า 1
  useEffect(() => {
    setPage(1)
  }, [filters, search, sort])

  // ตัวเลือกที่คำนวณจากข้อมูลจริง
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    costumes.forEach((c) => {
      if (c.costumeCategory) counts[c.costumeCategory] = (counts[c.costumeCategory] ?? 0) + 1
    })
    return counts
  }, [costumes])

  const seriesOptions = useMemo(() => {
    const counts = new Map<string, number>()
    costumes.forEach((c) => {
      if (c.seriesName) counts.set(c.seriesName, (counts.get(c.seriesName) ?? 0) + 1)
    })
    return Array.from(counts, ([name, count]) => ({ name, count })).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    )
  }, [costumes])

  const priceBounds = useMemo(() => {
    const prices = costumes.map((c) => c.minPrice).filter((p): p is number => p !== null)
    if (prices.length === 0) return { min: 0, max: 0 }
    return { min: Math.floor(Math.min(...prices) / 10) * 10, max: Math.ceil(Math.max(...prices) / 10) * 10 }
  }, [costumes])

  const results = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const f = filters
    const priceActive = f.priceMin !== null || f.priceMax !== null

    const list = costumes.filter((c) => {
      if (f.categories.length && !f.categories.includes(c.costumeCategory ?? '')) return false
      if (f.genders.length && !f.genders.includes(c.genderTag ?? '')) return false
      if (f.sizes.length && !c.sizes.some((s) => f.sizes.includes(s))) return false
      if (f.colors.length && !c.colorKeys.some((k) => f.colors.includes(k))) return false
      if (f.themes.length && !c.themeKeys.some((k) => f.themes.includes(k))) return false
      if (f.series.length && !f.series.includes(c.seriesName ?? '')) return false
      if (priceActive) {
        if (c.minPrice === null) return false
        if (f.priceMin !== null && c.minPrice < f.priceMin) return false
        if (f.priceMax !== null && c.minPrice > f.priceMax) return false
      }
      if (keyword) {
        const haystack = `${c.name} ${c.characterName ?? ''} ${c.seriesName ?? ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })

    const byPrice = (a: CatalogCostume, b: CatalogCostume, dir: 1 | -1) => {
      if (a.minPrice === null) return 1
      if (b.minPrice === null) return -1
      return (a.minPrice - b.minPrice) * dir
    }
    return list.sort((a, b) => {
      if (sort === 'price_asc') return byPrice(a, b, 1)
      if (sort === 'price_desc') return byPrice(a, b, -1)
      if (sort === 'name') return a.name.localeCompare(b.name, 'th')
      if (sort === 'rating') return (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.reviewCount - a.reviewCount
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [costumes, filters, search, sort])

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeCount = countActiveFilters(filters)

  // ชิปแสดงตัวกรองที่เลือกอยู่ กดกากบาทเพื่อเอาออกทีละอัน
  const chips = useMemo(() => {
    const list: { key: string; label: string; remove: () => void }[] = []
    const add = (field: 'categories' | 'genders' | 'sizes' | 'colors' | 'themes' | 'series', labels?: Record<string, string>) =>
      filters[field].forEach((v) =>
        list.push({
          key: `${field}-${v}`,
          label: labels?.[v] ?? v,
          remove: () => setFilters((f) => ({ ...f, [field]: f[field].filter((x) => x !== v) })),
        }),
      )
    add('categories', CATEGORY_LABEL)
    add('genders', GENDER_LABEL)
    add('sizes')
    add('colors', COLOR_LABEL)
    add('themes', THEME_LABEL)
    add('series')
    if (filters.priceMin !== null || filters.priceMax !== null) {
      list.push({
        key: 'price',
        label: `${formatBaht(filters.priceMin ?? priceBounds.min)} – ${formatBaht(filters.priceMax ?? priceBounds.max)}`,
        remove: () => setFilters((f) => ({ ...f, priceMin: null, priceMax: null })),
      })
    }
    return list
  }, [filters, priceBounds])

  function goToPage(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages))
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filterPanel = (
    <ExploreFilters
      value={filters}
      onChange={setFilters}
      categoryCounts={categoryCounts}
      seriesOptions={seriesOptions}
      priceBounds={priceBounds}
    />
  )

  return (
    <>
      {/* ---------------- แบนเนอร์ค้นหา ---------------- */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <section
          className="rounded-3xl bg-[#FDE3EE] px-4 py-8 text-center sm:py-10"
          style={{
            backgroundImage: 'radial-gradient(rgba(229,69,127,0.28) 1.5px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }}
        >
          <h1 className="text-3xl font-extrabold text-[#263544]">สำรวจชุด</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(searchInput)
            }}
            className="mx-auto mt-4 flex max-w-md overflow-hidden rounded-full border-2 border-[#263544] bg-white shadow-[3px_3px_0_0_#263544]"
          >
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                if (e.target.value === '') setSearch('')
              }}
              placeholder="ค้นหาชื่อชุด ตัวละคร หรือชื่อเรื่อง"
              className="min-w-0 flex-1 px-5 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
            <button
              type="submit"
              aria-label="ค้นหา"
              className="flex items-center justify-center bg-[#E5457F] px-5 text-white transition hover:bg-[#d23a70]"
            >
              <MagnifyingGlassIcon size={20} weight="bold" />
            </button>
          </form>
        </section>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl gap-8 px-4 sm:px-6">
        {/* ---------------- ตัวกรองซ้าย (จอใหญ่) ---------------- */}
        <aside className="hidden w-72 flex-shrink-0 self-start rounded-3xl bg-[#F7F7F8] px-6 pb-6 lg:block">
          {filterPanel}
        </aside>

        {/* ---------------- ผลลัพธ์ ---------------- */}
        <section className="min-w-0 flex-1" ref={gridTopRef}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="flex items-center gap-2 rounded-full border-2 border-[#263544] px-4 py-2 text-sm font-semibold text-[#263544] lg:hidden"
            >
              <FunnelSimpleIcon size={18} />
              ตัวกรอง
              {activeCount > 0 && (
                <span className="rounded-full bg-[#E5457F] px-1.5 text-xs text-white">{activeCount}</span>
              )}
            </button>

            <p className="text-sm text-[#263544]/70">
              {search ? (
                <>
                  ผลการค้นหา &quot;<span className="font-semibold text-[#263544]">{search}</span>&quot;:{' '}
                </>
              ) : (
                'จำนวนสินค้าที่ค้นพบ: '
              )}
              <span className="font-semibold text-[#263544]">{loading ? '…' : results.length} ชิ้น</span>
            </p>

            <label className="relative ml-auto flex items-center">
              <ArrowsDownUpIcon size={16} className="pointer-events-none absolute left-3 text-[#263544]" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortValue)}
                aria-label="เรียงลำดับ"
                className="appearance-none rounded-full border border-[#263544]/30 bg-white py-2 pl-9 pr-9 text-sm font-medium text-[#263544] outline-none focus:border-[#E5457F]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 text-[10px] text-[#263544]">▼</span>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.remove}
                  className="flex items-center gap-1 rounded-full bg-[#FDE3EE] px-3 py-1 text-xs font-medium text-[#E5457F] transition hover:bg-[#fbd0e2]"
                >
                  {chip.label}
                  <XIcon size={12} weight="bold" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs font-semibold text-[#263544]/60 underline hover:text-[#263544]"
              >
                ล้างทั้งหมด
              </button>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          )}

          {!loading && loadError && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-6 text-center text-sm text-red-600">
              {loadError}
            </p>
          )}

          {!loading && !loadError && results.length === 0 && (
            <div className="rounded-3xl bg-[#F7F7F8] px-4 py-16 text-center">
              <p className="text-[#263544]/60">
                {costumes.length === 0 ? 'ยังไม่มีชุดที่เปิดให้เช่า' : 'ไม่พบชุดที่ตรงกับเงื่อนไข'}
              </p>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="mt-3 text-sm font-semibold text-[#E5457F] hover:underline"
                >
                  ล้างตัวกรองแล้วลองใหม่
                </button>
              )}
            </div>
          )}

          {!loading && !loadError && pageItems.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3">
                {pageItems.map((c) => (
                  <CostumeGridCard
                    key={c.id}
                    costume={c}
                    heldDays={customerHeldDays(c.minPricePackageDays, settings)}
                  />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
            </>
          )}
        </section>
      </div>

      {/* ---------------- ตัวกรองบนมือถือ (แผ่นเลื่อนขึ้น) ---------------- */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="ตัวกรอง">
          <div className="absolute inset-0 bg-[#263544]/50" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#F7F7F8] px-6 pb-24">
            <div className="sticky top-0 -mx-6 flex items-center justify-between bg-[#F7F7F8] px-6 pb-2 pt-4">
              <p className="text-lg font-bold text-[#263544]">ตัวกรอง</p>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="ปิด"
                className="rounded-full p-2 text-[#263544] hover:bg-white"
              >
                <XIcon size={20} weight="bold" />
              </button>
            </div>
            {filterPanel}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="w-full rounded-full border-2 border-[#263544] bg-[#E5457F] py-3 text-sm font-bold text-white shadow-[3px_3px_0_0_#263544]"
            >
              ดูผลลัพธ์ {results.length} ชิ้น
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function ExplorePage() {
  return (
    <CustomerLayout width="full">
      <Suspense fallback={<div className="mx-auto mt-8 h-96 max-w-7xl animate-pulse rounded-3xl bg-gray-100" />}>
        <ExploreInner />
      </Suspense>
    </CustomerLayout>
  )
}
