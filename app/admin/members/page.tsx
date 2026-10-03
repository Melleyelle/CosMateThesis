'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import AdminLayout from '../../components/admin/AdminLayout'
import { EmptyState, Metric, MetricStrip, PageHeader, Segmented, StatusBadge } from '../../components/admin/ui'
import DateRangeFilter, { inDateRange, type DateRange } from '../../components/admin/inventory/DateRangeFilter'
import { fetchMembers, type Member } from '@/utils/admin/fetchMembers'
import { addDays, formatDateTime, todayISO } from '@/utils/dateUtils'
import type { Tone } from '@/utils/admin/statusTone'

type View = 'all' | 'with_orders' | 'no_orders' | 'restricted'

function memberStatus(m: Member): { label: string; tone: Tone } {
  if (m.trustLevel === 'blacklisted') return { label: 'แบล็กลิสต์', tone: 'problem' }
  if (m.status && m.status !== 'active') return { label: m.status === 'suspended' ? 'ระงับการใช้งาน' : m.status, tone: 'closed' }
  return { label: 'ใช้งานได้', tone: 'done' }
}

const isRestricted = (m: Member) => m.trustLevel === 'blacklisted' || (!!m.status && m.status !== 'active')

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [view, setView] = useState<View>('all')

  useEffect(() => {
    fetchMembers().then((res) => {
      if (res.error) setLoadError(res.error)
      else setMembers(res.data)
      setLoading(false)
    })
  }, [])

  const weekAgo = addDays(todayISO(), -6)
  const stats = useMemo(
    () => ({
      total: members.length,
      newThisWeek: members.filter((m) => inDateRange(m.createdAt, { from: weekAgo, to: '' })).length,
      withOrders: members.filter((m) => m.orderCount > 0).length,
      restricted: members.filter(isRestricted).length,
    }),
    [members, weekAgo],
  )

  // ช่วงวันสมัคร + คำค้นก่อน แล้วค่อยนับแยกตามมุมมอง ให้ตัวเลขบนปุ่มตรงกับที่เห็น
  const base = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return members.filter((m) => {
      if (!inDateRange(m.createdAt, range)) return false
      if (keyword) {
        const haystack = [m.email, m.firstName, m.lastName, m.phone].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
  }, [members, search, range])

  const viewCounts = {
    all: base.length,
    with_orders: base.filter((m) => m.orderCount > 0).length,
    no_orders: base.filter((m) => m.orderCount === 0).length,
    restricted: base.filter(isRestricted).length,
  }

  const filtered = base.filter((m) =>
    view === 'with_orders'
      ? m.orderCount > 0
      : view === 'no_orders'
        ? m.orderCount === 0
        : view === 'restricted'
          ? isRestricted(m)
          : true,
  )

  return (
    <AdminLayout>
      <div className="px-5 py-7 sm:px-8">
        <PageHeader title="สมาชิก" description="ดูว่าใครสมัครใช้งานเข้ามาบ้าง และใครเริ่มเช่าแล้ว" />

        <div className="mb-6">
          <MetricStrip>
            <Metric label="สมาชิกทั้งหมด" value={stats.total} onClick={() => setView('all')} />
            <Metric
              label="สมัครใหม่ 7 วันล่าสุด"
              value={stats.newThisWeek}
              onClick={() => {
                setRange({ from: weekAgo, to: todayISO() })
                setView('all')
              }}
            />
            <Metric label="เคยสั่งเช่าแล้ว" value={stats.withOrders} onClick={() => setView('with_orders')} />
            <Metric
              label="ถูกจำกัดการใช้งาน"
              value={<span className={stats.restricted ? 'text-[#B42318]' : ''}>{stats.restricted}</span>}
              onClick={() => setView('restricted')}
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
              placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร"
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
          <DateRangeFilter value={range} onChange={setRange} emptyLabel="ทุกวันที่สมัคร" />
        </div>

        <div className="mb-5 overflow-x-auto">
          <Segmented
            label="มุมมองสมาชิก"
            value={view}
            onChange={setView}
            options={[
              { value: 'all', label: 'ทั้งหมด', count: viewCounts.all },
              { value: 'with_orders', label: 'เคยสั่งเช่า', count: viewCounts.with_orders },
              { value: 'no_orders', label: 'ยังไม่เคยสั่ง', count: viewCounts.no_orders },
              { value: 'restricted', label: 'ถูกจำกัด', count: viewCounts.restricted },
            ]}
          />
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
              <EmptyState>{members.length === 0 ? 'ยังไม่มีสมาชิก' : 'ไม่พบสมาชิกตามเงื่อนไข'}</EmptyState>
            ) : (
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-[#EEEDF2] bg-[#FAFAFC] text-xs font-medium text-[#6B7280]">
                  <tr>
                    <th className="px-5 py-3 font-medium">สมาชิก</th>
                    <th className="px-4 py-3 font-medium">เบอร์โทร</th>
                    <th className="px-4 py-3 font-medium">สมัครเมื่อ</th>
                    <th className="px-4 py-3 font-medium">เข้าใช้ล่าสุด</th>
                    <th className="px-4 py-3 text-right font-medium">ออเดอร์</th>
                    <th className="px-5 py-3 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEDF2]">
                  {filtered.map((m) => {
                    const name = [m.firstName, m.lastName].filter(Boolean).join(' ')
                    const status = memberStatus(m)
                    return (
                      <tr key={m.id} className="hover:bg-[#FCFCFD]">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                            ) : (
                              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FDE3EE] text-sm font-bold uppercase text-[#E5457F]">
                                {(name || m.email || '?').charAt(0)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[#263544]">{name || 'ยังไม่ได้ตั้งชื่อ'}</p>
                              <p className="truncate text-xs text-[#6B7280]">{m.email ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-[#263544]">{m.phone || '—'}</td>
                        <td className="px-4 py-3.5 text-[#263544]">{formatDateTime(m.createdAt)}</td>
                        <td className="px-4 py-3.5 text-[#5B6472]">
                          {m.lastSignInAt ? formatDateTime(m.lastSignInAt) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          {m.orderCount > 0 ? (
                            <>
                              <span className="font-semibold text-[#263544]">{m.orderCount}</span>
                              {m.lastOrderAt && (
                                <p className="text-xs text-[#9AA3AF]">ล่าสุด {formatDateTime(m.lastOrderAt)}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-[#9AA3AF]">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </td>
                      </tr>
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
