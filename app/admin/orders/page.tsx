'use client'
/* eslint-disable @next/next/no-img-element */

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CaretDownIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import AdminLayout from '../../components/admin/AdminLayout'
import { EmptyState, FilterTabs, Metric, MetricStrip, PageHeader, StatusBadge } from '../../components/admin/ui'
import DateRangeFilter, { type DateRange } from '../../components/admin/inventory/DateRangeFilter'
import { createClient } from '@/utils/client'
import { fetchAllOrdersForAdmin, type OrderSummary } from '@/utils/customer/fetchOrders'
import { translateRpcError } from '@/utils/bookingErrors'
import { ADMIN_ACTIONS, type AdminAction, type OrderStatus } from '@/utils/orderStatus'
import { ADMIN_STATUS_LABEL, ORDER_STATUS_TONE } from '@/utils/admin/statusTone'
import { dayDiff, shipByDate } from '@/utils/admin/fetchDashboard'
import { formatBaht, formatDateTime, formatThaiDateWithWeekday, toISODate, todayISO } from '@/utils/dateUtils'
import {
  DEFAULT_BOOKING_SETTINGS,
  fetchBookingSettings,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'

// แท็บจัดกลุ่มตาม "งานที่แอดมินต้องทำ" ไม่ใช่ตามสถานะดิบทีละตัว
const TABS = [
  { value: 'all', label: 'ทั้งหมด', statuses: null },
  { value: 'review', label: 'ตรวจยอดชำระ', statuses: ['manual_review'] },
  { value: 'to_ship', label: 'รอแพ็กส่ง', statuses: ['paid'] },
  { value: 'renting', label: 'อยู่กับลูกค้า', statuses: ['shipped', 'active'] },
  { value: 'returning', label: 'ตรวจสภาพ', statuses: ['returned', 'inspecting'] },
  { value: 'unpaid', label: 'รอลูกค้าชำระ', statuses: ['pending_payment'] },
  { value: 'done', label: 'เสร็จสิ้น', statuses: ['completed'] },
  { value: 'closed', label: 'ยกเลิก/หมดอายุ', statuses: ['cancelled', 'expired'] },
] as const satisfies readonly { value: string; label: string; statuses: readonly OrderStatus[] | null }[]

type TabValue = (typeof TABS)[number]['value']

// ปุ่มหลักของแต่ละแถวใช้ภาษาแบรนด์ (มีกรอบ+เงา) เพราะคือ "สิ่งที่ต้องกด" — ที่เหลือเรียบ
const ACTION_STYLE: Record<AdminAction['tone'], string> = {
  primary:
    'border-2 border-[#263544] bg-[#E5457F] text-white shadow-[2px_2px_0_0_#263544] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#263544]',
  secondary: 'border border-[#D5D9E0] bg-white text-[#263544] hover:border-[#263544]',
  danger: 'text-[#B42318] hover:bg-[#FDE8E8]',
}

// วันสำคัญของออเดอร์ตามสถานะ: แอดมินอยากรู้ "เส้นตายถัดไป" ไม่ใช่ทุกวันพร้อมกัน
function keyDate(order: OrderSummary, s: BookingSettings, today: string) {
  const first = order.lines[0]
  if (!first) return null
  const returnBy = order.lines.map((l) => l.endDate).sort().slice(-1)[0]
  if (order.status === 'paid') {
    const shipBy = order.lines.map((l) => shipByDate(l.startDate, s)).sort()[0]
    const diff = dayDiff(today, shipBy)
    return { label: 'ส่งภายใน', date: shipBy, late: diff < 0, lateText: `เลยกำหนด ${-diff} วัน` }
  }
  if (order.status === 'shipped' || order.status === 'active') {
    const diff = dayDiff(today, returnBy)
    return { label: 'ลูกค้าคืนภายใน', date: returnBy, late: diff < -1, lateText: `เกินกำหนดคืน ${-diff - 1} วัน` }
  }
  return { label: 'วันใช้งาน', date: first.startDate, late: false, lateText: '' }
}

function countByStatusTab(list: OrderSummary[]) {
  const counts = {} as Record<TabValue, number>
  for (const t of TABS) {
    const statuses = t.statuses as readonly OrderStatus[] | null
    counts[t.value] = statuses ? list.filter((o) => statuses.includes(o.status)).length : list.length
  }
  return counts
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)

  const [tab, setTab] = useState<TabValue>('all')
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const today = todayISO()

  async function load() {
    const [res, s] = await Promise.all([fetchAllOrdersForAdmin(), fetchBookingSettings()])
    setSettings(s)
    if (res.error) setLoadError(res.error)
    else setOrders(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // รับลิงก์จากหน้าภาพรวม: ?tab=to_ship หรือ ?q=CM2026...
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    if (t && TABS.some((x) => x.value === t)) setTab(t as TabValue)
    const q = params.get('q')
    if (q) setSearch(q)
  }, [])

  // การ์ดสรุปด้านบน = งานค้างทั้งหมด ไม่ขึ้นกับช่วงวันที่ ส่วนแท็บ/ตารางนับตามช่วงวันที่สั่ง
  const countByTab = useMemo(() => countByStatusTab(orders), [orders])

  const ordersInRange = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return orders
    return orders.filter((o) => {
      const created = toISODate(new Date(o.createdAt)) // วันที่ตามเวลาเครื่อง ไม่ใช่ UTC
      if (dateRange.from && created < dateRange.from) return false
      if (dateRange.to && created > dateRange.to) return false
      return true
    })
  }, [orders, dateRange])

  const tabCounts = useMemo(() => countByStatusTab(ordersInRange), [ordersInRange])

  const lateCount = useMemo(
    () => orders.filter((o) => keyDate(o, settings, today)?.late && (o.status === 'paid' || o.status === 'shipped' || o.status === 'active')).length,
    [orders, settings, today],
  )

  const filtered = useMemo(() => {
    const statuses = (TABS.find((t) => t.value === tab)?.statuses ?? null) as readonly OrderStatus[] | null
    const keyword = search.trim().toLowerCase()
    return ordersInRange.filter((o) => {
      if (statuses && !statuses.includes(o.status)) return false
      if (keyword) {
        const haystack = [o.orderNumber, o.shipName, o.shipPhone, ...o.lines.map((l) => `${l.productName} ${l.itemCode ?? ''}`)]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
  }, [ordersInRange, tab, search])

  // ค้นหาด้วยเลขออเดอร์ตรงตัว (มาจากหน้าภาพรวม) → กางรายละเอียดให้เลย
  useEffect(() => {
    if (filtered.length === 1 && search.trim().toUpperCase().startsWith('CM')) setExpandedId(filtered[0].id)
  }, [filtered, search])

  async function handleAction(order: OrderSummary, action: AdminAction) {
    const supabase = createClient()
    if (!supabase) return
    if (action.tone === 'danger' && !confirm(`ยกเลิกออเดอร์ ${order.orderNumber}? ชุดจะถูกปล่อยให้คนอื่นจองได้ทันที`)) return

    setUpdatingId(order.id)
    const { error } = await supabase.rpc('admin_update_order_status', { p_order_id: order.id, p_new_status: action.to })
    setUpdatingId(null)

    if (error) {
      alert(translateRpcError(error.message))
      await load() // สถานะอาจถูกเปลี่ยนจากที่อื่นไปแล้ว ดึงของจริงมาแสดง
      return
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: action.to, updatedAt: new Date().toISOString() } : o)),
    )
  }

  return (
    <AdminLayout>
      <div className="px-5 py-7 sm:px-8">
        <PageHeader title="ออเดอร์" description="ตรวจการชำระเงิน แพ็กส่ง และรับคืนชุด" />

        <div className="mb-6">
          <MetricStrip>
            <Metric label="ตรวจยอดชำระ" value={countByTab.review} note="ลูกค้าแจ้งโอนแล้ว" onClick={() => setTab('review')} />
            <Metric label="รอแพ็กส่ง" value={countByTab.to_ship} note="ชำระแล้ว" onClick={() => setTab('to_ship')} />
            <Metric label="อยู่กับลูกค้า" value={countByTab.renting} note="จัดส่งแล้ว/กำลังใช้งาน" onClick={() => setTab('renting')} />
            <Metric
              label="เลยกำหนด"
              value={<span className={lateCount ? 'text-[#B42318]' : ''}>{lateCount}</span>}
              note="ส่งออกช้าหรือลูกค้าคืนช้า"
            />
          </MetricStrip>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlassIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9AA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลขออเดอร์ ชื่อลูกค้า เบอร์โทร ชื่อชุด หรือรหัสชุด"
              className="w-full rounded-full border border-[#D5D9E0] bg-white py-2.5 pl-11 pr-10 text-sm text-[#263544] outline-none placeholder:text-[#9AA3AF] focus:border-[#263544] focus:ring-2 focus:ring-[#263544]/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#9AA3AF] hover:text-[#263544]"
              >
                <XIcon size={14} weight="bold" />
              </button>
            )}
          </div>
          <DateRangeFilter value={dateRange} onChange={setDateRange} emptyLabel="ทุกวันที่สั่ง" />
        </div>

        <div className="mb-5 overflow-x-auto">
          <FilterTabs tabs={TABS} value={tab} onChange={setTab} counts={tabCounts} />
        </div>

        {loading && <div className="h-64 animate-pulse rounded-2xl bg-white" />}

        {!loading && loadError && (
          <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-6 text-center text-sm text-[#B42318]">
            {loadError}
          </p>
        )}

        {!loading && !loadError && (
          <div className="overflow-x-auto rounded-2xl border border-[#E4E3EA] bg-white">
            {filtered.length === 0 ? (
              <EmptyState>{orders.length === 0
                  ? 'ยังไม่มีออเดอร์ในระบบ'
                  : ordersInRange.length === 0
                    ? 'ไม่มีออเดอร์ในช่วงวันที่เลือก'
                    : 'ไม่มีออเดอร์ในกลุ่มนี้'}</EmptyState>
            ) : (
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-[#EEEDF2] bg-[#FAFAFC] text-xs font-medium text-[#6B7280]">
                  <tr>
                    <th className="px-5 py-3 font-medium">ออเดอร์</th>
                    <th className="px-4 py-3 font-medium">ลูกค้า</th>
                    <th className="px-4 py-3 font-medium">ชุด</th>
                    <th className="px-4 py-3 font-medium">เส้นตายถัดไป</th>
                    <th className="px-4 py-3 text-right font-medium">ยอดรวม</th>
                    <th className="px-4 py-3 font-medium">สถานะ</th>
                    <th className="px-5 py-3 font-medium">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEDF2]">
                  {filtered.map((order) => {
                    const expanded = expandedId === order.id
                    const actions = ADMIN_ACTIONS[order.status]
                    const key = keyDate(order, settings, today)
                    return (
                      <Fragment key={order.id}>
                        <tr className={`align-top transition ${expanded ? 'bg-[#FAFAFC]' : 'hover:bg-[#FCFCFD]'}`}>
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              onClick={() => setExpandedId(expanded ? null : order.id)}
                              aria-expanded={expanded}
                              className="flex items-center gap-1.5 font-semibold tabular-nums text-[#263544] hover:text-[#C92D67]"
                            >
                              <CaretDownIcon size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                              {order.orderNumber}
                            </button>
                            <p className="pl-5 text-xs text-[#9AA3AF]">{formatDateTime(order.createdAt)}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-[#263544]">{order.shipName}</p>
                            <p className="text-xs tabular-nums text-[#6B7280]">{order.shipPhone}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            {order.lines.map((line) => (
                              <div key={line.id} className="mb-1.5 last:mb-0">
                                <p className="text-[#263544]">
                                  {line.productName}
                                  {line.size && <span className="text-[#6B7280]"> ไซส์ {line.size}</span>}
                                </p>
                                {line.itemCode && (
                                  <span className="text-xs tabular-nums text-[#6B7280]" title="รหัสชุดจริงที่ต้องหยิบ">
                                    ป้าย {line.itemCode}
                                  </span>
                                )}
                              </div>
                            ))}
                          </td>
                          <td className="px-4 py-3.5">
                            {key ? (
                              <>
                                <p className="text-xs text-[#6B7280]">{key.label}</p>
                                <p className={`font-medium ${key.late ? 'text-[#B42318]' : 'text-[#263544]'}`}>
                                  {formatThaiDateWithWeekday(key.date)}
                                </p>
                                {key.late && (
                                  <div className="mt-1">
                                    <StatusBadge tone="problem">{key.lateText}</StatusBadge>
                                  </div>
                                )}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-[#263544]">
                            {formatBaht(order.grandTotal)}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge tone={ORDER_STATUS_TONE[order.status]}>{ADMIN_STATUS_LABEL[order.status]}</StatusBadge>
                          </td>
                          <td className="px-5 py-3.5">
                            {actions.length === 0 ? (
                              <span className="text-xs text-[#9AA3AF]">—</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {actions.map((action) => (
                                  <button
                                    key={action.to}
                                    type="button"
                                    onClick={() => handleAction(order, action)}
                                    disabled={updatingId === order.id}
                                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${ACTION_STYLE[action.tone]}`}
                                  >
                                    {updatingId === order.id && action.tone === 'primary' ? 'กำลังบันทึก…' : action.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>

                        {expanded && (
                          <tr className="bg-[#FAFAFC]">
                            <td colSpan={7} className="px-5 pb-5 pt-1">
                              <div className="grid gap-4 rounded-xl border border-[#EEEDF2] bg-white p-4 text-sm sm:grid-cols-3">
                                <DetailBlock title="ที่อยู่จัดส่ง">
                                  <p className="font-medium text-[#263544]">
                                    {order.shipName} ({order.shipPhone})
                                  </p>
                                  <p className="text-[#5B6472]">
                                    {[order.shipAddress, order.shipSubdistrict, order.shipDistrict, order.shipProvince, order.shipPostalCode]
                                      .filter(Boolean)
                                      .join(' ')}
                                  </p>
                                  {order.customerNote && (
                                    <p className="mt-2 rounded-lg bg-[#FFF1D6] px-2.5 py-1.5 text-xs text-[#875200]">
                                      หมายเหตุจากลูกค้า: {order.customerNote}
                                    </p>
                                  )}
                                </DetailBlock>
                                <DetailBlock title="ยอดเงิน">
                                  <MoneyRow label="ค่าเช่า" value={order.rentalTotal} />
                                  <MoneyRow label="มัดจำ (ต้องคืนลูกค้า)" value={order.depositTotal} />
                                  <MoneyRow label="ค่าซักรีด" value={order.laundryTotal} />
                                  <MoneyRow label="ค่าส่ง" value={order.shippingFee} />
                                  <div className="mt-1 border-t border-[#EEEDF2] pt-1">
                                    <MoneyRow label="รวม" value={order.grandTotal} strong />
                                  </div>
                                </DetailBlock>
                                <DetailBlock title="บัญชีคืนมัดจำ">
                                  {order.refundAccountNumber ? (
                                    <>
                                      <p className="font-medium text-[#263544]">{order.refundAccountName}</p>
                                      <p className="text-[#5B6472]">{order.refundBank}</p>
                                      <p className="font-semibold tabular-nums text-[#263544]">{order.refundAccountNumber}</p>
                                    </>
                                  ) : (
                                    <p className="text-[#9AA3AF]">ลูกค้ายังไม่ได้ระบุ</p>
                                  )}
                                  <p className="mt-3 text-xs text-[#9AA3AF]">อัปเดตล่าสุด {formatDateTime(order.updatedAt)}</p>
                                </DetailBlock>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-[#6B7280]">{title}</p>
      {children}
    </div>
  )
}

function MoneyRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <p className="flex justify-between gap-4 py-0.5">
      <span className={strong ? 'font-medium text-[#263544]' : 'text-[#5B6472]'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-bold text-[#263544]' : 'font-medium text-[#263544]'}`}>{formatBaht(value)}</span>
    </p>
  )
}
