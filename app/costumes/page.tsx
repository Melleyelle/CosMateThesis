'use client'

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowsDownUpIcon,
  CaretDownIcon,
  CheckIcon,
  CoatHangerIcon,
  CrownSimpleIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  MaskHappyIcon,
  SparkleIcon,
  WarningCircleIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import CostumeGridCard, { CARD_MEDIA } from '@/app/components/customer/CostumeGridCard'
import Pagination from '@/app/components/customer/Pagination'
import ExploreFilters, {
  EMPTY_FILTERS,
  SHOE_SIZE_LABEL,
  USE_DATE_DAYS_AHEAD,
  countActiveFilters,
  priceRangeLabel,
  type ExploreFilterState,
} from '@/app/components/customer/ExploreFilters'
import { fetchCatalog, fetchUnavailableStartDates, type CatalogCostume } from '@/utils/customer/fetchCatalog'
import { formatThaiDate, isISODate } from '@/utils/dateUtils'
import { COLOR_OPTIONS, THEME_OPTIONS } from '@/utils/customer/filterOptions'
import { fetchSizeStock, type SizeStock } from '@/utils/sizeStock'

// หน้านี้ทดลอง design v2 แนว Gumroad (design-v2-gumroad.md) ผ่าน .theme-v2 ที่ตัวห่อของหน้า:
// เส้นเข้ม 1px ทุกการ์ด/ปุ่ม/ช่องกรอก · เงาแข็งโผล่เฉพาะตอน hover (.lift) · ปุ่มหลักชมพู · ไม่มีพื้นดำ

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

const primaryButtonClass =
  'lift focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-line bg-brand px-5 text-body font-bold text-white active:bg-brand-strong'
const secondaryButtonClass =
  'lift focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-body font-semibold text-ink'
const textLinkClass = 'focus-ring rounded text-body font-semibold text-brand-strong underline-offset-2 hover:underline'

function ExploreInner() {
  const searchParams = useSearchParams()
  const gridTopRef = useRef<HTMLDivElement>(null)

  const [costumes, setCostumes] = useState<CatalogCostume[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // null = กำลังโหลดจำนวนต่อไซส์ (การ์ดจองพื้นที่ไว้ก่อน) · ดึงครั้งเดียวทุกชุด ไม่ยิงทีละการ์ด
  const [sizeStock, setSizeStock] = useState<Map<string, SizeStock[]> | null>(null)

  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [filters, setFilters] = useState<ExploreFilterState>(() => {
    const cat = searchParams.get('category')
    // ?date=YYYY-MM-DD มาจากปุ่ม "หาชุดที่ว่างวันงาน" ในหน้าอีเวนต์
    const date = searchParams.get('date')
    return {
      ...EMPTY_FILTERS,
      ...(cat && CATEGORY_LABEL[cat] ? { categories: [cat] } : {}),
      ...(isISODate(date) ? { useDate: date } : {}),
    }
  })
  const [sort, setSort] = useState<SortValue>('newest')
  const [page, setPage] = useState(1)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  useEffect(() => {
    fetchCatalog().then((res) => {
      if (res.error) setLoadError(res.error)
      else {
        setCostumes(res.data)
        fetchSizeStock(res.data.map((c) => c.id)).then(setSizeStock)
      }
      setLoading(false)
    })
  }, [])

  // เปลี่ยนเงื่อนไขค้นหา/กรอง/เรียง → กลับไปหน้า 1
  useEffect(() => {
    setPage(1)
  }, [filters, search, sort])

  // วันไม่ว่างของทุกไซส์ (ล่วงหน้า USE_DATE_DAYS_AHEAD วัน) — โหลดครั้งเดียวตอนเลือกวันครั้งแรก
  // หลังจากนั้นเปลี่ยนวันกี่ครั้งก็กรองได้ทันที ไม่ต้องยิงใหม่
  const [unavailableByVariant, setUnavailableByVariant] = useState<Map<string, Set<string>> | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0)
  const availabilityRequested = useRef(-1)

  useEffect(() => {
    if (!filters.useDate || unavailableByVariant || costumes.length === 0) return
    if (availabilityRequested.current === availabilityAttempt) return
    availabilityRequested.current = availabilityAttempt
    fetchUnavailableStartDates(
      costumes.flatMap((c) => c.rentableVariants.map((v) => v.id)),
      USE_DATE_DAYS_AHEAD,
    ).then((res) => {
      if (res.error) setAvailabilityError(res.error)
      else setUnavailableByVariant(res.data)
    })
  }, [filters.useDate, unavailableByVariant, costumes, availabilityAttempt])

  const availabilityLoading = !!filters.useDate && !unavailableByVariant && !availabilityError
  const busy = loading || availabilityLoading

  // แผ่นตัวกรองบนมือถือ: ปิดด้วย Esc ได้
  useEffect(() => {
    if (!mobileFiltersOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileFiltersOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileFiltersOpen])

  // ตัวเลือกที่คำนวณจากข้อมูลจริง
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    costumes.forEach((c) => {
      if (c.costumeCategory) counts[c.costumeCategory] = (counts[c.costumeCategory] ?? 0) + 1
    })
    return counts
  }, [costumes])

  const seriesOptions = useMemo(() => countNames(costumes.map((c) => c.seriesName)), [costumes])
  const popularSeries = seriesOptions.slice(0, 4)

  // ตัวละครแสดงเฉพาะของเรื่องที่เลือกไว้
  const characterOptions = useMemo(
    () =>
      filters.series
        ? countNames(costumes.filter((c) => c.seriesName === filters.series).map((c) => c.characterName))
        : [],
    [costumes, filters.series],
  )

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
      if (f.series && c.seriesName !== f.series) return false
      if (f.character && c.characterName !== f.character) return false
      if (priceActive) {
        if (c.minPrice === null) return false
        if (f.priceMin !== null && c.minPrice < f.priceMin) return false
        if (f.priceMax !== null && c.minPrice > f.priceMax) return false
      }
      if (keyword) {
        const haystack = `${c.name} ${c.characterName ?? ''} ${c.seriesName ?? ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      // ว่างวันที่เลือก = มีอย่างน้อย 1 ไซส์ (ตรงกับไซส์ที่กรองไว้ ถ้ามี) ที่เริ่มเช่าวันนั้นได้
      if (f.useDate && unavailableByVariant) {
        const date = f.useDate
        const free = c.rentableVariants.some(
          (v) =>
            (!f.sizes.length || f.sizes.includes(v.size)) &&
            unavailableByVariant.has(v.id) &&
            !unavailableByVariant.get(v.id)!.has(date),
        )
        if (!free) return false
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
  }, [costumes, filters, search, sort, unavailableByVariant])

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeCount = countActiveFilters(filters)

  // ชิปแสดงตัวกรองที่เลือกอยู่ กดกากบาทเพื่อเอาออกทีละอัน
  const chips = useMemo(() => {
    const list: { key: string; label: string; remove: () => void }[] = []
    if (filters.useDate) {
      list.push({
        key: 'useDate',
        label: `ว่างวันที่ ${formatThaiDate(filters.useDate)}`,
        remove: () => setFilters((f) => ({ ...f, useDate: null })),
      })
    }
    const add = (field: 'categories' | 'genders' | 'sizes' | 'colors' | 'themes', labels?: Record<string, string>) =>
      filters[field].forEach((v) =>
        list.push({
          key: `${field}-${v}`,
          label: labels?.[v] ?? v,
          remove: () => setFilters((f) => ({ ...f, [field]: f[field].filter((x) => x !== v) })),
        }),
      )
    add('categories', CATEGORY_LABEL)
    add('genders', GENDER_LABEL)
    add('sizes', SHOE_SIZE_LABEL)
    add('colors', COLOR_LABEL)
    add('themes', THEME_LABEL)
    if (filters.series) {
      list.push({
        key: 'series',
        label: filters.series,
        remove: () => setFilters((f) => ({ ...f, series: null, character: null })),
      })
    }
    if (filters.character) {
      list.push({
        key: 'character',
        label: filters.character,
        remove: () => setFilters((f) => ({ ...f, character: null })),
      })
    }
    if (filters.priceMin !== null || filters.priceMax !== null) {
      list.push({
        key: 'price',
        label: priceRangeLabel(filters.priceMin, filters.priceMax),
        remove: () => setFilters((f) => ({ ...f, priceMin: null, priceMax: null })),
      })
    }
    return list
  }, [filters])

  function goToPage(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages))
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filterPanel = (
    <ExploreFilters value={filters} onChange={setFilters} categoryCounts={categoryCounts} />
  )

  return (
    // --pop-color: หัวจับแถบราคาเป็นสี ink
    <div className="theme-v2 text-ink [--pop-color:var(--color-ink)]">
      {/* ---------------- แบนเนอร์ค้นหา: พื้นชมพูลายจุด · ช่องค้นหาทรงแคปซูลเส้นเข้ม + เงาแข็ง ปุ่มแว่นขยายชมพูติดขวา ---------------- */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <section
          className="relative overflow-hidden rounded-hero bg-brand-subtle px-4 py-9 text-center sm:py-12"
          style={{
            backgroundImage: 'radial-gradient(var(--color-brand-soft) 1.5px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }}
        >
          {/* สติกเกอร์ตกแต่ง (จอ ≥ 768px) — โยกช้า ๆ คนละจังหวะ ปิดเองเมื่อผู้ใช้ตั้ง reduced motion */}
          <div aria-hidden="true" className="pointer-events-none hidden md:block">
            <BannerSticker icon={MaskHappyIcon} className="left-[7%] top-7 -rotate-12" tone="bg-deco-yellow" delay="0s" />
            <BannerSticker icon={CoatHangerIcon} className="bottom-7 left-[14%] rotate-6" tone="bg-surface" delay="-1.1s" small />
            <BannerSticker icon={CrownSimpleIcon} className="right-[8%] top-8 rotate-12" tone="bg-deco-lavender" delay="-2s" />
            <BannerSticker icon={SparkleIcon} className="bottom-8 right-[15%] -rotate-6" tone="bg-brand-soft" delay="-0.6s" small />
          </div>

          <h1 className="rise relative text-h1 font-bold text-ink sm:text-display">
            สำรวจ
            <span className="relative inline-block">
              {/* แถบไฮไลต์เหลืองเอียงหลังคำ — ให้หัวข้อมีจุดโฟกัส ไม่ใช้ตัวอักษรไล่สี */}
              <span aria-hidden="true" className="absolute inset-x-[-4px] bottom-[0.08em] h-[0.6em] -rotate-2 rounded-md bg-deco-yellow" />
              <span className="relative">ชุด</span>
            </span>
          </h1>
          <p className="rise relative mt-2 text-body text-secondary" style={riseDelay(80)}>
            ค้นจากชื่อชุด ตัวละคร หรือเรื่องที่ชอบ
            {!loading && costumes.length > 0 && (
              <>
                {' · '}มีให้เลือก <span className="font-semibold text-ink">{costumes.length} ชุด</span>
              </>
            )}
          </p>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(searchInput)
            }}
            className="rise relative mx-auto mt-5 flex h-[52px] max-w-xl items-center gap-1 rounded-full border border-ink bg-surface p-[3px] pl-4 transition-shadow duration-200 ease-out hover:shadow-[3px_3px_0_0_var(--color-ink)] focus-within:shadow-[3px_3px_0_0_var(--color-ink)]"
            style={riseDelay(160)}
          >
            {/* แคปซูลเดียว: แว่นขยายนำหน้าบอกว่าเป็นช่องค้นหา · ปุ่มชมพูแคปซูลอยู่ด้านในขอบ · เงาแข็งโผล่ตอน hover/พิมพ์ */}
            <label className="flex h-full min-w-0 flex-1 cursor-text items-center gap-2.5">
              <MagnifyingGlassIcon size={20} weight="bold" aria-hidden="true" className="flex-shrink-0 text-muted" />
              <span className="sr-only">ค้นหาชุด</span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  if (e.target.value === '') setSearch('')
                }}
                placeholder="ชื่อชุด ตัวละคร หรือชื่อเรื่อง"
                className="h-full w-full min-w-0 bg-transparent text-body text-ink caret-brand outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
              />
            </label>
            {searchInput && (
              <button
                type="button"
                aria-label="ล้างคำค้นหา"
                onClick={() => {
                  setSearchInput('')
                  setSearch('')
                }}
                className="focus-ring flex size-11 flex-shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-sunken hover:text-ink"
              >
                <XIcon size={18} weight="bold" />
              </button>
            )}
            <button
              type="submit"
              aria-label="ค้นหา"
              className="focus-ring flex h-11 min-w-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-full border border-ink bg-brand px-3 text-body font-bold text-white transition-colors active:bg-brand-strong sm:px-5"
            >
              <MagnifyingGlassIcon size={18} weight="bold" className="sm:hidden" />
              <span className="hidden sm:inline">ค้นหา</span>
            </button>
          </form>

          {/* ทางลัด: เรื่องที่มีชุดมากที่สุด 4 เรื่อง (จากข้อมูลจริง) กดแล้วกรองตามเรื่องทันที กดซ้ำเพื่อเอาออก */}
          {popularSeries.length > 0 && (
            <div
              className="rise relative mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2"
              style={riseDelay(240)}
            >
              <span className="text-body-sm font-semibold text-secondary">เรื่องยอดฮิต:</span>
              {popularSeries.map((s) => {
                const selected = filters.series === s.name
                return (
                  <button
                    key={s.name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setFilters((f) => ({ ...f, series: f.series === s.name ? null : s.name, character: null }))
                    }
                    className={`lift focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-body-sm font-semibold text-ink ${
                      selected ? 'bg-brand-soft' : 'bg-surface'
                    }`}
                  >
                    {selected && <CheckIcon size={12} weight="bold" />}
                    {s.name}
                    <span className="font-medium text-secondary">{s.count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl gap-8 px-4 sm:px-6 lg:max-w-none lg:pl-0 lg:pr-8">
        {/* ---------------- ตัวกรองซ้าย (จอใหญ่) ---------------- */}
        <aside
          aria-label="ตัวกรอง"
          className="hidden w-72 flex-shrink-0 self-start rounded-r-card bg-sunken px-5 pt-5 lg:block"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-h2 font-bold text-ink">
              <FunnelSimpleIcon size={20} />
              ตัวกรอง
            </h2>
            {activeCount > 0 && (
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className={`${textLinkClass} text-body-sm`}>
                ล้างทั้งหมด
              </button>
            )}
          </div>
          {filterPanel}
        </aside>

        {/* ---------------- ผลลัพธ์ ---------------- */}
        <section className="min-w-0 flex-1 scroll-mt-24" ref={gridTopRef} aria-label="ผลลัพธ์">
          {/* เรื่อง → ตัวละคร (ต้องเลือกเรื่องก่อน) */}
          <div className="mb-4 flex flex-wrap gap-3">
            <SelectField
              label="คัดกรองจากชื่อเรื่อง"
              value={filters.series ?? ''}
              onChange={(v) => setFilters((f) => ({ ...f, series: v || null, character: null }))}
              options={seriesOptions}
              placeholder="ทุกเรื่อง"
            />
            <SelectField
              label="คัดกรองจากชื่อตัวละคร"
              value={filters.character ?? ''}
              onChange={(v) => setFilters((f) => ({ ...f, character: v || null }))}
              options={characterOptions}
              placeholder={filters.series ? 'ทุกตัวละคร' : 'เลือกเรื่องก่อน'}
              disabled={!filters.series}
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className={`${secondaryButtonClass} h-11 lg:hidden`}
            >
              <FunnelSimpleIcon size={18} />
              ตัวกรอง
              {activeCount > 0 && (
                <span className="min-w-5 rounded-full border border-line bg-brand-soft px-1.5 text-caption font-bold text-ink">
                  {activeCount}
                </span>
              )}
            </button>

            <p className="text-body text-secondary" aria-live="polite">
              {search ? (
                <>
                  ผลการค้นหา &quot;<span className="font-semibold text-ink">{search}</span>&quot;:{' '}
                </>
              ) : (
                'จำนวนสินค้าที่ค้นพบ: '
              )}
              <span className="font-semibold text-ink">{busy ? '…' : results.length} ชิ้น</span>
            </p>

            <label className="relative ml-auto flex items-center">
              <ArrowsDownUpIcon size={16} className="pointer-events-none absolute left-4 text-secondary" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortValue)}
                aria-label="เรียงลำดับ"
                className={`${selectClass} pl-10`}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <CaretDownIcon size={16} weight="bold" className="pointer-events-none absolute right-4 text-secondary" />
            </label>
          </div>

          {chips.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.remove}
                  aria-label={`เอาตัวกรอง ${chip.label} ออก`}
                  className="lift focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-brand-soft px-3 text-body-sm font-semibold text-ink"
                >
                  {chip.label}
                  <XIcon size={12} weight="bold" />
                </button>
              ))}
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className={`${textLinkClass} ml-1 text-body-sm`}>
                ล้างทั้งหมด
              </button>
            </div>
          )}

          {busy && !loadError && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4 min-[2200px]:grid-cols-5" aria-busy="true" aria-label="กำลังโหลด">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-card border border-line">
                  <div className={`${CARD_MEDIA} animate-pulse border-b border-line bg-sunken`} />
                  <div className="space-y-2 p-3 sm:p-4">
                    <div className="h-4 w-1/2 animate-pulse rounded bg-sunken" />
                    <div className="h-5 w-4/5 animate-pulse rounded bg-sunken" />
                    <div className="h-5 w-1/3 animate-pulse rounded bg-sunken" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && loadError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-card border border-danger/20 bg-danger-subtle px-4 py-4 text-body text-danger"
            >
              <WarningCircleIcon size={22} weight="fill" className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">โหลดรายการชุดไม่สำเร็จ</p>
                <p className="text-body-sm">{loadError}</p>
              </div>
            </div>
          )}

          {filters.useDate && availabilityError && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-start gap-3 rounded-card border border-warning/20 bg-warning-subtle px-4 py-3 text-body text-warning"
            >
              <WarningCircleIcon size={22} weight="fill" className="mt-0.5 flex-shrink-0" />
              <p className="min-w-0 flex-1">
                <span className="font-semibold">ตรวจวันว่างไม่สำเร็จ</span>
                <span className="block text-body-sm">ตอนนี้แสดงทุกชุดโดยยังไม่ได้กรองตามวันที่ใช้ชุด</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setAvailabilityError(null)
                  setAvailabilityAttempt((a) => a + 1)
                }}
                className={`${secondaryButtonClass} h-10 text-body-sm`}
              >
                ลองอีกครั้ง
              </button>
            </div>
          )}

          {!busy && !loadError && results.length === 0 && (
            <div className="px-4 py-16 text-center">
              <MagnifyingGlassIcon size={32} className="mx-auto text-muted" />
              <p className="mt-3 text-h3 font-semibold text-ink">
                {costumes.length === 0
                  ? 'ยังไม่มีชุดที่เปิดให้เช่า'
                  : filters.useDate
                    ? `ไม่พบชุดที่ว่างวัน${formatThaiDate(filters.useDate)}`
                    : 'ไม่พบชุดที่ตรงกับเงื่อนไข'}
              </p>
              {costumes.length > 0 && (
                <p className="mt-1 text-body-sm text-secondary">
                  {filters.useDate ? 'ลองเลือกวันอื่น หรือลดตัวกรองอื่นลง' : 'ลองลดตัวกรองหรือค้นด้วยคำอื่น'}
                </p>
              )}
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className={`${secondaryButtonClass} mt-5 h-11`}
                >
                  ล้างตัวกรองแล้วลองใหม่
                </button>
              )}
            </div>
          )}

          {!busy && !loadError && pageItems.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4 min-[2200px]:grid-cols-5">
                {pageItems.map((c) => (
                  <CostumeGridCard
                    key={c.id}
                    variant="gumroad"
                    costume={c}
                    sizes={sizeStock ? (sizeStock.get(c.id) ?? []) : undefined}
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
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-hero bg-surface px-5 pb-24 shadow-overlay">
            <div className="sticky top-0 -mx-5 flex items-center justify-between border-b border-line-subtle bg-surface px-5 pb-3 pt-4">
              <h2 className="text-h2 font-bold text-ink">ตัวกรอง</h2>
              <div className="flex items-center gap-2">
                {activeCount > 0 && (
                  <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className={`${textLinkClass} text-body-sm`}>
                    ล้างทั้งหมด
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label="ปิด"
                  autoFocus
                  className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-ink transition hover:bg-sunken"
                >
                  <XIcon size={20} weight="bold" />
                </button>
              </div>
            </div>
            {filterPanel}
          </div>
          <div className="absolute inset-x-0 bottom-0 border-t border-line bg-surface p-4">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className={`${primaryButtonClass} h-12 w-full`}
            >
              ดูผลลัพธ์ {results.length} ชิ้น
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// หน่วงจังหวะ .rise ทีละบรรทัดในแบนเนอร์
const riseDelay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

// สติกเกอร์วงกลมบนแบนเนอร์: เส้น 1px ink · หมุนเอียงจาก className · .wobble โยกรอบมุมที่เอียงไว้
function BannerSticker({
  icon: StickerIcon,
  className,
  tone,
  delay,
  small = false,
}: {
  icon: Icon
  className: string
  tone: string
  delay: string
  small?: boolean
}) {
  return (
    <span className={`absolute block ${className}`}>
      <span
        className={`wobble flex items-center justify-center rounded-full border border-line text-ink ${tone} ${
          small ? 'h-11 w-11' : 'h-14 w-14'
        }`}
        style={{ animationDelay: delay }}
      >
        <StickerIcon size={small ? 20 : 26} weight="duotone" />
      </span>
    </span>
  )
}

// นับจำนวนชุดต่อชื่อ เรียงจากมากไปน้อย
function countNames(names: (string | null)[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  names.forEach((n) => {
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
  })
  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'),
  )
}

// Select ตาม design v2: มุม control 10px เส้นเข้ม 1px สูง 44px · ปิดใช้ = เส้นจาง พื้น canvas
const selectClass =
  'focus-ring h-11 appearance-none rounded-control border border-line bg-surface py-0 pl-4 pr-10 text-body font-medium text-ink outline-none transition disabled:cursor-not-allowed disabled:border-line-subtle disabled:bg-canvas disabled:text-muted'

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { name: string; count: number }[]
  placeholder: string
  disabled?: boolean
}) {
  return (
    <label className="relative flex min-w-[220px] flex-1 items-center sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${selectClass} w-full ${value ? 'bg-brand-soft font-bold' : ''}`}
      >
        <option value="">{value ? placeholder : label}</option>
        {options.map((o) => (
          <option key={o.name} value={o.name}>
            {o.name} ({o.count})
          </option>
        ))}
      </select>
      <CaretDownIcon
        size={16}
        weight="bold"
        className={`pointer-events-none absolute right-4 ${disabled ? 'text-muted' : 'text-secondary'}`}
      />
    </label>
  )
}

export default function ExplorePage() {
  return (
    <CustomerLayout width="full">
      <Suspense fallback={<div className="mx-auto mt-8 h-96 max-w-7xl animate-pulse rounded-hero bg-sunken" />}>
        <ExploreInner />
      </Suspense>
    </CustomerLayout>
  )
}
