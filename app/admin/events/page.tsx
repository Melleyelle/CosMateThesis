'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarBlankIcon, EyeIcon, EyeSlashIcon, MagnifyingGlassIcon, PlusIcon, StarIcon } from '@phosphor-icons/react'
import AdminLayout from '@/app/components/admin/AdminLayout'
import {
  EmptyState,
  FilterTabs,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  primaryButtonClass,
  StatusBadge,
} from '@/app/components/admin/ui'
import { formatEventRange } from '@/app/components/customer/events/EventTile'
import { fetchAllEventsForAdmin, setEventPublished } from '@/utils/admin/events'
import { EVENT_TONE, isEventPast, type CosEvent } from '@/utils/customer/events'
import { todayISO } from '@/utils/dateUtils'

const TABS = [
  { value: 'upcoming', label: 'กำลังจะมาถึง' },
  { value: 'past', label: 'จบแล้ว' },
  { value: 'draft', label: 'ฉบับร่าง' },
  { value: 'all', label: 'ทั้งหมด' },
] as const
type Tab = (typeof TABS)[number]['value']

// รายการงาน — เพิ่ม/แก้ไขเปิดเป็นหน้าแยก (/admin/events/new, /admin/events/[id]/edit) แบบเดียวกับคลังชุด
export default function AdminEventsPage() {
  const [events, setEvents] = useState<CosEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchAllEventsForAdmin().then(({ data, error }) => {
      setEvents(data)
      setLoadError(error)
      setLoading(false)
    })
  }, [])

  const today = todayISO()
  const counts = useMemo(
    () => ({
      upcoming: events.filter((e) => e.isPublished && !isEventPast(e, today)).length,
      past: events.filter((e) => e.isPublished && isEventPast(e, today)).length,
      draft: events.filter((e) => !e.isPublished).length,
      all: events.length,
    }),
    [events, today],
  )
  const upcomingInterest = events
    .filter((e) => e.isPublished && !isEventPast(e, today))
    .reduce((sum, e) => sum + e.interestCount, 0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events
      .filter((e) => {
        if (tab === 'upcoming' && (!e.isPublished || isEventPast(e, today))) return false
        if (tab === 'past' && (!e.isPublished || !isEventPast(e, today))) return false
        if (tab === 'draft' && e.isPublished) return false
        if (q && !`${e.name} ${e.location}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) =>
        tab === 'upcoming' ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate),
      )
  }, [events, tab, search, today])

  async function togglePublish(ev: CosEvent) {
    const { error } = await setEventPublished(ev.id, !ev.isPublished)
    if (error) return alert(`บันทึกไม่สำเร็จ: ${error}`)
    setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, isPublished: !ev.isPublished } : e)))
  }

  return (
    <AdminLayout>
      <div className="px-5 pb-16 pt-7 sm:px-8">
        <PageHeader
          title="อีเวนต์"
          description="งานคอสเพลย์ที่แสดงในหน้าอีเวนต์ ปฏิทินจองชุด และหน้าหลัก"
          actions={
            <Link href="/admin/events/new" className={primaryButtonClass}>
              <PlusIcon size={18} weight="bold" />
              เพิ่มงานใหม่
            </Link>
          }
        />

        <MetricStrip>
          <Metric label="กำลังจะมาถึง" value={counts.upcoming} />
          <Metric label="คนสนใจงานที่กำลังจะมาถึง" value={upcomingInterest.toLocaleString('th-TH')} />
          <Metric label="จบแล้ว" value={counts.past} />
          <Metric label="ฉบับร่าง (ลูกค้ามองไม่เห็น)" value={counts.draft} />
        </MetricStrip>

        {loadError && (
          <p role="alert" className="mt-6 rounded-xl bg-[#FDE8E8] px-4 py-3 text-sm text-[#B42318]">
            โหลดไม่สำเร็จ: {loadError} — ตรวจว่ารัน cosmate_step19_events.sql แล้วหรือยัง
          </p>
        )}

        <Panel className="mt-6" bodyClassName="">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEEDF2] px-4 py-3">
            <FilterTabs tabs={TABS} value={tab} onChange={setTab} counts={counts} />
            <label className="flex items-center gap-2 rounded-full border border-[#D5D9E0] bg-white px-3 py-1.5 focus-within:border-[#263544] focus-within:ring-2 focus-within:ring-[#263544]/10">
              <MagnifyingGlassIcon size={16} className="text-[#6B7280]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นชื่องาน/สถานที่"
                aria-label="ค้นหางาน"
                className="w-44 bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F4F4F6]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState>{search ? 'ไม่พบงานที่ค้นหา' : 'ยังไม่มีงานในแท็บนี้'}</EmptyState>
          ) : (
            <ul className="divide-y divide-[#EEEDF2]">
              {filtered.map((ev) => {
                const past = isEventPast(ev, today)
                return (
                  <li key={ev.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FCFCFD]">
                    <Link
                      href={`/admin/events/${ev.id}/edit`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                    >
                      <span className="relative h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-[#E4E3EA] bg-[#F4F4F6]">
                        {ev.coverImageUrl ? (
                          <img src={ev.coverImageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <CalendarBlankIcon size={20} className="absolute inset-0 m-auto text-[#9AA3AF]" />
                        )}
                        <span className={`absolute bottom-1 left-1 h-2 w-2 rounded-full ring-1 ring-white ${EVENT_TONE[ev.tone].dot}`} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#263544]">{ev.name}</span>
                        <span className="block truncate text-xs text-[#6B7280]">
                          {formatEventRange(ev.startDate, ev.endDate)} · {ev.location}
                        </span>
                      </span>
                    </Link>
                    <span className="hidden items-center gap-1 text-xs tabular-nums text-[#5B6472] sm:flex" title="คนสนใจ">
                      <StarIcon size={14} weight="fill" className="text-[#E5457F]" />
                      {ev.interestCount}
                    </span>
                    {!ev.isPublished ? (
                      <StatusBadge tone="waiting">ฉบับร่าง</StatusBadge>
                    ) : past ? (
                      <StatusBadge tone="closed">จบแล้ว</StatusBadge>
                    ) : (
                      <StatusBadge tone="done">เผยแพร่</StatusBadge>
                    )}
                    <button
                      type="button"
                      onClick={() => togglePublish(ev)}
                      aria-label={ev.isPublished ? 'ซ่อนงานนี้ (เปลี่ยนเป็นฉบับร่าง)' : 'เผยแพร่งานนี้'}
                      title={ev.isPublished ? 'ซ่อนจากลูกค้า' : 'เผยแพร่'}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[#5B6472] hover:bg-[#F4F4F6]"
                    >
                      {ev.isPublished ? <EyeIcon size={18} /> : <EyeSlashIcon size={18} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </AdminLayout>
  )
}
