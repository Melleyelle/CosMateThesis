'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CaretRightIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import AdminLayout from '../../components/admin/AdminLayout'
import { EmptyState, Metric, MetricStrip, PageHeader, Segmented, StatusBadge } from '../../components/admin/ui'
import DateRangeFilter, { inDateRange, type DateRange } from '../../components/admin/inventory/DateRangeFilter'
import { fetchMembers, type Member } from '@/utils/admin/fetchMembers'
import IdCardReview, { ID_STATUS_BADGE } from '../../components/admin/IdCardReview'
import MemberDrawer from '../../components/admin/members/MemberDrawer'
import { createClient } from '@/utils/client'
import { addDays, formatDateTime, todayISO } from '@/utils/dateUtils'
import type { Tone } from '@/utils/admin/statusTone'

type View = 'all' | 'with_orders' | 'no_orders' | 'id_pending' | 'restricted'

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
  // ตรวจรูปบัตรของสมาชิกที่ส่งไว้ล่วงหน้า (ออเดอร์ที่รอตรวจบัตรอยู่ในหน้าออเดอร์ด้วย)
  const [reviewing, setReviewing] = useState<Member | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // แผงรายละเอียด: เก็บ id ไว้ โหลดรายการใหม่แล้วแผงยังแสดงข้อมูลล่าสุดของคนเดิม
  const [openId, setOpenId] = useState<string | null>(null)
  const [selfId, setSelfId] = useState<string | null>(null)

  function load() {
    return fetchMembers().then((res) => {
      if (res.error) setLoadError(res.error)
      else setMembers(res.data)
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
    createClient()?.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null))
  }, [])

  const opened = members.find((m) => m.id === openId) ?? null
  const nameOf = useCallback(
    (id: string | null) => {
      const m = id ? members.find((x) => x.id === id) : null
      return m ? [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'แอดมิน' : 'แอดมิน'
    },
    [members],
  )
  const closeDrawer = useCallback(() => setOpenId(null), [])

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
    id_pending: base.filter((m) => m.idStatus === 'pending').length,
    restricted: base.filter(isRestricted).length,
  }

  const filtered = base.filter((m) =>
    view === 'with_orders'
      ? m.orderCount > 0
      : view === 'no_orders'
        ? m.orderCount === 0
        : view === 'id_pending'
          ? m.idStatus === 'pending'
          : view === 'restricted'
            ? isRestricted(m)
            : true,
  )

  return (
    <AdminLayout>
      <div className="px-5 py-7 sm:px-8">
        <PageHeader title="สมาชิก" description="กดที่สมาชิกเพื่อดูประวัติการเช่า เขียนโน้ต หรือระงับ/แบล็กลิสต์บัญชี" />

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
              { value: 'id_pending', label: 'รอตรวจบัตร', count: viewCounts.id_pending },
              { value: 'restricted', label: 'ถูกจำกัด', count: viewCounts.restricted },
            ]}
          />
        </div>

        {notice && (
          <p role="status" className="mb-4 rounded-xl bg-[#E3F5EA] px-4 py-2.5 text-sm text-[#1B6E45]">
            {notice}
          </p>
        )}

        {loading && <div className="h-64 animate-pulse rounded-2xl bg-white" />}

        {!loading && loadError && (
          <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-6 text-center text-sm text-[#B42318]">
            {loadError}
          </p>
        )}

        {!loading && !loadError && (
          <div className="overflow-hidden rounded-2xl border border-[#E4E3EA] bg-white">
            {filtered.length === 0 ? (
              <EmptyState>{members.length === 0 ? 'ยังไม่มีสมาชิก' : 'ไม่พบสมาชิกตามเงื่อนไข'}</EmptyState>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#EEEDF2] bg-[#FAFAFC] text-xs font-medium text-[#6B7280]">
                  <tr>
                    <th className="px-5 py-3 font-medium">สมาชิก</th>
                    <th className="px-4 py-3 font-medium">เบอร์โทร</th>
                    <th className="px-4 py-3 font-medium">สมัครเมื่อ</th>
                    <th className="px-4 py-3 font-medium">เข้าใช้ล่าสุด</th>
                    <th className="px-4 py-3 text-right font-medium">ออเดอร์</th>
                    <th className="px-4 py-3 font-medium">บัตรประชาชน</th>
                    <th className="px-5 py-3 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEDF2]">
                  {filtered.map((m) => {
                    const name = [m.firstName, m.lastName].filter(Boolean).join(' ')
                    const status = memberStatus(m)
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setOpenId(m.id)}
                        className={`cursor-pointer ${m.id === openId ? 'bg-[#FDEEF3]' : 'hover:bg-[#FCFCFD]'}`}
                      >
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenId(m.id)
                            }}
                            aria-label={`ดูรายละเอียด ${name || m.email || 'สมาชิก'}`}
                            className="flex max-w-[240px] items-center gap-3 rounded-lg text-left"
                          >
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
                          </button>
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
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <StatusBadge tone={ID_STATUS_BADGE[m.idStatus].tone}>{ID_STATUS_BADGE[m.idStatus].label}</StatusBadge>
                            {m.idStatus === 'pending' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setNotice(null)
                                  setReviewing(m)
                                }}
                                className="text-xs font-semibold text-[#E5457F] hover:underline"
                              >
                                ตรวจ
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="flex items-center justify-between gap-2 whitespace-nowrap">
                            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                            <CaretRightIcon size={16} className="text-[#9AA3AF]" aria-hidden />
                          </span>
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

      {opened && (
        <MemberDrawer
          member={opened}
          isSelf={opened.id === selfId}
          nameOf={nameOf}
          onReviewId={() => {
            setNotice(null)
            setReviewing(opened)
          }}
          onChanged={(msg) => {
            setNotice(msg)
            load()
          }}
          onClose={closeDrawer}
        />
      )}

      {reviewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`ตรวจบัตรของ ${reviewing.email ?? 'สมาชิก'}`}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setReviewing(null)}
        >
          <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white">
            <div className="flex items-center justify-between border-b border-[#EEEDF2] px-5 py-3">
              <p className="font-semibold text-[#263544]">
                {[reviewing.firstName, reviewing.lastName].filter(Boolean).join(' ') || reviewing.email}
              </p>
              <button type="button" onClick={() => setReviewing(null)} aria-label="ปิด" className="rounded-full p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]">
                <XIcon size={18} />
              </button>
            </div>
            <IdCardReview
              userId={reviewing.id}
              bookerName={[reviewing.firstName, reviewing.lastName].filter(Boolean).join(' ') || null}
              onDone={(msg) => {
                setReviewing(null)
                setNotice(msg)
                load()
              }}
            />
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
