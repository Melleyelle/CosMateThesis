'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  GridFourIcon,
  ListIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'
import AdminLayout from '../../components/admin/AdminLayout'
import EmptyState from '../../components/EmptyState'
import CostumeCard from '../../components/admin/inventory/CostumeCard'
import DateRangeFilter, { type DateRange } from '../../components/admin/inventory/DateRangeFilter'
import {
  Metric,
  MetricStrip,
  PageHeader,
  Segmented,
  SelectFilter,
  StatusBadge,
  primaryButtonClass,
} from '../../components/admin/ui'
import { fetchInventoryCostumes } from '@/utils/fetchInventoryCostumes'
import { createClient } from '@/utils/client'
import type { InventoryCostume } from '../../components/admin/inventory/CostumeCard'

function translateDeleteError(message: string, code?: string) {
  if (code === '23503' || message.includes('HAS_RENTAL_HISTORY') || message.includes('foreign key')) {
    return 'ลบไม่ได้ เพราะชุดนี้มีประวัติการเช่าอยู่ในระบบ ลองสลับเป็น "งดเช่า" แทนการลบ'
  }
  if (message.includes('NOT_ADMIN')) return 'บัญชีนี้ไม่มีสิทธิ์แอดมิน'
  return message
}

// หมวดหมู่หลัก (มี 3 ค่า ใช้บ่อย) → segmented เห็นครบกดครั้งเดียว
// ประเภทผลงาน (6 ค่า ใช้นาน ๆ ครั้ง) และสถานะ → dropdown ประหยัดพื้นที่
// สองมิตินี้แยกกันโดยเจตนา: ชุดคอสเพลย์อนิเมะกับชุดแฟนซีฮาโลวีนเป็น anime ได้ทั้งคู่ แต่คนละหมวดหมู่
type Category = 'all' | 'cosplay' | 'fancy' | 'props_shoes'
const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'cosplay', label: 'คอสเพลย์' },
  { value: 'fancy', label: 'แฟนซี' },
  { value: 'props_shoes', label: 'พร็อพ/รองเท้า' },
]

type Franchise = 'all' | 'anime' | 'manga' | 'game' | 'movie_series' | 'vtuber' | 'original'
const FRANCHISE_OPTIONS: { value: Franchise; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
  { value: 'game', label: 'Game' },
  { value: 'movie_series', label: 'Movie/Series' },
  { value: 'vtuber', label: 'VTuber' },
  { value: 'original', label: 'Original' },
]

const FRANCHISE_LABEL = Object.fromEntries(FRANCHISE_OPTIONS.map((o) => [o.value, o.label]))
const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]))

type StatusFilter = 'all' | 'active' | 'inactive'

export default function InventoryPage() {
  const supabase = createClient()
  const [costumes, setCostumes] = useState<InventoryCostume[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [franchise, setFranchise] = useState<Franchise>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' })
  const [view, setView] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchInventoryCostumes(dateRange).then(({ data, error }) => {
      if (cancelled) return
      if (error) setLoadError(error)
      else setCostumes(data)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [dateRange])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return costumes.filter((c) => {
      if (category !== 'all' && c.costumeCategory !== category) return false
      if (franchise !== 'all' && c.franchiseType !== franchise) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (keyword) {
        const haystack = `${c.name} ${c.characterName ?? ''} ${c.seriesName ?? ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
  }, [costumes, category, franchise, statusFilter, search])

  // ตัวเลขข้างตัวเลือก: นับตามตัวกรองอื่นที่เลือกอยู่ เพื่อให้รู้ก่อนกดว่าจะเหลือกี่ชุด
  const categoryCounts = useMemo(() => {
    const base = costumes.filter(
      (c) => (franchise === 'all' || c.franchiseType === franchise) && (statusFilter === 'all' || c.status === statusFilter),
    )
    const counts: Record<string, number> = { all: base.length }
    base.forEach((c) => {
      if (c.costumeCategory) counts[c.costumeCategory] = (counts[c.costumeCategory] ?? 0) + 1
    })
    return counts
  }, [costumes, franchise, statusFilter])

  const franchiseCounts = useMemo(() => {
    const base = costumes.filter(
      (c) => (category === 'all' || c.costumeCategory === category) && (statusFilter === 'all' || c.status === statusFilter),
    )
    const counts: Record<string, number> = { all: base.length }
    base.forEach((c) => {
      if (c.franchiseType) counts[c.franchiseType] = (counts[c.franchiseType] ?? 0) + 1
    })
    return counts
  }, [costumes, category, statusFilter])

  // สรุปตัวเลขด้านบน คำนวณจากรายการที่โหลดมาทั้งหมด (ไม่ใช่จากผลกรอง)
  const stats = useMemo(() => {
    const totalCostumes = costumes.length
    const activeCostumes = costumes.filter((c) => c.status === 'active').length
    const totalUnits = costumes.reduce((sum, c) => sum + c.totalUnits, 0)
    const availableUnits = costumes.reduce((sum, c) => sum + c.availableUnits, 0)
    const lowStockCount = costumes.filter((c) => c.totalUnits > 0 && c.availableUnits < c.totalUnits).length
    const drafts = totalCostumes - activeCostumes
    return { totalCostumes, activeCostumes, totalUnits, availableUnits, lowStockCount, drafts }
  }, [costumes])

  const hasFilter =
    category !== 'all' || franchise !== 'all' || statusFilter !== 'all' || search.trim() !== '' || !!dateRange.from || !!dateRange.to

  function clearFilters() {
    setCategory('all')
    setFranchise('all')
    setStatusFilter('all')
    setSearch('')
    setDateRange({ from: '', to: '' })
  }

  async function handleToggleStatus(id: string, nextStatus: 'active' | 'inactive') {
    if (!supabase) return
    setStatusUpdatingId(id)
    const { error } = await supabase.from('products').update({ status: nextStatus }).eq('id', id)
    setStatusUpdatingId(null)

    if (error) {
      alert(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`)
      return
    }
    setCostumes((prev) => prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c)))
  }

  async function handleDelete(id: string, name: string) {
    if (!supabase) return
    if (!confirm(`ลบชุด "${name}" ออกจากคลังอย่างถาวร?\nถ้าเคยมีประวัติการเช่าอยู่ ระบบจะไม่ให้ลบและแนะนำให้ใช้ "งดเช่า" แทน`)) {
      return
    }

    setDeletingId(id)
    const { error } = await supabase.rpc('delete_costume', { p_product_id: id })
    setDeletingId(null)

    if (error) {
      alert(translateDeleteError(error.message, (error as { code?: string }).code))
      return
    }
    setCostumes((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <AdminLayout>
      <div className="px-5 py-7 sm:px-8">
        <PageHeader
          title="คลังชุด"
          description="จัดการชุด พร็อพ และสต็อกทั้งหมด"
          actions={
            <Link href="/admin/inventory/new" className={primaryButtonClass}>
              <PlusIcon size={16} weight="bold" />
              เพิ่มชุดใหม่
            </Link>
          }
        />

        {/* ตัวเลขสรุป */}
        <div className="mb-6">
          <MetricStrip>
            <Metric
              label="ชุดทั้งหมด"
              value={stats.totalCostumes}
              note={`เปิดเช่า ${stats.activeCostumes} ฉบับร่าง ${stats.drafts}`}
              onClick={() => setStatusFilter('all')}
            />
            <Metric
              label="ตัวชุดพร้อมให้เช่า"
              value={
                <span>
                  {stats.availableUnits}
                  <span className="text-base font-medium text-[#9AA3AF]"> / {stats.totalUnits}</span>
                </span>
              }
              note="ทุกไซส์รวมกัน"
            />
            <Metric
              label="ชุดที่มีตัวไม่พร้อมเช่า"
              value={<span className={stats.lowStockCount ? 'text-[#875200]' : ''}>{stats.lowStockCount}</span>}
              note="มีตัวที่กำลังซัก ซ่อม หรือปลดระวาง"
            />
            <Metric
              label="ฉบับร่าง (งดเช่า)"
              value={stats.drafts}
              note="ยังไม่แสดงบนหน้าร้าน"
              onClick={() => setStatusFilter('inactive')}
            />
          </MetricStrip>
        </div>

        {/* แถบเครื่องมือ: แถวบน = ค้นหา + มุมมอง / แถวล่าง = ตัวกรองทั้งหมดในแถวเดียว */}
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <MagnifyingGlassIcon
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9AA3AF]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชุด ตัวละคร หรือชื่อเรื่อง"
                className="w-full rounded-full border border-[#D5D9E0] bg-white py-2.5 pl-11 pr-4 text-sm text-[#263544] outline-none placeholder:text-[#9AA3AF] focus:border-[#263544] focus:ring-2 focus:ring-[#263544]/10"
              />
            </div>

            <div className="flex items-center rounded-full border border-[#D5D9E0] bg-white p-1" role="radiogroup" aria-label="มุมมอง">
              <button
                type="button"
                role="radio"
                aria-checked={view === 'grid'}
                onClick={() => setView('grid')}
                aria-label="มุมมองการ์ด"
                title="มุมมองการ์ด"
                className={`rounded-full p-2 transition ${view === 'grid' ? 'bg-[#263544] text-white' : 'text-[#9AA3AF] hover:text-[#263544]'}`}
              >
                <GridFourIcon size={16} />
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={view === 'list'}
                onClick={() => setView('list')}
                aria-label="มุมมองตาราง"
                title="มุมมองตาราง"
                className={`rounded-full p-2 transition ${view === 'list' ? 'bg-[#263544] text-white' : 'text-[#9AA3AF] hover:text-[#263544]'}`}
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="max-w-full overflow-x-auto">
              <Segmented
                label="หมวดหมู่"
                options={CATEGORY_OPTIONS.map((o) => ({ ...o, count: categoryCounts[o.value] ?? 0 }))}
                value={category}
                onChange={setCategory}
              />
            </div>
            <SelectFilter
              label="ประเภทผลงาน"
              options={FRANCHISE_OPTIONS.map((o) => ({ ...o, count: franchiseCounts[o.value] ?? 0 }))}
              value={franchise}
              onChange={setFranchise}
              allValue="all"
            />
            <SelectFilter
              label="สถานะ"
              options={[
                { value: 'all', label: 'ทุกสถานะ' },
                { value: 'active', label: 'เปิดเช่า' },
                { value: 'inactive', label: 'งดเช่า' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              allValue="all"
            />
            <DateRangeFilter value={dateRange} onChange={setDateRange} />

            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-[#6B7280]">
                แสดง <span className="font-semibold tabular-nums text-[#263544]">{filtered.length}</span> จาก{' '}
                <span className="tabular-nums">{costumes.length}</span> ชุด
              </span>
              {hasFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[#C92D67] transition hover:bg-[#FDE3EE]"
                >
                  <XIcon size={12} weight="bold" />
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>
        </div>

        {/* เนื้อหา */}
        {loading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        )}

        {!loading && loadError && (
          <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-6 text-center text-sm text-[#B42318]">
            {loadError}
          </p>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <EmptyState
            className="rounded-2xl border border-[#E4E3EA] bg-white"
            title={costumes.length === 0 ? 'ยังไม่มีชุดในร้านเลย' : 'ไม่พบชุดที่ตรงกับตัวกรองนี้'}
            description={
              costumes.length === 0
                ? 'กด "เพิ่มชุดใหม่" แล้วมาลงชุดแรกของร้านกันเลย'
                : 'ลองปรับตัวกรองหรือคำค้นหาดูอีกครั้งนะ'
            }
          />
        )}

        {!loading && !loadError && filtered.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((costume) => (
              <CostumeCard
                key={costume.id}
                costume={costume}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
                statusUpdating={statusUpdatingId === costume.id}
                deleting={deletingId === costume.id}
              />
            ))}
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && view === 'list' && (
          <div className="overflow-x-auto rounded-2xl border border-[#E4E3EA] bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[#EEEDF2] bg-[#FAFAFC] text-xs text-[#6B7280]">
                <tr>
                  <th className="px-5 py-3 font-medium">ชุด</th>
                  <th className="px-4 py-3 font-medium">หมวดหมู่ / ผลงาน</th>
                  <th className="px-4 py-3 text-right font-medium">ราคาเริ่มต้น</th>
                  <th className="px-4 py-3 text-right font-medium">พร้อมให้เช่า</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="px-5 py-3 font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEDF2]">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FCFCFD]">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#263544]">{c.name}</p>
                      <p className="text-xs text-[#6B7280]">{c.seriesName ?? c.characterName ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-[#5B6472]">
                      <p>{c.costumeCategory ? CATEGORY_LABEL[c.costumeCategory] ?? c.costumeCategory : '—'}</p>
                      <p className="text-xs text-[#9AA3AF]">
                        {c.franchiseType ? FRANCHISE_LABEL[c.franchiseType] ?? c.franchiseType : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#263544]">
                      {c.minPrice !== null ? `฿${c.minPrice.toLocaleString('th-TH')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={c.availableUnits < c.totalUnits ? 'font-semibold text-[#875200]' : 'text-[#263544]'}>
                        {c.availableUnits}
                      </span>
                      <span className="text-[#9AA3AF]"> / {c.totalUnits}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(c.id, c.status === 'active' ? 'inactive' : 'active')}
                        disabled={statusUpdatingId === c.id}
                        className="disabled:opacity-50"
                        title="กดเพื่อสลับเปิดเช่า/งดเช่า"
                      >
                        <StatusBadge tone={c.status === 'active' ? 'done' : 'closed'}>
                          {statusUpdatingId === c.id ? 'กำลังบันทึก…' : c.status === 'active' ? 'เปิดเช่า' : 'งดเช่า'}
                        </StatusBadge>
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/inventory/${c.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-full border border-[#D5D9E0] px-3 py-1 text-xs font-semibold text-[#263544] transition hover:border-[#263544]"
                        >
                          <PencilSimpleIcon size={12} weight="bold" />
                          แก้ไข
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id, c.name)}
                          disabled={deletingId === c.id}
                          className="rounded-full p-1.5 text-[#9AA3AF] transition hover:bg-[#FDE8E8] hover:text-[#B42318] disabled:opacity-50"
                          aria-label={`ลบ ${c.name}`}
                          title="ลบชุดนี้ออกจากคลัง"
                        >
                          <TrashIcon size={14} weight="bold" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
