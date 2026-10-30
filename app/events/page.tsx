'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarStarIcon, CameraIcon, MagnifyingGlassIcon, MapPinIcon, SparkleIcon, XIcon } from '@phosphor-icons/react'
import BannerSticker, { riseDelay } from '@/app/components/customer/BannerSticker'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import EmptyState from '@/app/components/EmptyState'
import EventTile from '@/app/components/customer/events/EventTile'
import { useAuthUser } from '@/utils/customer/authUser'
import { fetchEvents, fetchMyInterests, isEventPast, type CosEvent } from '@/utils/customer/events'
import { parseISODate, todayISO } from '@/utils/dateUtils'

type Tab = 'upcoming' | 'past'
type Sort = 'date' | 'popular'

const TABS: { value: Tab; label: string }[] = [
  { value: 'upcoming', label: 'กำลังจะมาถึง' },
  { value: 'past', label: 'งานที่ผ่านมา' },
]

// เดือนที่งานคาบอยู่ (งาน 31 ต.ค.–1 พ.ย. อยู่ทั้งสองเดือน) รูปแบบ 'YYYY-MM'
function monthsOf(ev: CosEvent): string[] {
  const out: string[] = []
  let m = ev.startDate.slice(0, 7)
  const last = ev.endDate.slice(0, 7)
  while (m <= last) {
    out.push(m)
    const d = parseISODate(`${m}-01`)
    d.setMonth(d.getMonth() + 1)
    m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  return out
}

function monthLabel(ym: string): string {
  return parseISODate(`${ym}-01`).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
}

function EventsExplorer() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab: Tab = params.get('tab') === 'past' ? 'past' : 'upcoming'
  const { userId } = useAuthUser()

  const [events, setEvents] = useState<CosEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('date')

  useEffect(() => {
    fetchEvents().then(({ events, error }) => {
      setEvents(events)
      setLoadError(error)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetchMyInterests(userId).then(setMine)
  }, [userId])

  const today = todayISO()
  const byTab = useMemo(() => {
    const upcoming = events.filter((e) => !isEventPast(e, today))
    const past = events.filter((e) => isEventPast(e, today))
    return { upcoming, past }
  }, [events, today])

  const list = byTab[tab]
  const months = useMemo(() => {
    const set = new Set(list.flatMap(monthsOf))
    return [...set].sort((a, b) => (tab === 'past' ? b.localeCompare(a) : a.localeCompare(b)))
  }, [list, tab])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = list.filter((e) => {
      if (month !== 'all' && !monthsOf(e).includes(month)) return false
      if (q && !`${e.name} ${e.location} ${e.description ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
    // กำลังจะมาถึง: ใกล้ที่สุดก่อน · งานที่ผ่านมา: เพิ่งจบก่อน · "คนสนใจมากสุด" ใช้วันที่เป็นตัวตัดสินเมื่อเท่ากัน
    return rows.sort((a, b) => {
      if (sort === 'popular' && a.interestCount !== b.interestCount) return b.interestCount - a.interestCount
      return tab === 'past' ? b.endDate.localeCompare(a.endDate) : a.startDate.localeCompare(b.startDate)
    })
  }, [list, month, search, sort, tab])

  function switchTab(next: Tab) {
    setMonth('all')
    router.replace(next === 'past' ? `${pathname}?tab=past` : pathname, { scroll: false })
  }

  function updateInterest(id: string, next: { interested: boolean; count: number }) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, interestCount: next.count } : e)))
    setMine((prev) => {
      const s = new Set(prev)
      if (next.interested) s.add(id)
      else s.delete(id)
      return s
    })
  }

  const hasFilter = month !== 'all' || search.trim() !== ''

  return (
    <div className="theme-v2 text-ink">
      {/* ---------- แบนเนอร์: หน้าตาเดียวกับหน้าสำรวจชุด (พื้นชมพูลายจุด · สติกเกอร์ · ช่องค้นหาแคปซูล) ---------- */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <section
          className="relative overflow-hidden rounded-hero bg-brand-subtle px-4 py-9 text-center sm:py-12"
          style={{
            backgroundImage: 'radial-gradient(var(--color-brand-soft) 1.5px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }}
        >
          {/* สติกเกอร์ตกแต่ง (จอ ≥ 768px) */}
          <div aria-hidden="true" className="pointer-events-none hidden md:block">
            <BannerSticker icon={CalendarStarIcon} className="left-[7%] top-7 -rotate-12" tone="bg-deco-yellow" delay="0s" />
            <BannerSticker icon={MapPinIcon} className="bottom-7 left-[14%] rotate-6" tone="bg-surface" delay="-1.1s" small />
            <BannerSticker icon={CameraIcon} className="right-[8%] top-8 rotate-12" tone="bg-deco-lavender" delay="-2s" />
            <BannerSticker icon={SparkleIcon} className="bottom-8 right-[15%] -rotate-6" tone="bg-brand-soft" delay="-0.6s" small />
          </div>

          <h1 className="rise relative text-h1 font-bold text-ink sm:text-display">
            อีเวนต์
            <span className="relative inline-block">
              <span aria-hidden="true" className="absolute inset-x-[-4px] bottom-[0.08em] h-[0.6em] -rotate-2 rounded-md bg-deco-yellow" />
              <span className="relative">คอสเพลย์</span>
            </span>
          </h1>
          <p className="rise relative mt-2 text-body text-secondary" style={riseDelay(80)}>
            ดูงานที่กำลังจะมาถึง กดสนใจให้เพื่อนสายคอสรู้ว่าใครไปบ้าง แล้วกลับมาอวดรูปหลังงาน
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
            <label className="flex h-full min-w-0 flex-1 cursor-text items-center gap-2.5">
              <MagnifyingGlassIcon size={20} weight="bold" aria-hidden="true" className="flex-shrink-0 text-muted" />
              <span className="sr-only">ค้นหาอีเวนต์</span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  if (e.target.value === '') setSearch('')
                }}
                placeholder="ชื่องานหรือสถานที่"
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
        </section>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
        {/* ---------- แท็บ ---------- */}
        <div role="tablist" aria-label="ช่วงเวลาของงาน" className="flex gap-6 border-b border-line-subtle">
          {TABS.map((t) => {
            const active = t.value === tab
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchTab(t.value)}
                className={`focus-ring relative -mb-px flex items-center gap-2 border-b-2 pb-3 pt-1 text-body font-semibold transition ${
                  active ? 'border-brand text-ink' : 'border-transparent text-secondary hover:text-ink'
                }`}
              >
                {t.label}
                <span
                  className={`min-w-6 rounded-full px-1.5 text-center text-caption tabular-nums ${
                    active ? 'border border-line bg-brand-soft font-bold text-ink' : 'bg-sunken text-secondary'
                  }`}
                >
                  {loading ? '–' : byTab[t.value].length}
                </span>
              </button>
            )
          })}
        </div>

        {/* ---------- ตัวกรอง ---------- */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="-mx-1 flex max-w-full flex-1 gap-2 overflow-x-auto px-1 pb-1">
            <MonthPill label="ทุกเดือน" active={month === 'all'} onClick={() => setMonth('all')} />
            {months.map((m) => (
              <MonthPill key={m} label={monthLabel(m)} active={month === m} onClick={() => setMonth(m)} />
            ))}
          </div>
          <label className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface pl-3.5 pr-2 text-body-sm">
            <span className="text-secondary">เรียง</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="cursor-pointer bg-transparent py-1.5 font-semibold text-ink outline-none"
            >
              <option value="date">{tab === 'past' ? 'เพิ่งจบล่าสุด' : 'ใกล้ที่สุด'}</option>
              <option value="popular">คนสนใจมากสุด</option>
            </select>
          </label>
        </div>

        {hasFilter && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-body-sm">
            <span className="text-secondary">พบ {filtered.length} งาน</span>
            {search.trim() && (
              <FilterChip
                label={`“${search.trim()}”`}
                onRemove={() => {
                  setSearch('')
                  setSearchInput('')
                }}
              />
            )}
            {month !== 'all' && <FilterChip label={monthLabel(month)} onRemove={() => setMonth('all')} />}
          </div>
        )}

        {/* ---------- รายการ ---------- */}
        {loading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-card bg-sunken" />
            ))}
          </div>
        ) : loadError ? (
          <EmptyState title="โหลดอีเวนต์ไม่สำเร็จ" description={loadError} illustration={false} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={hasFilter ? 'ไม่พบงานที่ตรงกับตัวกรอง' : tab === 'past' ? 'ยังไม่มีงานที่ผ่านมา' : 'ยังไม่มีอีเวนต์ในช่วงนี้'}
            description={hasFilter ? 'ลองเปลี่ยนคำค้นหรือเดือนดูอีกครั้ง' : 'ร้านจะอัปเดตงานใหม่ให้เรื่อย ๆ แวะกลับมาดูอีกทีนะ'}
            action={
              hasFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setMonth('all')
                    setSearch('')
                    setSearchInput('')
                  }}
                  className="lift focus-ring inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-body font-semibold text-ink"
                >
                  ล้างตัวกรองแล้วลองใหม่
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((ev) => (
              <EventTile
                key={ev.id}
                event={ev}
                past={tab === 'past'}
                interested={mine.has(ev.id)}
                onInterestChange={(next) => updateInterest(ev.id, next)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MonthPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring inline-flex min-h-9 flex-shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-body-sm transition ${
        active ? 'border-line bg-brand-soft font-bold text-ink' : 'border-line-subtle bg-surface text-ink hover:border-line'
      }`}
    >
      {label}
    </button>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`เอาตัวกรอง ${label} ออก`}
      className="lift focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-brand-soft px-3 font-semibold text-ink"
    >
      {label}
      <XIcon size={14} weight="bold" aria-hidden />
    </button>
  )
}

export default function EventsPage() {
  return (
    <CustomerLayout width="full">
      <Suspense fallback={<div className="mx-auto mt-8 h-96 max-w-7xl animate-pulse rounded-hero bg-sunken" />}>
        <EventsExplorer />
      </Suspense>
    </CustomerLayout>
  )
}
