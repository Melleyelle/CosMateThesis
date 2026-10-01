'use client'

import { useCallback, useEffect, useState } from 'react'
import SectionCard from './Sectioncard'
import { StatusBadge } from '../ui'
import { createClient } from '@/utils/client'
import type { Tone } from '@/utils/admin/statusTone'
import { compareSize } from '@/utils/customer/labels'
import { formatThaiDateWithWeekday, todayISO } from '@/utils/dateUtils'

// สภาพชุดจริงรายตัว — บันทึกทันทีที่เปลี่ยน (แยกจากปุ่ม "บันทึกการแก้ไข" ของฟอร์ม)
// เพราะเป็นงานประจำวันหลังตรวจสภาพชุดคืน ไม่ใช่การแก้ข้อมูลสินค้า

type Condition = 'available' | 'cleaning' | 'damaged' | 'retired'

const CONDITIONS: { value: Condition; label: string; tone: Tone; hint: string }[] = [
  { value: 'available', label: 'พร้อมเช่า', tone: 'done', hint: 'ระบบจัดสรรให้ลูกค้าได้' },
  { value: 'cleaning', label: 'กำลังซัก', tone: 'progress', hint: 'คิวเดิมยังอยู่ แต่รับจองใหม่ไม่ได้จนกว่าจะเปลี่ยนกลับ' },
  { value: 'damaged', label: 'ซ่อม', tone: 'problem', hint: 'ย้ายคิวที่ยังไม่ส่งไปตัวอื่นให้อัตโนมัติ' },
  { value: 'retired', label: 'ปลดระวาง', tone: 'closed', hint: 'เลิกใช้ถาวร ย้ายคิวที่ยังไม่ส่งไปตัวอื่นให้อัตโนมัติ' },
]
const BY_VALUE = Object.fromEntries(CONDITIONS.map((c) => [c.value, c])) as Record<Condition, (typeof CONDITIONS)[number]>

const UNSHIPPED = ['pending_payment', 'manual_review', 'paid']

type Booking = { orderNumber: string; status: string; startDate: string; endDate: string }
type Unit = { id: string; code: string; size: string; condition: Condition; bookings: Booking[] }

type Row = {
  size: string
  product_items:
    | {
        id: string
        item_code: string
        condition_status: Condition
        order_items:
          | { start_date: string; end_date: string; is_blocking: boolean; orders: { order_number: string; status: string } | null }[]
          | null
      }[]
    | null
}

const ERROR_TEXT: Record<string, string> = {
  NOT_ADMIN: 'บัญชีนี้ไม่มีสิทธิ์แอดมิน',
  ITEM_NOT_FOUND: 'ไม่พบชุดตัวนี้ อาจถูกลบไปแล้ว ลองรีเฟรชหน้า',
  INVALID_CONDITION: 'สภาพที่เลือกไม่ถูกต้อง',
}

function translate(message: string) {
  const stuck = message.match(/ITEM_HAS_BOOKINGS:([\w,]+)/)
  if (stuck) {
    return `เปลี่ยนไม่ได้ เพราะคิว ${stuck[1].split(',').join(', ')} ย้ายไปตัวอื่นไม่ได้ (ไม่มีตัวไซส์เดียวกันที่ว่างช่วงนั้น) ติดต่อลูกค้าหรือยกเลิกออเดอร์ก่อน`
  }
  if (message.includes('Could not find the function')) return 'ยังไม่ได้รัน cosmate_step12_item_condition.sql'
  for (const [code, text] of Object.entries(ERROR_TEXT)) if (message.includes(code)) return text
  return message
}

export default function ItemConditionCard({ productId, refreshKey = 0 }: { productId: string; refreshKey?: number }) {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const today = todayISO()

  const load = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return
    const { data, error } = await supabase
      .from('product_variants')
      .select(
        'size, product_items ( id, item_code, condition_status, order_items ( start_date, end_date, is_blocking, orders ( order_number, status ) ) )',
      )
      .eq('product_id', productId)

    if (error) {
      setNotice({ tone: 'error', text: error.message })
      setLoading(false)
      return
    }

    const list: Unit[] = ((data ?? []) as unknown as Row[])
      .flatMap((v) =>
        (v.product_items ?? []).map((pi) => ({
          id: pi.id,
          code: pi.item_code,
          size: v.size,
          condition: pi.condition_status,
          bookings: (pi.order_items ?? [])
            .filter((oi) => oi.is_blocking && oi.end_date >= today && oi.orders)
            .map((oi) => ({
              orderNumber: oi.orders!.order_number,
              status: oi.orders!.status,
              startDate: oi.start_date,
              endDate: oi.end_date,
            }))
            .sort((a, b) => a.startDate.localeCompare(b.startDate)),
        })),
      )
      .sort((a, b) => compareSize(a.size, b.size) || a.code.localeCompare(b.code))

    setUnits(list)
    setLoading(false)
  }, [productId, today])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  async function change(unit: Unit, next: Condition) {
    if (next === unit.condition) return
    const unshipped = unit.bookings.filter((b) => UNSHIPPED.includes(b.status))
    if ((next === 'damaged' || next === 'retired') && unshipped.length > 0) {
      const ok = confirm(
        `${unit.code} มีคิวที่ยังไม่ได้จัดส่ง ${unshipped.length} รายการ\nระบบจะย้ายไปตัวอื่นไซส์ ${unit.size} ที่ว่างให้อัตโนมัติ ดำเนินการต่อ?`,
      )
      if (!ok) return
    }

    const supabase = createClient()
    if (!supabase) return
    setSavingId(unit.id)
    setNotice(null)
    const { data, error } = await supabase.rpc('admin_set_item_condition', { p_item_id: unit.id, p_condition: next })
    setSavingId(null)

    if (error) {
      setNotice({ tone: 'error', text: translate(error.message) })
      return
    }

    const result = data as { moves?: { order_number: string; to: string }[] }
    const moves = result.moves ?? []
    setNotice({
      tone: 'ok',
      text:
        `${unit.code} เปลี่ยนเป็น "${BY_VALUE[next].label}" แล้ว` +
        (moves.length ? ` · ย้ายคิว ${moves.map((m) => `${m.order_number} → ${m.to}`).join(', ')}` : '') +
        (next === 'cleaning' ? ' · ซักเสร็จอย่าลืมเปลี่ยนกลับเป็น "พร้อมเช่า"' : ''),
    })
    await load()
  }

  const notReady = units.filter((u) => u.condition !== 'available').length

  return (
    <SectionCard
      title="สภาพชุดแต่ละตัว"
      subtitle="เปลี่ยนแล้วบันทึกทันที ใช้หลังตรวจสภาพชุดที่ลูกค้าส่งคืน"
      action={
        units.length > 0 ? (
          <StatusBadge tone={notReady ? 'action' : 'done'}>
            {notReady ? `ไม่พร้อม ${notReady} ตัว` : 'พร้อมเช่าทุกตัว'}
          </StatusBadge>
        ) : undefined
      }
    >
      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${
            notice.tone === 'error' ? 'bg-[#FDE8E8] text-[#B42318]' : 'bg-[#E3F5EA] text-[#1B6E45]'
          }`}
        >
          {notice.text}
        </p>
      )}

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      ) : units.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          ยังไม่มีชุดจริงที่บันทึกไว้ ตัวที่เพิ่งเพิ่มในส่วนไซส์จะแสดงที่นี่หลังกด &quot;บันทึกการแก้ไข&quot;
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {units.map((u) => {
            const next = u.bookings[0]
            const meta = BY_VALUE[u.condition] ?? BY_VALUE.available
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold tabular-nums text-[#263544]">
                    {u.code}
                    <span className="rounded-md bg-[#EDE6FA] px-1.5 text-[11px] font-semibold text-[#263544]">{u.size}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {next
                      ? `คิวถัดไป: ใช้งาน ${formatThaiDateWithWeekday(next.startDate)} (${next.orderNumber})` +
                        (u.bookings.length > 1 ? ` และอีก ${u.bookings.length - 1} คิว` : '')
                      : 'ไม่มีคิวจอง'}
                  </p>
                </div>

                <label className="flex items-center gap-2">
                  <span className="sr-only">สภาพของ {u.code}</span>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  <select
                    value=""
                    disabled={savingId === u.id}
                    onChange={(e) => e.target.value && change(u, e.target.value as Condition)}
                    title={meta.hint}
                    className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-[#263544] outline-none focus:border-[#263544] focus:ring-2 focus:ring-[#263544]/10 disabled:opacity-50"
                  >
                    <option value="">{savingId === u.id ? 'กำลังบันทึก…' : 'เปลี่ยนสภาพ…'}</option>
                    {CONDITIONS.filter((c) => c.value !== u.condition).map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <dl className="mt-4 grid gap-x-4 gap-y-1.5 text-xs text-gray-500 sm:grid-cols-2">
        {CONDITIONS.map((c) => (
          <div key={c.value} className="flex gap-2">
            <dt className="w-16 flex-shrink-0 font-medium text-[#263544]">{c.label}</dt>
            <dd>{c.hint}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
