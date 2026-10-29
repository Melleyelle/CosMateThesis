'use client'

import { useCallback, useEffect, useState } from 'react'
import SectionCard from './Sectioncard'
import { StatusBadge } from '../ui'
import { createClient } from '@/utils/client'
import type { Tone } from '@/utils/admin/statusTone'
import { compareSize } from '@/utils/customer/labels'
import { formatThaiDateWithWeekday, todayISO } from '@/utils/dateUtils'
import { PHASE_LABEL, type PricePhase } from '@/utils/rentalTiers'

// สภาพชุดจริงรายตัว — บันทึกทันทีที่เปลี่ยน (แยกจากปุ่ม "บันทึกการแก้ไข" ของฟอร์ม)
// เพราะเป็นงานประจำวันหลังตรวจสภาพชุดคืน ไม่ใช่การแก้ข้อมูลสินค้า

type Condition = 'available' | 'cleaning' | 'damaged' | 'retired'

const CONDITIONS: { value: Condition; label: string; tone: Tone; hint: string }[] = [
  { value: 'available', label: 'พร้อมเช่า', tone: 'done', hint: 'ระบบจัดสรรให้ลูกค้าได้' },
  { value: 'cleaning', label: 'กำลังซัก', tone: 'progress', hint: 'คิวเดิมยังอยู่ แต่รับจองใหม่ไม่ได้จนกว่าจะเปลี่ยนกลับ' },
  { value: 'damaged', label: 'ซ่อม', tone: 'problem', hint: 'คิวที่ยังไม่ส่งสลับไปตัวสำรองของชุดนี้ ถ้าไม่มีจะยกเลิกและคืนเงิน' },
  { value: 'retired', label: 'ปลดระวาง', tone: 'closed', hint: 'เลิกใช้ถาวร คิวที่ยังไม่ส่งจัดการแบบเดียวกับซ่อม' },
]
const BY_VALUE = Object.fromEntries(CONDITIONS.map((c) => [c.value, c])) as Record<Condition, (typeof CONDITIONS)[number]>

const UNSHIPPED = ['pending_payment', 'manual_review', 'paid']

type Booking = { orderNumber: string; status: string; startDate: string; endDate: string }
// สถิติรายตัว (Step 21): เช่าสำเร็จกี่รอบ ค่าเช่าสะสม มัดจำรอบถัดไป — null = ยังไม่ได้รัน SQL
type UnitStats = { completed: number; income: number; phase: PricePhase | null; nextPrice: number | null; nextDeposit: number }
type Unit = { id: string; code: string; size: string; condition: Condition; bookings: Booking[]; stats: UnitStats | null }

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
  if (message.includes('Could not find the function')) return 'ยังไม่ได้รัน cosmate_step13_refunds_bank_accounts.sql'
  for (const [code, text] of Object.entries(ERROR_TEXT)) if (message.includes(code)) return text
  return message
}

// ดึงชุดจริงทุกตัวของชุดนี้ พร้อมคิวจองที่ยังไม่จบ (ไม่แตะ state — ให้ผู้เรียกเอาผลไปใส่เอง)
async function fetchUnits(productId: string, today: string): Promise<{ units: Unit[] } | { error: string } | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('product_variants')
    .select(
      'size, product_items ( id, item_code, condition_status, order_items ( start_date, end_date, is_blocking, orders ( order_number, status ) ) )',
    )
    .eq('product_id', productId)

  if (error) return { error: error.message }

  const { data: statRows } = await supabase.rpc('admin_unit_rental_stats', { p_product_id: productId })
  // phase / next_price มีหลังรัน Step 25
  type StatRow = {
    item_id: string
    completed_rentals: number
    rental_income: number | string
    phase?: PricePhase | null
    next_price?: number | string | null
    next_deposit: number | string
  }
  const statsById = new Map<string, UnitStats>(
    ((statRows ?? []) as StatRow[]).map((r) => [
      r.item_id,
      {
        completed: r.completed_rentals,
        income: Number(r.rental_income),
        phase: r.phase ?? null,
        nextPrice: r.next_price == null ? null : Number(r.next_price),
        nextDeposit: Number(r.next_deposit),
      },
    ]),
  )

  const units: Unit[] = ((data ?? []) as unknown as Row[])
    .flatMap((v) =>
      (v.product_items ?? []).map((pi) => ({
        id: pi.id,
        code: pi.item_code,
        size: v.size,
        condition: pi.condition_status,
        stats: statsById.get(pi.id) ?? null,
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
  return { units }
}

export default function ItemConditionCard({
  productId,
  refreshKey = 0,
  costPrice = null,
}: {
  productId: string
  refreshKey?: number
  costPrice?: number | null // ต้นทุนชุด ใช้บอกว่าตัวไหนคืนทุนแล้ว
}) {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const today = todayISO()

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchUnits>>) => {
    if (!res) return
    if ('error' in res) setNotice({ tone: 'error', text: res.error })
    else setUnits(res.units)
    setLoading(false)
  }, [])

  const load = useCallback(async () => apply(await fetchUnits(productId, today)), [apply, productId, today])

  useEffect(() => {
    let cancelled = false
    fetchUnits(productId, today).then((res) => {
      if (!cancelled) apply(res)
    })
    return () => {
      cancelled = true
    }
  }, [apply, productId, today, refreshKey])

  async function change(unit: Unit, next: Condition) {
    if (next === unit.condition) return
    const unshipped = unit.bookings.filter((b) => UNSHIPPED.includes(b.status))
    if ((next === 'damaged' || next === 'retired') && unshipped.length > 0) {
      const ok = confirm(
        `${unit.code} มีคิวที่ยังไม่ได้จัดส่ง ${unshipped.length} รายการ\n\n` +
          `• ถ้ามีตัวสำรองของชุดนี้ ไซส์ ${unit.size} ว่างช่วงเดียวกัน ระบบจะสลับให้ (ลูกค้าได้ชุดเดิม)\n` +
          `• ถ้าไม่มี ระบบจะยกเลิกออเดอร์นั้น ถ้าลูกค้าจ่ายแล้วจะตั้งเป็น "รอคืนเงิน" ที่หน้าออเดอร์\n\nดำเนินการต่อ?`,
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

    const result = data as {
      moves?: { order_number: string; to: string }[]
      cancelled?: { order_number: string; refund: number }[]
    }
    const moves = result.moves ?? []
    const cancelled = result.cancelled ?? []
    const refundTotal = cancelled.reduce((s, c) => s + Number(c.refund), 0)
    setNotice({
      tone: cancelled.length ? 'error' : 'ok',
      text:
        `${unit.code} เปลี่ยนเป็น "${BY_VALUE[next].label}" แล้ว` +
        (moves.length ? ` · สลับคิว ${moves.map((m) => `${m.order_number} → ${m.to}`).join(', ')}` : '') +
        (cancelled.length
          ? ` · ยกเลิก ${cancelled.map((c) => c.order_number).join(', ')}` +
            (refundTotal > 0 ? ` (ต้องโอนคืนรวม ฿${refundTotal.toLocaleString('th-TH')} ที่หน้าออเดอร์ แท็บ "รอคืนเงิน")` : '')
          : '') +
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
                  {u.stats && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums text-gray-500">
                      เช่าสำเร็จ {u.stats.completed} รอบ ·{' '}
                      {u.stats.phase && u.stats.nextPrice != null
                        ? `${PHASE_LABEL[u.stats.phase]} ค่าเช่า ฿${u.stats.nextPrice.toLocaleString('th-TH')} · `
                        : ''}
                      มัดจำรอบถัดไป ฿{u.stats.nextDeposit.toLocaleString('th-TH')}
                      {costPrice != null && costPrice > 0 && (
                        <>
                          {' '}
                          · ค่าเช่าสะสม ฿{u.stats.income.toLocaleString('th-TH')} / ทุน ฿{costPrice.toLocaleString('th-TH')}
                          {u.stats.income >= costPrice && <StatusBadge tone="done">คืนทุนแล้ว</StatusBadge>}
                        </>
                      )}
                    </p>
                  )}
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
