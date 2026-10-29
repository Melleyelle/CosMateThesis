'use client'
/* eslint-disable @next/next/no-img-element */

// แผงรายละเอียดสมาชิก (เปิดจากแถวในหน้าสมาชิก)
// ข้อมูลติดต่อ · สถิติการเช่า · สิทธิ์การใช้งาน (ระงับ / แบล็กลิสต์ / เปิดใช้งาน) · โน้ตภายในร้าน · ออเดอร์ล่าสุด · ประวัติ

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ProhibitIcon, PauseCircleIcon, CheckCircleIcon, WarningIcon, XIcon } from '@phosphor-icons/react'
import { StatusBadge, primaryButtonClass, secondaryButtonClass } from '@/app/components/admin/ui'
import { ID_STATUS_BADGE } from '@/app/components/admin/IdCardReview'
import type { Member } from '@/utils/admin/fetchMembers'
import {
  ACCESS_ACTION_LABEL,
  fetchMemberAdminData,
  isBlacklisted,
  isSuspended,
  setMemberAccess,
  setMemberNote,
  type AccessAction,
  type AccessLog,
  type MemberNote,
} from '@/utils/admin/memberOps'
import { fetchOrdersOfMemberForAdmin, type OrderSummary } from '@/utils/customer/fetchOrders'
import { orderBadge, type Tone } from '@/utils/admin/statusTone'
import { lateDays } from '@/utils/admin/orderOps'
import { translateRpcError } from '@/utils/bookingErrors'
import { formatBaht, formatDateTime, todayISO } from '@/utils/dateUtils'

// ออเดอร์ที่ยังไม่จบ — ระงับ/แบล็กลิสต์ไม่ยกเลิกให้ แอดมินต้องตามดูเอง
const OPEN_STATUSES = ['awaiting_id', 'pending_payment', 'manual_review', 'paid', 'shipped', 'active', 'returned', 'inspecting']
// ออเดอร์ที่ลูกค้าจ่ายเงินแล้ว → นับเป็นยอดใช้จ่าย
const PAID_STATUSES = ['paid', 'shipped', 'active', 'returned', 'inspecting', 'completed']

const QUICK_REASONS: Record<AccessAction, string[]> = {
  suspend: ['รอตรวจสอบปัญหาออเดอร์', 'ติดต่อลูกค้าไม่ได้', 'ข้อมูลบัญชีไม่ตรงกับบัตร'],
  blacklist: ['ไม่คืนชุด', 'ทำชุดเสียหายหนักและไม่รับผิดชอบ', 'จองแล้วไม่จ่ายซ้ำหลายครั้ง'],
  reactivate: ['ตรวจสอบแล้ว ไม่มีปัญหา', 'ลูกค้าชดใช้ครบแล้ว'],
}

const ACTION_HINT: Record<AccessAction, string> = {
  suspend: 'ลูกค้ายังเข้าระบบได้ แต่จองชุดใหม่ไม่ได้ จนกว่าร้านจะเปิดใช้งานให้',
  blacklist: 'ห้ามเช่าถาวร จองชุดใหม่และส่งรูปบัตรไม่ได้ ร้านเก็บรูปบัตรไว้เป็นหลักฐาน',
  reactivate: 'ลูกค้ากลับมาจองชุดได้ตามปกติ',
}

const ACTION_TONE: Record<AccessAction, Tone> = { suspend: 'closed', blacklist: 'problem', reactivate: 'done' }

type Props = {
  member: Member
  isSelf: boolean
  nameOf: (userId: string | null) => string
  onReviewId: () => void
  onChanged: (message: string) => void
  onClose: () => void
}

export default function MemberDrawer({ member, isSelf, nameOf, onReviewId, onChanged, onClose }: Props) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [admin, setAdmin] = useState<{ note: MemberNote | null; log: AccessLog[]; missing: boolean } | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ')
  const today = todayISO()

  useEffect(() => {
    let alive = true
    fetchOrdersOfMemberForAdmin(member.id).then((res) => {
      if (!alive) return
      setOrders(res.data)
      setOrdersError(res.error)
    })
    return () => {
      alive = false
    }
  }, [member.id])

  useEffect(() => {
    let alive = true
    fetchMemberAdminData(member.id).then((res) => {
      if (!alive) return
      setAdmin(res)
      setAdminError(res.error)
    })
    return () => {
      alive = false
    }
  }, [member.id, reload])

  // Esc ปิดแผง
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const stats = useMemo(() => {
    if (!orders) return null
    return {
      total: orders.length,
      completed: orders.filter((o) => o.status === 'completed').length,
      dropped: orders.filter((o) => o.status === 'cancelled' || o.status === 'expired').length,
      // นับเฉพาะออเดอร์ที่ลูกค้ากรอกเลขพัสดุคืนแล้ว (ไม่งั้น lateDays นับถึงวันนี้)
      late: orders.filter((o) => o.returnSubmittedAt && lateDays(o, today) > 0).length,
      spent: orders.filter((o) => PAID_STATUSES.includes(o.status)).reduce((sum, o) => sum + o.rentalTotal + o.laundryTotal, 0),
      open: orders.filter((o) => OPEN_STATUSES.includes(o.status)).length,
    }
  }, [orders, today])

  const idBadge = ID_STATUS_BADGE[member.idStatus]

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`รายละเอียดสมาชิก ${name || member.email || ''}`}
        className="flex h-full w-full max-w-xl flex-col bg-[#F5F4F8] shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-[#E4E3EA] bg-white px-5 py-4">
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#FDE3EE] text-lg font-bold uppercase text-[#E5457F]">
              {(name || member.email || '?').charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-[#263544]">{name || 'ยังไม่ได้ตั้งชื่อ'}</h2>
            <p className="truncate text-sm text-[#6B7280]">{member.email ?? '—'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-full p-2 text-[#6B7280] hover:bg-[#F3F4F6]">
            <XIcon size={20} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <AccessSection
            member={member}
            isSelf={isSelf}
            openOrders={stats?.open ?? 0}
            disabled={!!admin?.missing}
            onDone={(msg) => {
              setReload((n) => n + 1)
              onChanged(msg)
            }}
          />

          {admin?.missing && (
            <p role="alert" className="rounded-xl bg-[#FFF1D6] px-4 py-3 text-sm text-[#875200]">
              ยังไม่ได้รัน SQL Step 27 (cosmate_step27_member_admin.sql) จึงยังเปลี่ยนสิทธิ์และเขียนโน้ตไม่ได้
            </p>
          )}
          {adminError && <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-3 text-sm text-[#B42318]">{adminError}</p>}

          <Section title="ข้อมูลติดต่อ">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-[#6B7280]">เบอร์โทร</dt>
              <dd className="tabular-nums text-[#263544]">{member.phone || '—'}</dd>
              <dt className="text-[#6B7280]">สมัครเมื่อ</dt>
              <dd className="text-[#263544]">{formatDateTime(member.createdAt)}</dd>
              <dt className="text-[#6B7280]">เข้าใช้ล่าสุด</dt>
              <dd className="text-[#263544]">{member.lastSignInAt ? formatDateTime(member.lastSignInAt) : '—'}</dd>
              <dt className="text-[#6B7280]">บัตรประชาชน</dt>
              <dd className="flex items-center gap-2">
                <StatusBadge tone={idBadge.tone}>{idBadge.label}</StatusBadge>
                {member.idStatus === 'pending' && (
                  <button type="button" onClick={onReviewId} className="text-xs font-semibold text-[#E5457F] hover:underline">
                    ตรวจบัตร
                  </button>
                )}
              </dd>
            </dl>
          </Section>

          <Section title="การเช่า">
            {ordersError ? (
              <p className="text-sm text-[#B42318]">{ordersError}</p>
            ) : !stats ? (
              <div className="h-16 animate-pulse rounded-xl bg-[#F5F4F8]" />
            ) : (
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-[#E4E3EA] bg-[#EEEDF2] text-center sm:grid-cols-5 [&>*]:bg-white">
                <Stat label="ออเดอร์" value={stats.total} />
                <Stat label="เช่าสำเร็จ" value={stats.completed} />
                <Stat label="ยกเลิก/หมดอายุ" value={stats.dropped} warn={stats.dropped >= 3} />
                <Stat label="ส่งคืนช้า" value={stats.late} warn={stats.late > 0} />
                <Stat label="ยอดค่าเช่า" value={formatBaht(stats.spent)} />
              </div>
            )}
          </Section>

          <NoteSection
            key={`${member.id}:${admin?.note?.updatedAt ?? ''}`}
            userId={member.id}
            note={admin?.note ?? null}
            loading={!admin}
            disabled={!!admin?.missing}
            nameOf={nameOf}
            onSaved={() => setReload((n) => n + 1)}
          />

          <Section title="ออเดอร์ล่าสุด">
            {!orders ? (
              <div className="h-24 animate-pulse rounded-xl bg-[#F5F4F8]" />
            ) : orders.length === 0 ? (
              <p className="text-sm text-[#6B7280]">ยังไม่เคยสั่งเช่า</p>
            ) : (
              <ul className="-mx-2">
                {orders.slice(0, 8).map((o) => {
                  const badge = orderBadge(o)
                  const first = o.lines[0]
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/admin/orders?q=${o.orderNumber}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[#F7F6FA]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-sm font-bold text-[#263544]">{o.orderNumber}</span>
                          <span className="block truncate text-xs text-[#6B7280]">
                            {first ? first.productName : '—'}
                            {o.lines.length > 1 && ` +${o.lines.length - 1}`} · {formatDateTime(o.createdAt)}
                          </span>
                        </span>
                        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            {orders && orders.length > 8 && (
              <p className="mt-1 text-xs text-[#6B7280]">แสดง 8 จาก {orders.length} ออเดอร์ล่าสุด</p>
            )}
          </Section>

          <Section title="ประวัติการเปลี่ยนสิทธิ์">
            {!admin ? (
              <div className="h-12 animate-pulse rounded-xl bg-[#F5F4F8]" />
            ) : admin.log.length === 0 ? (
              <p className="text-sm text-[#6B7280]">ยังไม่เคยถูกระงับหรือแบล็กลิสต์</p>
            ) : (
              <ol className="space-y-3">
                {admin.log.map((l) => (
                  <li key={l.id} className="flex gap-3 text-sm">
                    <span className="mt-0.5">
                      <StatusBadge tone={ACTION_TONE[l.action]}>{ACCESS_ACTION_LABEL[l.action]}</StatusBadge>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[#263544]">{l.reason}</span>
                      <span className="block text-xs text-[#6B7280]">
                        {formatDateTime(l.at)} · โดย {nameOf(l.adminId)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </aside>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E4E3EA] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-[#263544]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, warn = false }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className="px-2 py-3">
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-[#B42318]' : 'text-[#263544]'}`}>{value}</p>
      <p className="text-xs text-[#6B7280]">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// สิทธิ์การใช้งาน
// ---------------------------------------------------------------------------

function AccessSection({
  member,
  isSelf,
  openOrders,
  disabled,
  onDone,
}: {
  member: Member
  isSelf: boolean
  openOrders: number
  disabled: boolean
  onDone: (message: string) => void
}) {
  const [action, setAction] = useState<AccessAction | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blacklisted = isBlacklisted(member)
  const suspended = isSuspended(member)
  const current = blacklisted
    ? { tone: 'problem' as Tone, label: 'แบล็กลิสต์', text: 'ห้ามเช่าถาวร จองชุดใหม่ไม่ได้' }
    : suspended
      ? { tone: 'closed' as Tone, label: 'ระงับการใช้งาน', text: 'จองชุดใหม่ไม่ได้ จนกว่าร้านจะเปิดใช้งานให้' }
      : { tone: 'done' as Tone, label: 'ใช้งานได้', text: 'จองชุดได้ตามปกติ' }

  // ปุ่มที่กดได้ตามสถานะตอนนี้
  const actions: AccessAction[] = blacklisted ? ['reactivate'] : suspended ? ['reactivate', 'blacklist'] : ['suspend', 'blacklist']

  function start(a: AccessAction) {
    setAction(a)
    setReason('')
    setError(null)
  }

  async function submit() {
    if (!action) return
    if (reason.trim().length < 3) return setError('กรุณาใส่เหตุผลอย่างน้อย 3 ตัวอักษร')
    setSaving(true)
    setError(null)
    const { error: err } = await setMemberAccess(member.id, action, reason.trim())
    setSaving(false)
    if (err) return setError(translateRpcError(err))
    setAction(null)
    onDone(`${ACCESS_ACTION_LABEL[action]}บัญชี ${member.email ?? ''} แล้ว`)
  }

  return (
    <section
      className={`rounded-2xl border bg-white ${blacklisted ? 'border-[#F5C2C0]' : suspended ? 'border-[#DADEE4]' : 'border-[#E4E3EA]'}`}
    >
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-[1_1_200px]">
          <p className="text-xs text-[#6B7280]">สิทธิ์การใช้งาน</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge tone={current.tone}>{current.label}</StatusBadge>
            <span className="text-sm text-[#5B6472]">{current.text}</span>
          </p>
        </div>
        {isSelf ? (
          <p className="text-xs text-[#6B7280]">บัญชีของคุณเอง เปลี่ยนสิทธิ์ไม่ได้</p>
        ) : (
          !action && (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={disabled}
                  onClick={() => start(a)}
                  className={
                    a === 'blacklist'
                      ? 'inline-flex items-center gap-1.5 rounded-full border border-[#B42318] bg-white px-4 py-2 text-sm font-medium text-[#B42318] transition hover:bg-[#FDE8E8] disabled:opacity-40'
                      : secondaryButtonClass
                  }
                >
                  {a === 'blacklist' ? <ProhibitIcon size={16} /> : a === 'suspend' ? <PauseCircleIcon size={16} /> : <CheckCircleIcon size={16} />}
                  {ACCESS_ACTION_LABEL[a]}
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {action && (
        <div className="space-y-3 border-t border-[#EEEDF2] bg-[#FAFAFC] p-4">
          <p className="text-sm font-semibold text-[#263544]">
            {ACCESS_ACTION_LABEL[action]} · <span className="font-normal text-[#5B6472]">{ACTION_HINT[action]}</span>
          </p>
          {action !== 'reactivate' && openOrders > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-[#FFF1D6] px-3 py-2 text-sm text-[#875200]">
              <WarningIcon size={18} weight="fill" className="mt-0.5 flex-none" />
              ลูกค้ามีออเดอร์ที่ยังไม่จบ {openOrders} ออเดอร์ ระบบไม่ยกเลิกให้ ตามจัดการเองในหน้าออเดอร์
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REASONS[action].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  reason === r ? 'border-[#263544] bg-[#263544] text-white' : 'border-[#D5D9E0] bg-white text-[#263544]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="เหตุผล (แอดมินคนอื่นจะเห็นในประวัติ)"
            aria-label="เหตุผล"
            className="w-full rounded-xl border border-[#D5D9E0] bg-white px-3 py-2 text-sm outline-none focus:border-[#263544]"
          />
          {error && <p role="alert" className="rounded-lg bg-[#FDE8E8] px-3 py-2 text-sm text-[#B42318]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAction(null)} disabled={saving} className={secondaryButtonClass}>
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || reason.trim().length < 3}
              className={
                action === 'blacklist'
                  ? 'rounded-full bg-[#B42318] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40'
                  : primaryButtonClass
              }
            >
              {saving ? 'กำลังบันทึก…' : `ยืนยัน${ACCESS_ACTION_LABEL[action]}`}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// โน้ตภายในร้าน (ลูกค้ามองไม่เห็น)
// ---------------------------------------------------------------------------

function NoteSection({
  userId,
  note,
  loading,
  disabled,
  nameOf,
  onSaved,
}: {
  userId: string
  note: MemberNote | null
  loading: boolean
  disabled: boolean
  nameOf: (userId: string | null) => string
  onSaved: () => void
}) {
  const [text, setText] = useState(note?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = text.trim() !== (note?.note ?? '')

  async function save() {
    setSaving(true)
    setError(null)
    const { error: err } = await setMemberNote(userId, text)
    setSaving(false)
    if (err) return setError(translateRpcError(err))
    onSaved()
  }

  return (
    <Section
      title="โน้ตภายในร้าน"
      action={<span className="text-xs text-[#6B7280]">ลูกค้ามองไม่เห็น</span>}
    >
      {loading ? (
        <div className="h-20 animate-pulse rounded-xl bg-[#F5F4F8]" />
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            maxLength={2000}
            rows={3}
            placeholder="เช่น คืนช้า 2 ครั้ง ทักไลน์ตอบช้า · ชอบเช่าชุดไซส์ L"
            aria-label="โน้ตภายในร้าน"
            className="w-full resize-y rounded-xl border border-[#D5D9E0] px-3 py-2 text-sm outline-none focus:border-[#263544] disabled:bg-[#F5F4F8]"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#6B7280]">
              {note ? `แก้ล่าสุด ${formatDateTime(note.updatedAt)} · โดย ${nameOf(note.updatedBy)}` : 'ยังไม่มีโน้ต'}
            </p>
            <button type="button" onClick={save} disabled={disabled || saving || !changed} className={secondaryButtonClass}>
              {saving ? 'กำลังบันทึก…' : text.trim() === '' && note ? 'ลบโน้ต' : 'บันทึกโน้ต'}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 rounded-lg bg-[#FDE8E8] px-3 py-2 text-sm text-[#B42318]">{error}</p>}
        </>
      )}
    </Section>
  )
}
