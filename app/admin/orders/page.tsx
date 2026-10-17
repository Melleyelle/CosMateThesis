'use client'

// หน้าออเดอร์แอดมิน = คิวงานหน้าเดียว
// ซ้าย: รายการตามแท็บ (เรียงตามเส้นตาย) · ขวา: ฟอร์มของงานที่ออเดอร์นั้นต้องทำ
// ทำเสร็จแล้วเลื่อนไปออเดอร์ถัดไปในคิวเดียวกันเอง — ไม่ต้องกดเข้า-ออกทีละหน้า

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircleIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import AdminLayout from '../../components/admin/AdminLayout'
import { EmptyState, PageHeader, StatusBadge } from '../../components/admin/ui'
import DateRangeFilter, { inDateRange, type DateRange } from '../../components/admin/inventory/DateRangeFilter'
import OrderPanel from '../../components/admin/orders/OrderPanel'
import { fetchAllOrdersForAdmin, type OrderSummary } from '@/utils/customer/fetchOrders'
import { ADMIN_STATUS_LABEL, ORDER_STATUS_TONE } from '@/utils/admin/statusTone'
import { dueOf, taskOf, type OrderTask } from '@/utils/admin/orderOps'
import { todayISO } from '@/utils/dateUtils'
import { DEFAULT_BOOKING_SETTINGS, fetchBookingSettings, type BookingSettings } from '@/utils/customer/bookingSettings'

// ค่า value เดิมคงไว้ เพราะหน้าภาพรวมลิงก์มาด้วย ?tab=...
type TabDef = {
  value: string
  label: string
  group: 'todo' | 'tracking' | 'closed' | 'all'
  match: (o: OrderSummary, task: OrderTask) => boolean
}

const TABS: TabDef[] = [
  { value: 'review', label: 'ตรวจยอดชำระ', group: 'todo', match: (_, t) => t === 'slip' },
  { value: 'to_ship', label: 'รอแพ็กส่ง', group: 'todo', match: (_, t) => t === 'pack' },
  { value: 'returning', label: 'รับคืนและตรวจ', group: 'todo', match: (_, t) => t === 'inspect' || t === 'lost' },
  { value: 'refund', label: 'รอโอนเงินคืน', group: 'todo', match: (_, t) => t === 'refund' },
  { value: 'unpaid', label: 'รอลูกค้าชำระ', group: 'tracking', match: (o) => o.status === 'pending_payment' },
  { value: 'renting', label: 'อยู่กับลูกค้า', group: 'tracking', match: (o, t) => (o.status === 'shipped' || o.status === 'active') && t === 'view' },
  { value: 'done', label: 'เสร็จสิ้น', group: 'closed', match: (o, t) => o.status === 'completed' && t === 'view' },
  { value: 'closed', label: 'ยกเลิก/หมดอายุ', group: 'closed', match: (o, t) => (o.status === 'cancelled' || o.status === 'expired') && t === 'view' },
  { value: 'all', label: 'ทั้งหมด', group: 'all', match: () => true },
]

const GROUP_LABEL = { todo: 'ร้านต้องทำ', tracking: 'ติดตาม', closed: 'ปิดแล้ว', all: '' } as const

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
  const [tab, setTab] = useState('to_ship')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const advanceRef = useRef<{ id: string; index: number } | null>(null)
  const tabFromUrl = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const today = todayISO()

  const load = useCallback(async () => {
    const [res, s] = await Promise.all([fetchAllOrdersForAdmin(), fetchBookingSettings()])
    setSettings(s)
    if (res.error) setLoadError(res.error)
    else setOrders(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    if (t && TABS.some((x) => x.value === t)) {
      setTab(t)
      tabFromUrl.current = true
    }
    const q = params.get('q')
    if (q) {
      setSearch(q)
      setTab('all')
      tabFromUrl.current = true
    }
  }, [load])

  // คำค้น + ช่วงวันที่ก่อน แล้วค่อยแยกแท็บ → ตัวเลขบนแท็บตรงกับรายการที่เห็น
  const base = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return orders
      .filter((o) => inDateRange(o.createdAt, range))
      .filter((o) => {
        if (!keyword) return true
        return [o.orderNumber, o.shipName, o.shipPhone, o.shipTrackingNo ?? '', o.returnTrackingNo ?? '', ...o.lines.map((l) => `${l.productName} ${l.itemCode ?? ''}`)]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      })
      .map((o) => ({ order: o, task: taskOf(o, today), due: dueOf(o, settings, today) }))
  }, [orders, search, range, settings, today])

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, base.filter((r) => t.match(r.order, r.task)).length])), [base])

  // เปิดหน้าครั้งแรก: ไปคิวแรกที่มีงานค้าง (ไม่มีงานเลย = ทั้งหมด)
  useEffect(() => {
    if (loading || tabFromUrl.current) return
    tabFromUrl.current = true
    setTab(TABS.find((t) => t.group === 'todo' && (counts[t.value] ?? 0) > 0)?.value ?? 'all')
  }, [loading, counts])

  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const list = useMemo(() => {
    const rows = base.filter((r) => current.match(r.order, r.task))
    // งานของร้าน: ด่วนสุดอยู่บน · ที่เหลือ: ใหม่สุดอยู่บน
    return current.group === 'todo'
      ? rows.sort((a, b) => a.due.sortKey.localeCompare(b.due.sortKey))
      : rows.sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt))
  }, [base, current])

  // เลือกแถวให้เสมอ: หลังทำงานเสร็จ → ตัวถัดไปในคิว · ไม่มีที่เลือก → แถวแรก
  useEffect(() => {
    const adv = advanceRef.current
    if (adv) {
      advanceRef.current = null
      if (list.some((r) => r.order.id === adv.id)) return setSelectedId(adv.id)
      return setSelectedId(list[Math.min(adv.index, list.length - 1)]?.order.id ?? null)
    }
    if (!selectedId || !list.some((r) => r.order.id === selectedId)) setSelectedId(list[0]?.order.id ?? null)
  }, [list, selectedId])

  const selectedIndex = list.findIndex((r) => r.order.id === selectedId)
  const selected = selectedIndex >= 0 ? list[selectedIndex].order : null

  function select(id: string) {
    setSelectedId(id)
    setToast(null)
    // จอแคบ: แผงอยู่ใต้รายการ เลื่อนลงไปให้เห็นทันที
    if (window.innerWidth < 1024) requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function handleDone(message: string) {
    if (selected) advanceRef.current = { id: selected.id, index: Math.max(0, selectedIndex) }
    await load()
    setToast(message)
  }

  function changeTab(value: string) {
    setTab(value)
    setSelectedId(null)
    setToast(null)
  }

  return (
    <AdminLayout>
      <div className="theme-v2 px-5 py-7 sm:px-8">
        <PageHeader title="ออเดอร์" description="เลือกคิวงาน กดออเดอร์ทางซ้าย แล้วทำงานในแผงขวา ทำเสร็จระบบไปออเดอร์ถัดไปให้เอง" />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlassIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลขออเดอร์ ชื่อลูกค้า เบอร์โทร ชื่อชุด รหัสชุด หรือเลขพัสดุ"
              aria-label="ค้นหาออเดอร์"
              className="w-full rounded-full border border-line bg-white py-2.5 pl-11 pr-10 text-sm text-ink outline-none placeholder:text-muted focus:ring-[3px] focus:ring-brand/25"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-ink"
              >
                <XIcon size={14} weight="bold" />
              </button>
            )}
          </div>
          <DateRangeFilter value={range} onChange={setRange} emptyLabel="ทุกวันที่สั่ง" />
        </div>

        <div role="tablist" aria-label="คิวงาน" className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2">
          {TABS.map((t, i) => {
            const active = t.value === tab
            const showGroup = t.group !== 'all' && TABS[i - 1]?.group !== t.group
            const count = counts[t.value] ?? 0
            return (
              <span key={t.value} className="contents">
                {showGroup && <span className={`text-xs text-muted ${i > 0 ? 'ml-2' : ''}`}>{GROUP_LABEL[t.group]}</span>}
                {t.group === 'all' && <span className="mx-1 h-5 w-px bg-line-subtle" aria-hidden />}
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeTab(t.value)}
                  className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm transition ${
                    active ? 'border-line bg-brand-soft font-bold text-ink' : 'border-line-subtle bg-white text-ink hover:border-line'
                  }`}
                >
                  {t.label}
                  <span
                    className={`min-w-[20px] rounded-full px-1.5 text-center text-xs tabular-nums ${
                      active ? 'bg-white' : t.group === 'todo' && count > 0 ? 'bg-warning-subtle font-semibold text-warning' : 'bg-sunken text-secondary'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </span>
            )
          })}
        </div>

        {loading && <div className="h-72 animate-pulse rounded-card bg-sunken" />}

        {!loading && loadError && (
          <p role="alert" className="rounded-control bg-danger-subtle px-4 py-6 text-center text-sm text-danger">
            {loadError}
          </p>
        )}

        {!loading && !loadError && (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
            <section aria-label={`รายการ ${current.label}`} className="flex flex-col gap-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
              {list.length === 0 ? (
                <div className="rounded-card border border-dashed border-line-subtle">
                  <EmptyState>{orders.length === 0 ? 'ยังไม่มีออเดอร์ในระบบ' : current.group === 'todo' ? 'คิวนี้ว่างแล้ว' : 'ไม่มีออเดอร์ในกลุ่มนี้'}</EmptyState>
                </div>
              ) : (
                list.map(({ order: o, due }) => {
                  const active = o.id === selectedId
                  const first = o.lines[0]
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => select(o.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`flex flex-col gap-0.5 rounded-card border px-4 py-3 text-left transition ${
                        active ? 'border-line bg-brand-subtle' : 'border-line-subtle bg-white hover:border-line'
                      }`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-ink">{o.orderNumber}</span>
                        {due.text && (
                          <span className={`whitespace-nowrap text-xs font-semibold ${due.tone === 'late' ? 'text-danger' : due.tone === 'urgent' ? 'text-warning' : 'text-secondary'}`}>
                            {due.text}
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-ink">{o.shipName}</span>
                      <span className="truncate text-sm text-secondary">
                        {first ? `${first.productName}${first.size ? ` · ${first.size}` : ''}` : '—'}
                        {o.lines.length > 1 && ` +${o.lines.length - 1}`}
                      </span>
                      {current.group !== 'todo' && (
                        <span className="mt-1">
                          <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{ADMIN_STATUS_LABEL[o.status]}</StatusBadge>
                        </span>
                      )}
                    </button>
                  )
                })
              )}
              {list.length > 0 && current.group === 'todo' && <p className="px-1 text-xs text-muted">เรียงตามเส้นตาย ด่วนสุดอยู่บน</p>}
            </section>

            <div ref={panelRef} className="flex scroll-mt-4 flex-col gap-3">
              {toast && (
                <p role="status" className="flex items-center gap-2 rounded-control border border-[#B8E2C8] bg-success-subtle px-4 py-2.5 text-sm font-semibold text-success">
                  <CheckCircleIcon size={18} weight="fill" />
                  {toast}
                  {selected ? ` · ถัดไป ${selected.orderNumber}` : ' · คิวนี้ครบแล้ว'}
                </p>
              )}
              {selected ? (
                <OrderPanel
                  order={selected}
                  settings={settings}
                  today={today}
                  position={current.group === 'todo' ? `รายการ ${selectedIndex + 1} จาก ${list.length}` : ''}
                  onDone={handleDone}
                />
              ) : (
                list.length === 0 &&
                current.group === 'todo' && (
                  <div className="rounded-card border border-line-subtle px-6 py-16 text-center">
                    <p className="text-lg font-semibold text-ink">ทำคิวนี้ครบแล้ว</p>
                    <p className="mt-1 text-sm text-secondary">เลือกคิวอื่นด้านบน หรือดูออเดอร์ทั้งหมด</p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
