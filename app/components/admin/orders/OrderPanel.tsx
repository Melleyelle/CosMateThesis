'use client'
/* eslint-disable @next/next/no-img-element */

// แผงขวาของหน้าออเดอร์ (คิวงาน): แสดงเฉพาะฟอร์มของงานที่ออเดอร์นี้ต้องทำ
// ทำเสร็จแล้วเรียก onDone → หน้ารายการเลื่อนไปออเดอร์ถัดไปในคิวเดียวกันเอง

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BankIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  CameraIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  CopyIcon,
  ImageIcon,
  MapPinIcon,
  MinusCircleIcon,
  PhoneIcon,
  ProhibitIcon,
  ReceiptIcon,
  TShirtIcon,
  WarningCircleIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react'
import { StatusBadge, primaryButtonClass, secondaryButtonClass } from '@/app/components/admin/ui'
import WebcamCapture from '@/app/components/admin/orders/WebcamCapture'
import type { OrderSummary } from '@/utils/customer/fetchOrders'
import type { BookingSettings } from '@/utils/customer/bookingSettings'
import { ADMIN_STATUS_LABEL, orderBadge } from '@/utils/admin/statusTone'
import { ORDER_STATUS_LABEL } from '@/utils/orderStatus'
import { translateRpcError } from '@/utils/bookingErrors'
import { formatBaht, formatDateTime, formatThaiDateWithWeekday } from '@/utils/dateUtils'
import { SHIP_CARRIER, normalizeTracking, trackingProblem } from '@/utils/tracking'
import {
  ACTOR_LABEL,
  DEDUCTION_LABEL,
  fetchOrderDetail,
  fetchPackChecklist,
  fullAddress,
  lateDays,
  markRefund,
  receiveAndInspect,
  returnByDate,
  setOrderStatus,
  shipOrder,
  taskOf,
  uploadEvidence,
  type DeductionInput,
  type OrderDetail,
} from '@/utils/admin/orderOps'

type PanelProps = {
  order: OrderSummary
  settings: BookingSettings
  today: string
  position: string
  onDone: (message: string) => void
}

export default function OrderPanel({ order, settings, today, position, onDone }: PanelProps) {
  // เก็บรายละเอียดคู่กับออเดอร์ที่โหลดมา: เปลี่ยนออเดอร์หรือออเดอร์ถูกอัปเดต → key ไม่ตรง = ยังไม่มีข้อมูล (แสดงกำลังโหลด)
  const detailKey = `${order.id}:${order.updatedAt}`
  const [loaded, setLoaded] = useState<{ key: string; detail: OrderDetail } | null>(null)
  const detail = loaded?.key === detailKey ? loaded.detail : null
  const task = taskOf(order, today)
  const badge = orderBadge(order)

  useEffect(() => {
    let alive = true
    fetchOrderDetail(order.id).then((d) => alive && setLoaded({ key: detailKey, detail: d }))
    return () => {
      alive = false
    }
  }, [order.id, detailKey])

  return (
    <section aria-label={`จัดการออเดอร์ ${order.orderNumber}`} className="overflow-hidden rounded-card border border-line bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle bg-brand-subtle px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-lg font-bold text-ink">{order.orderNumber}</h2>
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </div>
          <p className="mt-0.5 text-sm text-secondary">
            {order.shipName} · {order.shipPhone} · สั่งเมื่อ {formatDateTime(order.createdAt)}
          </p>
        </div>
        {position && <span className="text-xs text-muted">{position}</span>}
      </header>

      {task === 'pack' && <PackForm key={order.id} order={order} onDone={onDone} />}
      {task === 'slip' && <SlipReview key={order.id} order={order} detail={detail} onDone={onDone} />}
      {(task === 'inspect' || task === 'lost') && (
        <InspectForm key={order.id} order={order} detail={detail} settings={settings} today={today} lostOnly={task === 'lost'} onDone={onDone} />
      )}
      {task === 'refund' && <RefundForm key={order.id} order={order} detail={detail} onDone={onDone} />}
      {task === 'view' && <WaitingNote order={order} today={today} />}

      <OrderDetails order={order} detail={detail} openByDefault={task === 'view'} />
    </section>
  )
}

// ---------------------------------------------------------------------------
// ชิ้นส่วนร่วม
// ---------------------------------------------------------------------------

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[15px] font-semibold text-ink">
        <span className="text-brand-strong">{n}.</span> {title}
        {hint && <span className="ml-2 text-sm font-normal text-secondary">{hint}</span>}
      </h3>
      {children}
    </div>
  )
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-control border border-[#F5C2C0] bg-danger-subtle px-3 py-2 text-sm font-medium text-danger">
      {children}
    </p>
  )
}

function Footer({ hint, children }: { hint: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle bg-canvas px-5 py-4">
      <p className="text-sm text-secondary">{hint}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
    } catch {
      /* เบราว์เซอร์ไม่อนุญาต: ผู้ใช้คัดลอกเองได้จากข้อความ */
    }
  }
  return { copied, copy }
}

function AddressCard({ order }: { order: OrderSummary }) {
  const { copied, copy } = useCopy()
  const address = fullAddress(order)
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-control border border-line px-4 py-3">
      <div className="min-w-0 flex-[1_1_260px]">
        <p className="text-xs text-muted">ที่อยู่จัดส่ง (จ่าหน้ากล่อง)</p>
        <p className="font-bold text-ink">
          {order.shipName} · {order.shipPhone}
        </p>
        <p className="text-[15px] text-ink">{address}</p>
        {order.customerNote && (
          <p className="mt-2 rounded-control bg-warning-subtle px-3 py-1.5 text-sm text-warning">หมายเหตุจากลูกค้า: {order.customerNote}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => copy('addr', `${order.shipName} ${order.shipPhone}\n${address}`)}
        className={`${secondaryButtonClass} whitespace-nowrap`}
      >
        {copied === 'addr' ? <CheckIcon size={16} weight="bold" /> : <CopyIcon size={16} />}
        {copied === 'addr' ? 'คัดลอกแล้ว' : 'คัดลอกที่อยู่'}
      </button>
    </div>
  )
}

// เลือกไฟล์ หรือถ่ายจากเว็บแคม → ย่อ → อัปโหลดทันที (กดยืนยันจะได้ไม่ต้องรออัปโหลด)
function PhotoPicker({
  orderId,
  stage,
  paths,
  onChange,
  max = 6,
}: {
  orderId: string
  stage: 'pack' | 'return'
  paths: string[]
  onChange: (paths: string[]) => void
  max?: number
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [camera, setCamera] = useState(false)
  const urlsRef = useRef<string[]>([])
  // กดถ่ายจากกล้องรัวได้เร็วกว่าอัปโหลดเสร็จ → ต่อคิวทีละชุด และอ่าน paths ล่าสุดจาก ref ไม่ให้รูปทับกันหาย
  const pathsRef = useRef(paths)
  const queueRef = useRef(Promise.resolve())
  const busy = pending > 0
  const remaining = max - paths.length - pending

  useEffect(() => {
    pathsRef.current = paths
  }, [paths])
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), [])

  function add(input: FileList | File[] | null) {
    const files = Array.from(input ?? []).slice(0, Math.max(0, remaining))
    if (!files.length) return
    setError(null)
    setPending((n) => n + files.length)
    queueRef.current = queueRef.current.then(async () => {
      for (const file of files) {
        const { path, error: err } = await uploadEvidence(orderId, stage, file)
        setPending((n) => n - 1)
        if (err || !path) {
          setError(err)
          continue
        }
        const url = URL.createObjectURL(file)
        urlsRef.current.push(url)
        setPreviews((p) => ({ ...p, [path]: url }))
        pathsRef.current = [...pathsRef.current, path]
        onChange(pathsRef.current)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 empty:hidden">
        {paths.map((p, i) => (
          <div key={p} className="relative h-24 w-24 overflow-hidden rounded-control border border-line-subtle bg-sunken">
            {previews[p] && <img src={previews[p]} alt={`รูปที่ ${i + 1}`} className="h-full w-full object-cover" />}
            <button
              type="button"
              onClick={() => onChange(paths.filter((x) => x !== p))}
              aria-label={`เอารูปที่ ${i + 1} ออก`}
              className="absolute right-1 top-1 rounded-full border border-line bg-white p-1 text-ink"
            >
              <XIcon size={12} weight="bold" />
            </button>
          </div>
        ))}
        {busy && (
          <div className="flex h-24 w-24 items-center justify-center rounded-control border border-line-subtle bg-sunken text-center text-xs text-secondary">
            กำลังอัปโหลด {pending} รูป…
          </div>
        )}
      </div>
      {remaining > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setCamera(true)} className={secondaryButtonClass}>
            <CameraIcon size={18} className="text-brand-strong" />
            ถ่ายจากกล้อง
          </button>
          <label className={`${secondaryButtonClass} cursor-pointer focus-within:ring-[3px] focus-within:ring-brand/25`}>
            <ImageIcon size={18} className="text-brand-strong" />
            เลือกไฟล์รูป
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                add(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          {paths.length > 0 && <span className="text-xs text-muted">เพิ่มได้อีก {remaining} รูป</span>}
        </div>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      {camera && <WebcamCapture remaining={remaining} busy={busy} onCapture={(f) => add([f])} onClose={() => setCamera(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// paid → ส่งของ
// ---------------------------------------------------------------------------

function PackForm({ order, onDone }: { order: OrderSummary; onDone: PanelProps['onDone'] }) {
  const [items, setItems] = useState<string[] | null>(null)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [photos, setPhotos] = useState<string[]>([])
  const [tracking, setTracking] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPackChecklist(order).then(setItems)
  }, [order])

  const total = items?.length ?? 0
  const done = Object.values(checked).filter(Boolean).length
  const receiveBy = order.lines.map((l) => l.startDate).sort()[0]
  const missing: string[] = []
  if (!items || done < total) missing.push(`ติ๊กเช็กลิสต์อีก ${Math.max(0, total - done)} รายการ`)
  if (photos.length === 0) missing.push('ถ่ายรูปแพ็กอย่างน้อย 1 รูป')
  if (trackingProblem(tracking)) missing.push('กรอกเลขพัสดุ')

  async function submit() {
    if (!items || missing.length) return
    setSaving(true)
    setError(null)
    const { error: err } = await shipOrder(order.id, normalizeTracking(tracking), items, photos)
    setSaving(false)
    if (err) return setError(translateRpcError(err))
    onDone(`ส่งของ ${order.orderNumber} แล้ว`)
  }

  async function cancel() {
    if (!confirm(`ยกเลิกออเดอร์ ${order.orderNumber}?\nลูกค้าจ่ายแล้ว ระบบจะตั้ง "รอคืนเงิน" ${formatBaht(order.grandTotal)}`)) return
    const { error: err } = await setOrderStatus(order.id, 'cancelled')
    if (err) return setError(translateRpcError(err))
    onDone(`ยกเลิก ${order.orderNumber} แล้ว`)
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-5">
        <AddressCard order={order} />

        <Step n={1} title="หยิบชุดจากชั้น" hint={receiveBy ? `ลูกค้าต้องได้รับ ${formatThaiDateWithWeekday(receiveBy)}` : undefined}>
          <ul className="flex flex-col gap-2">
            {order.lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line-subtle px-3 py-2.5">
                <span className="text-ink">
                  <span className="font-semibold">{l.productName}</span>
                  {l.size && <span className="text-secondary"> · ไซส์ {l.size}</span>}
                  {l.pieceNames && <span className="block text-sm text-warning">แยกชิ้น: {l.pieceNames.join(', ')}</span>}
                </span>
                {l.itemCode && (
                  <span className="whitespace-nowrap rounded-lg border border-dashed border-line px-3 py-1 font-mono text-[15px] font-bold text-ink">
                    {l.itemCode}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Step>

        <Step n={2} title="เช็กลิสต์ของในกล่อง" hint={items ? `${done} / ${total}` : 'กำลังโหลด…'}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(items ?? []).map((name, i) => (
              <label key={`${name}-${i}`} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-control border border-line-subtle px-3 hover:border-line">
                <input
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                  className="h-[18px] w-[18px] accent-brand-strong"
                />
                <span className="text-ink">{name}</span>
              </label>
            ))}
          </div>
        </Step>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Step n={3} title="รูปตอนแพ็ก" hint="ลูกค้าเห็นรูปนี้">
            <PhotoPicker orderId={order.id} stage="pack" paths={photos} onChange={setPhotos} />
          </Step>
          <Step n={4} title="เลขพัสดุ" hint={SHIP_CARRIER}>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="เช่น EF123456789TH"
              aria-label="เลขพัสดุ"
              autoCapitalize="characters"
              className="h-11 w-full rounded-control border border-line bg-white px-4 font-mono text-base uppercase text-ink outline-none placeholder:font-sans placeholder:normal-case placeholder:text-muted focus:ring-[3px] focus:ring-brand/25"
            />
            {tracking && trackingProblem(tracking) && <p className="text-sm text-danger">{trackingProblem(tracking)}</p>}
          </Step>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
      <Footer hint={missing.length ? <>ยังขาด: <b className="text-ink">{missing.join(' · ')}</b></> : 'ครบแล้ว ลูกค้าจะเห็นเลขพัสดุ รูป และเช็กลิสต์ทันที'}>
        <button type="button" onClick={cancel} className="rounded-full px-3 py-2 text-sm font-medium text-danger hover:bg-danger-subtle">
          ยกเลิกออเดอร์
        </button>
        <button type="button" onClick={submit} disabled={saving || missing.length > 0} className={primaryButtonClass}>
          {saving ? 'กำลังบันทึก…' : 'ยืนยันส่ง · ไปถัดไป'}
        </button>
      </Footer>
    </>
  )
}

// ---------------------------------------------------------------------------
// manual_review → ตรวจสลิปเอง
// ---------------------------------------------------------------------------

function SlipReview({ order, detail, onDone }: { order: OrderSummary; detail: OrderDetail | null; onDone: PanelProps['onDone'] }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ex = detail?.extras

  async function decide(to: 'paid' | 'pending_payment' | 'cancelled') {
    if (to === 'cancelled' && !confirm(`ยกเลิกออเดอร์ ${order.orderNumber}? ระบบจะตั้ง "รอคืนเงิน" ให้`)) return
    setSaving(true)
    setError(null)
    const { error: err } = await setOrderStatus(order.id, to)
    setSaving(false)
    if (err) return setError(translateRpcError(err))
    onDone(to === 'paid' ? `ยืนยันยอด ${order.orderNumber} แล้ว` : to === 'pending_payment' ? `ตีกลับ ${order.orderNumber} ให้ส่งสลิปใหม่` : `ยกเลิก ${order.orderNumber} แล้ว`)
  }

  const diff = ex?.slipAmount != null ? ex.slipAmount - order.grandTotal : null

  return (
    <>
      <div className="flex flex-wrap gap-5 p-5">
        <div className="w-[220px] flex-none">
          {detail === null ? (
            <div className="aspect-[3/4] animate-pulse rounded-control bg-sunken" />
          ) : detail.slipUrl ? (
            <a href={detail.slipUrl} target="_blank" rel="noreferrer" title="เปิดรูปเต็ม">
              <img src={detail.slipUrl} alt="สลิปการโอน" className="aspect-[3/4] w-full rounded-control border border-line-subtle object-contain bg-sunken" />
            </a>
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-control border border-dashed border-line-subtle p-4 text-center text-sm text-muted">
              ไม่มีรูปสลิป (ออเดอร์จากระบบชำระเงินจำลองเดิม)
            </div>
          )}
        </div>
        <div className="flex min-w-[240px] flex-1 flex-col gap-3 text-[15px]">
          {ex?.slipNote && (
            <p className="rounded-control border border-[#F2D49B] bg-warning-subtle px-3 py-2 font-semibold text-warning">
              ระบบส่งมาให้ดูเพราะ: {ex.slipNote}
            </p>
          )}
          <Row label="ยอดออเดอร์" value={formatBaht(order.grandTotal)} strong />
          <Row label="ยอดในสลิป" value={ex?.slipAmount != null ? formatBaht(ex.slipAmount) : '—'} strong />
          {diff != null && diff !== 0 && (
            <p className={`text-sm ${diff > 0 ? 'text-secondary' : 'text-danger'}`}>
              {diff > 0 ? `โอนเกิน ${formatBaht(diff)} ยืนยันได้ แล้วโอนส่วนเกินคืนพร้อมมัดจำ` : `โอนขาด ${formatBaht(-diff)} ควรตีกลับให้โอนเพิ่ม`}
            </p>
          )}
          {ex?.slipSubmittedAt && <Row label="ส่งสลิปเมื่อ" value={formatDateTime(ex.slipSubmittedAt)} />}
          {error && <ErrorBox>{error}</ErrorBox>}
        </div>
      </div>
      <Footer hint="ดูรูปสลิปให้ยอดและชื่อบัญชีร้านตรงก่อนยืนยัน">
        <button type="button" onClick={() => decide('cancelled')} disabled={saving} className="rounded-full px-3 py-2 text-sm font-medium text-danger hover:bg-danger-subtle">
          ยกเลิก
        </button>
        <button type="button" onClick={() => decide('pending_payment')} disabled={saving} className={secondaryButtonClass}>
          ตีกลับ ให้ส่งสลิปใหม่
        </button>
        <button type="button" onClick={() => decide('paid')} disabled={saving} className={primaryButtonClass}>
          ยืนยันยอด
        </button>
      </Footer>
    </>
  )
}

// ---------------------------------------------------------------------------
// returned → รับคืนและตรวจ (+ "สงสัยไม่คืน" ใช้ฟอร์มเดียวกันแบบสูญหายอย่างเดียว)
// ---------------------------------------------------------------------------

type DedKey = 'damage' | 'missing_part' | 'special_cleaning' | 'lost'
const DED_ROWS: { key: DedKey; label: string; hint: string; placeholder: string; amount: number }[] = [
  { key: 'damage', label: 'ชำรุด', hint: 'ขาด เปื้อนถาวร อุปกรณ์หัก', placeholder: 'เช่น แขนเสื้อขาดตรงตะเข็บ', amount: 150 },
  { key: 'missing_part', label: 'ของไม่ครบ', hint: 'เติมจากเช็กลิสต์ด้านบนให้เอง', placeholder: 'ชิ้นที่ไม่ได้รับ', amount: 100 },
  { key: 'special_cleaning', label: 'ซักพิเศษ', hint: 'คราบเมคอัพ สีย้อมผม กลิ่น', placeholder: 'เช่น คราบรองพื้นที่คอเสื้อ', amount: 80 },
  { key: 'lost', label: 'สูญหาย / ไม่คืนชุด', hint: 'ริบมัดจำทั้งหมด · ใช้แทนข้ออื่น', placeholder: '', amount: 0 },
]

function InspectForm({
  order,
  detail,
  settings,
  today,
  lostOnly,
  onDone,
}: {
  order: OrderSummary
  detail: OrderDetail | null
  settings: BookingSettings
  today: string
  lostOnly: boolean
  onDone: PanelProps['onDone']
}) {
  const packing = detail?.evidence.find((e) => e.stage === 'packing')
  const [fallbackList, setFallbackList] = useState<string[] | null>(null)
  const [received, setReceived] = useState<Record<string, boolean>>({})
  const [photos, setPhotos] = useState<string[]>([])
  const [on, setOn] = useState<Record<DedKey, boolean>>({ damage: false, missing_part: false, special_cleaning: false, lost: lostOnly })
  const [amount, setAmount] = useState<Record<DedKey, string>>({ damage: '150', missing_part: '100', special_cleaning: '80', lost: '0' })
  const [note, setNote] = useState<Record<DedKey, string>>({ damage: '', missing_part: '', special_cleaning: '', lost: lostOnly ? 'ไม่ได้รับชุดคืน' : '' })
  const [itemOf, setItemOf] = useState<Record<DedKey, string>>({ damage: '', missing_part: '', special_cleaning: '', lost: '' })
  const [waiveLate, setWaiveLate] = useState(false)
  const [severity, setSeverity] = useState<'minor' | 'major'>('minor')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ออเดอร์ก่อน Step 16 ไม่มีรูป/เช็กลิสต์ตอนแพ็ก → ใช้ "สิ่งที่รวมในชุด" แทน
  useEffect(() => {
    if (detail && !packing) fetchPackChecklist(order).then(setFallbackList)
  }, [detail, packing, order])
  const checklist = useMemo(() => packing?.checklist.map((c) => c.name) ?? fallbackList ?? [], [packing, fallbackList])
  const isReceived = (name: string) => received[name] !== false

  function toggleReceived(name: string) {
    const next = { ...received, [name]: !isReceived(name) }
    setReceived(next)
    const missingNames = checklist.filter((n) => next[n] === false)
    setOn((o) => ({ ...o, missing_part: missingNames.length > 0 ? true : o.missing_part }))
    setNote((o) => ({ ...o, missing_part: missingNames.join(', ') }))
  }

  const deposit = order.depositTotal
  const late = lateDays(order, today)
  const lost = on.lost
  const lateFee = lost || waiveLate ? 0 : Math.min(late * settings.lateFeePerDay, deposit)
  const lines = DED_ROWS.filter((r) => r.key !== 'lost' && on[r.key] && !lost).map((r) => ({
    label: `${r.label}${note[r.key] ? ` · ${note[r.key]}` : ''}`,
    value: Number(amount[r.key] || 0),
  }))
  const total = lost ? deposit : lateFee + lines.reduce((s, l) => s + l.value, 0)
  const over = total > deposit
  const refund = Math.max(0, deposit - total)
  const broken = !lost && (on.damage || on.missing_part)
  const needPhoto = !lost && photos.length === 0
  const condition = lost ? 'ปลดระวาง · ลูกค้าถูกตั้งเป็น blacklist' : broken ? (severity === 'major' ? 'ชำรุดหนัก · ส่งซ่อม ปิดรับจอง' : 'ชำรุดเล็กน้อย · ซ่อมก่อนให้เช่าต่อ') : 'พร้อมเช่าต่อ'

  async function submit() {
    if (over || needPhoto) return
    if (lost && !confirm(`ยืนยันว่า ${order.orderNumber} สูญหาย/ไม่คืนชุด?\nริบมัดจำ ${formatBaht(deposit)} · ชุดถูกปลดระวาง · ลูกค้าถูกตั้งเป็น blacklist`)) return
    const deductions: DeductionInput[] = lost
      ? [{ type: 'lost', amount: 0, note: note.lost, orderItemId: itemOf.lost || null }]
      : DED_ROWS.filter((r) => r.key !== 'lost' && on[r.key]).map((r) => ({
          type: r.key,
          amount: Number(amount[r.key] || 0),
          note: note[r.key],
          orderItemId: itemOf[r.key] || null,
        }))
    setSaving(true)
    setError(null)
    const { error: err } = await receiveAndInspect({
      orderId: order.id,
      imagePaths: photos,
      checklist: checklist.map((name) => ({ name, checked: isReceived(name) })),
      deductions,
      waiveLate,
      severity,
    })
    setSaving(false)
    if (err) return setError(translateRpcError(err))
    onDone(`ตรวจคืน ${order.orderNumber} แล้ว · โอนคืน ${formatBaht(refund)}`)
  }

  const returnBy = returnByDate(order)

  return (
    <>
      <div className="flex flex-col gap-6 p-5">
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-control border border-line-subtle bg-canvas px-4 py-2.5 text-sm">
          {order.returnTrackingNo ? (
            <>
              <span>
                ลูกค้าส่งคืน <b>{order.returnSubmittedAt ? formatDateTime(order.returnSubmittedAt) : '—'}</b>
              </span>
              <span className="font-mono">
                {order.returnCarrier} · {order.returnTrackingNo}
              </span>
            </>
          ) : (
            <span className="font-semibold text-danger">ลูกค้ายังไม่ได้ส่งคืนและไม่ได้กรอกเลขพัสดุ</span>
          )}
          {returnBy && <span>ต้องคืนภายใน {formatThaiDateWithWeekday(returnBy)}</span>}
          <span className={late > 0 ? 'font-semibold text-danger' : 'text-success'}>{late > 0 ? `ช้า ${late} วัน` : 'คืนตรงเวลา'}</span>
        </div>

        {lostOnly ? (
          <div className="flex gap-3 rounded-control border border-[#F5C2C0] bg-danger-subtle px-4 py-3 text-sm text-danger">
            <WarningIcon size={20} className="flex-none" />
            <p>
              เลยกำหนดคืนเกิน 7 วันแล้ว ลองติดต่อลูกค้าที่ {order.shipPhone} ก่อน ถ้าติดต่อไม่ได้ ยืนยัน &quot;สูญหาย&quot; เพื่อริบมัดจำ
              ปลดระวางชุด และตั้งลูกค้าเป็น blacklist
            </p>
          </div>
        ) : (
          <>
            <Step n={1} title="เทียบรูปตอนแพ็กกับตอนเปิดกล่อง">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted">ตอนแพ็ก{packing ? ` · ${formatDateTime(packing.at)}` : ''}</p>
                  <div className="flex flex-wrap gap-2">
                    {packing?.urls.length ? (
                      packing.urls.map((u, i) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt={`รูปตอนแพ็ก ${i + 1}`} className="h-24 w-24 rounded-control border border-line-subtle object-cover" />
                        </a>
                      ))
                    ) : (
                      <p className="text-sm text-muted">{detail ? 'ไม่มีรูปตอนแพ็ก' : 'กำลังโหลด…'}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted">ตอนเปิดกล่อง · อย่างน้อย 1 รูป</p>
                  <PhotoPicker orderId={order.id} stage="return" paths={photos} onChange={setPhotos} />
                </div>
              </div>
            </Step>

            {checklist.length > 0 && (
              <Step n={2} title="เช็กลิสต์ตอนรับคืน" hint="เอาติ๊กออก = ไม่ได้รับ ระบบใส่ในรายการหักให้">
                <div className="grid gap-2 sm:grid-cols-3">
                  {checklist.map((name) => (
                    <label
                      key={name}
                      className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-control border px-3 text-sm ${
                        isReceived(name) ? 'border-line-subtle text-ink' : 'border-[#F5C2C0] bg-danger-subtle font-semibold text-danger'
                      }`}
                    >
                      <input type="checkbox" checked={isReceived(name)} onChange={() => toggleReceived(name)} className="h-4 w-4 accent-brand-strong" />
                      {name}
                      {!isReceived(name) && ' · ไม่ได้รับ'}
                    </label>
                  ))}
                </div>
              </Step>
            )}
          </>
        )}

        <Step n={lostOnly ? 1 : 3} title="รายการหักมัดจำ" hint={lostOnly ? undefined : 'เลือกได้หลายข้อ · ไม่เลือก = คืนเต็ม'}>
          <div className="flex flex-col gap-2">
            {!lostOnly && (
              <div className="flex flex-wrap items-center gap-3 rounded-control border border-line-subtle px-3 py-2.5">
                <label className={`flex flex-1 items-center gap-3 ${late === 0 || lost ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={late > 0 && !waiveLate && !lost}
                    disabled={late === 0 || lost}
                    onChange={() => setWaiveLate((w) => !w)}
                    className="h-[18px] w-[18px] accent-brand-strong"
                  />
                  <span className="font-semibold text-ink">คืนช้า</span>
                  <span className="text-xs text-muted">
                    {late > 0 ? `ระบบคิด ${late} วัน × ${formatBaht(settings.lateFeePerDay)} · เอาติ๊กออก = ยกเว้น` : 'คืนตรงเวลา'}
                  </span>
                </label>
                {late > 0 && !waiveLate && !lost && <span className="font-semibold text-ink">{formatBaht(lateFee)}</span>}
              </div>
            )}
            {DED_ROWS.filter((r) => !lostOnly || r.key === 'lost').map((r) => {
              const disabled = (lost && r.key !== 'lost') || (lostOnly && r.key === 'lost')
              const active = on[r.key] && !(lost && r.key !== 'lost')
              return (
                <div key={r.key} className="flex flex-col gap-2 rounded-control border border-line-subtle px-3 py-2.5">
                  <label className={`flex items-center gap-3 ${disabled && !lostOnly ? 'opacity-50' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={active}
                      disabled={disabled}
                      onChange={() => setOn((o) => ({ ...o, [r.key]: !o[r.key] }))}
                      className="h-[18px] w-[18px] accent-brand-strong"
                    />
                    <span className="font-semibold text-ink">{r.label}</span>
                    <span className="text-xs text-muted">{r.hint}</span>
                    {r.key === 'lost' && active && <span className="ml-auto font-semibold text-ink">{formatBaht(deposit)}</span>}
                  </label>
                  {active && r.key !== 'lost' && (
                    <div className="ml-7 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={amount[r.key]}
                        onChange={(e) => setAmount((a) => ({ ...a, [r.key]: e.target.value }))}
                        aria-label={`จำนวนเงิน ${r.label}`}
                        className="h-10 rounded-control border border-line px-3 text-ink outline-none focus:ring-[3px] focus:ring-brand/25"
                      />
                      <input
                        value={note[r.key]}
                        onChange={(e) => setNote((n) => ({ ...n, [r.key]: e.target.value }))}
                        placeholder={r.placeholder}
                        maxLength={300}
                        aria-label={`เหตุผล ${r.label} (ลูกค้าเห็น)`}
                        className="h-10 rounded-control border border-line px-3 text-ink outline-none placeholder:text-muted focus:ring-[3px] focus:ring-brand/25"
                      />
                      {order.lines.length > 1 && (
                        <ItemSelect order={order} value={itemOf[r.key]} onChange={(v) => setItemOf((m) => ({ ...m, [r.key]: v }))} />
                      )}
                    </div>
                  )}
                  {active && r.key === 'lost' && order.lines.length > 1 && (
                    <div className="ml-7">
                      <ItemSelect order={order} value={itemOf.lost} onChange={(v) => setItemOf((m) => ({ ...m, lost: v }))} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Step>

        {broken && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-semibold text-ink">ความเสียหายของชุด</legend>
            <div className="flex flex-wrap gap-2">
              {(['minor', 'major'] as const).map((s) => (
                <label key={s} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-line-subtle px-4 text-sm hover:border-line">
                  <input type="radio" name={`sev-${order.id}`} checked={severity === s} onChange={() => setSeverity(s)} className="accent-brand-strong" />
                  {s === 'minor' ? 'เล็กน้อย · ซ่อมแล้วให้เช่าต่อ' : 'หนัก · ต้องส่งซ่อมนาน'}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-col gap-1.5 rounded-card border border-line bg-canvas px-4 py-3.5 text-[15px]">
          <p className="mb-1 text-xs text-muted">ใบสรุปมัดจำ · ลูกค้าเห็นแบบนี้</p>
          <Row label="มัดจำ" value={formatBaht(deposit)} strong />
          {lost ? (
            <Row label="− สูญหาย / ไม่คืนชุด" value={formatBaht(deposit)} />
          ) : (
            <>
              {lateFee > 0 && <Row label={`− คืนช้า ${late} วัน`} value={formatBaht(lateFee)} />}
              {lines.map((l) => (
                <Row key={l.label} label={`− ${l.label}`} value={formatBaht(l.value)} />
              ))}
            </>
          )}
          <div className="mt-1 flex justify-between border-t border-dashed border-line-subtle pt-2 text-lg font-bold">
            <span>โอนคืนลูกค้า</span>
            <span className="text-brand-strong">{formatBaht(refund)}</span>
          </div>
          {over && <ErrorBox>ยอดหักรวม {formatBaht(total)} เกินมัดจำ ลดยอดลง หรือเลือก &quot;สูญหาย&quot; ถ้าจะริบมัดจำทั้งหมด</ErrorBox>}
          <p className="mt-1 text-sm text-secondary">
            สภาพชุดหลังตรวจ: <b className="text-ink">{condition}</b>
          </p>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
      <Footer hint={needPhoto ? <>ยังขาด: <b className="text-ink">ถ่ายรูปตอนเปิดกล่อง</b></> : 'ออเดอร์จะปิดเป็นเสร็จสิ้น ลูกค้ารีวิวได้ และขึ้นคิว "รอคืนเงิน"'}>
        <button type="button" onClick={submit} disabled={saving || over || needPhoto} className={primaryButtonClass}>
          {saving ? 'กำลังบันทึก…' : lostOnly ? 'ยืนยันสูญหาย' : 'ยืนยันผลตรวจ · ไปถัดไป'}
        </button>
      </Footer>
    </>
  )
}

function ItemSelect({ order, value, onChange }: { order: OrderSummary; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="ชุดตัวไหน"
      className="h-10 rounded-control border border-line bg-white px-2 text-sm text-ink"
    >
      <option value="">ทุกชุดในออเดอร์</option>
      {order.lines.map((l) => (
        <option key={l.id} value={l.id}>
          {l.itemCode ?? l.productName}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// รอคืนเงิน (มัดจำหลังตรวจ หรือยกเลิกหลังจ่าย)
// ---------------------------------------------------------------------------

function RefundForm({ order, detail, onDone }: { order: OrderSummary; detail: OrderDetail | null; onDone: PanelProps['onDone'] }) {
  const { copied, copy } = useCopy()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amount = order.refundAmount ?? 0

  async function mark(status: 'transferred' | 'failed') {
    if (status === 'failed' && !confirm(`บันทึกว่าโอนคืน ${order.orderNumber} ไม่สำเร็จ? (เช่น เลขบัญชีผิด)`)) return
    setSaving(true)
    setError(null)
    const { error: err } = await markRefund(order.id, status)
    setSaving(false)
    if (err) return setError(translateRpcError(err))
    onDone(status === 'transferred' ? `บันทึกโอนคืน ${order.orderNumber} แล้ว` : `บันทึกว่าโอน ${order.orderNumber} ไม่สำเร็จ`)
  }

  return (
    <>
      <div className="flex flex-col gap-3 p-5 text-[15px]">
        {order.refundStatus === 'failed' && <ErrorBox>โอนครั้งก่อนไม่สำเร็จ ตรวจเลขบัญชีกับลูกค้าก่อนโอนใหม่</ErrorBox>}
        <div className="flex items-baseline justify-between">
          <span className="text-secondary">{order.status === 'completed' ? 'คืนมัดจำ' : 'คืนเงินเต็มจำนวน (ยกเลิก)'}</span>
          <span className="text-2xl font-bold text-brand-strong">{formatBaht(amount)}</span>
        </div>
        {order.refundAccountNumber ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line px-4 py-3">
            <div>
              <p className="font-semibold text-ink">{order.refundAccountName}</p>
              <p className="text-secondary">
                {order.refundBank} · <span className="font-mono font-semibold text-ink">{order.refundAccountNumber}</span>
              </p>
            </div>
            <button type="button" onClick={() => copy('acc', order.refundAccountNumber ?? '')} className={secondaryButtonClass}>
              {copied === 'acc' ? <CheckIcon size={16} weight="bold" /> : <CopyIcon size={16} />}
              {copied === 'acc' ? 'คัดลอกแล้ว' : 'คัดลอกเลขบัญชี'}
            </button>
          </div>
        ) : (
          <ErrorBox>ลูกค้ายังไม่ได้ระบุบัญชีรับเงินคืน ติดต่อลูกค้าที่ {order.shipPhone}</ErrorBox>
        )}
        {order.status === 'completed' ? (
          <div className="flex flex-col gap-1 rounded-control bg-canvas px-4 py-3 text-sm">
            <Row label="มัดจำ" value={formatBaht(order.depositTotal)} />
            {(detail?.deductions ?? []).map((d, i) => (
              <Row key={i} label={`− ${DEDUCTION_LABEL[d.type] ?? d.type}${d.note ? ` · ${d.note}` : ''}`} value={formatBaht(d.amount)} />
            ))}
          </div>
        ) : (
          order.cancelReason && <p className="text-sm text-secondary">เหตุผลที่ยกเลิก: {order.cancelReason}</p>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
      <Footer hint="โอนผ่านแอปธนาคารก่อน แล้วค่อยกดบันทึก">
        {order.refundStatus === 'pending' && (
          <button type="button" onClick={() => mark('failed')} disabled={saving} className="rounded-full px-3 py-2 text-sm font-medium text-danger hover:bg-danger-subtle">
            โอนไม่สำเร็จ
          </button>
        )}
        <button type="button" onClick={() => mark('transferred')} disabled={saving || !order.refundAccountNumber} className={primaryButtonClass}>
          {saving ? 'กำลังบันทึก…' : 'โอนสำเร็จ'}
        </button>
      </Footer>
    </>
  )
}

// ---------------------------------------------------------------------------
// สถานะที่ร้านไม่ต้องทำอะไร: บอกว่ากำลังรออะไร
// ---------------------------------------------------------------------------

function WaitingNote({ order, today }: { order: OrderSummary; today: string }) {
  const late = lateDays(order, today)
  const returnBy = returnByDate(order)
  const text: Record<string, string> = {
    pending_payment: 'รอลูกค้าชำระเงิน ถ้าเลยเวลาระบบจะตั้งหมดอายุและปลดล็อกชุดให้เอง',
    shipped: `ชุดกำลังเดินทาง (${order.shipTrackingNo ?? 'ไม่มีเลขพัสดุ'}) รอลูกค้ากดได้รับ หรือถึงวันใช้งานระบบจะเปลี่ยนให้เอง`,
    active:
      late > 0
        ? `เลยกำหนดคืน ${late} วัน ระบบแจ้งเตือนลูกค้าแล้ว ถ้าเกิน 7 วันจะขึ้นให้ยืนยันสูญหาย`
        : `ชุดอยู่กับลูกค้า ต้องส่งคืนภายใน ${returnBy ? formatThaiDateWithWeekday(returnBy) : '—'}`,
    completed: 'ออเดอร์นี้จบแล้ว',
    cancelled: order.cancelReason ?? 'ออเดอร์นี้ถูกยกเลิก',
    expired: 'ลูกค้าไม่ได้ชำระภายในเวลาที่กำหนด',
  }
  return (
    <p className={`px-5 py-5 text-[15px] ${order.status === 'active' && late > 0 ? 'font-semibold text-danger' : 'text-secondary'}`}>
      {text[order.status] ?? ORDER_STATUS_LABEL[order.status]}
    </p>
  )
}

// ---------------------------------------------------------------------------
// ข้อมูลประกอบ (พับไว้): ที่อยู่ ยอดเงิน หลักฐาน ไทม์ไลน์
// ---------------------------------------------------------------------------

function OrderDetails({ order, detail, openByDefault }: { order: OrderSummary; detail: OrderDetail | null; openByDefault: boolean }) {
  return (
    <details open={openByDefault} className="group border-t border-line-subtle">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-0.5 px-5 py-3 text-sm font-semibold text-ink hover:bg-sunken [&::-webkit-details-marker]:hidden">
        <CaretRightIcon size={14} weight="bold" className="text-muted transition-transform group-open:rotate-90" />
        รายละเอียดออเดอร์
      </summary>

      <div className="grid gap-x-8 gap-y-7 px-5 pb-6 pt-2 text-sm md:grid-cols-2">
        {/* ซ้าย: ของและเงิน (เรื่องที่แอดมินถูกถามบ่อยสุด) */}
        <div className="flex min-w-0 flex-col gap-7">
          <DetailGroup icon={<TShirtIcon size={16} />} title={`ชุด (${order.lines.length})`}>
            <ul className="flex flex-col gap-3">
              {order.lines.map((l) => (
                <li key={l.id}>
                  <p className="font-semibold text-ink">
                    {l.productName}
                    {l.size && <span className="font-normal text-secondary"> · {l.size}</span>}
                  </p>
                  {l.itemCode && <p className="font-mono text-xs text-muted">{l.itemCode}</p>}
                  <p className="mt-1 flex items-center gap-1.5 text-secondary">
                    <CalendarBlankIcon size={14} className="flex-none text-muted" />
                    ใช้ {formatThaiDateWithWeekday(l.startDate)} → คืน {formatThaiDateWithWeekday(l.endDate)}
                  </p>
                  <p className="mt-0.5 tabular-nums text-secondary">
                    เช่า {l.rentalDays} วัน · <span className="font-semibold text-ink">{formatBaht(l.rentalPrice)}</span>
                    {l.extraDaysFee > 0 && (
                      <span className="text-muted">
                        {' '}
                        (วันแรก {formatBaht(l.baseRentalPrice)} + {l.rentalDays - 1} วัน × {formatBaht(l.extraDayRate)})
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </DetailGroup>

          <DetailGroup icon={<ReceiptIcon size={16} />} title="ยอดที่ลูกค้าจ่าย">
            <dl className="flex flex-col gap-1.5">
              <MoneyRow label="ค่าเช่า" value={order.rentalTotal} />
              <MoneyRow label="มัดจำ" value={order.depositTotal} />
              {order.laundryTotal > 0 && <MoneyRow label="ค่าซักรีด" value={order.laundryTotal} />}
              <MoneyRow label="ค่าส่ง" value={order.shippingFee} />
              <div className="mt-1 flex items-baseline justify-between border-t border-line-subtle pt-2">
                <dt className="font-semibold text-ink">รวม</dt>
                <dd className="text-base font-bold tabular-nums text-ink">{formatBaht(order.grandTotal)}</dd>
              </div>
            </dl>
          </DetailGroup>

          <RefundInfo order={order} detail={detail} />
        </div>

        {/* ขวา: คนและเหตุการณ์ */}
        <div className="flex min-w-0 flex-col gap-7">
          <DetailGroup icon={<MapPinIcon size={16} />} title="จัดส่งถึง">
            <p className="font-semibold text-ink">{order.shipName}</p>
            <a
              href={`tel:${order.shipPhone}`}
              className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-ink underline-offset-2 hover:underline"
            >
              <PhoneIcon size={14} className="text-muted" />
              {order.shipPhone}
            </a>
            <p className="mt-1 leading-relaxed text-secondary">{fullAddress(order)}</p>
            {detail?.extras?.receiptIssueNote && (
              <p className="mt-3 flex gap-2 rounded-control bg-warning-subtle px-3 py-2 text-warning">
                <WarningIcon size={16} weight="fill" className="mt-0.5 flex-none" />
                <span>
                  <b className="font-semibold">ลูกค้าแจ้งปัญหาตอนรับของ</b> {detail.extras.receiptIssueNote}
                </span>
              </p>
            )}
          </DetailGroup>

          <DetailGroup icon={<ClockCounterClockwiseIcon size={16} />} title="ไทม์ไลน์ · ล่าสุดอยู่บน">
            {!detail ? (
              <p className="text-muted">กำลังโหลด…</p>
            ) : detail.history.length === 0 ? (
              <p className="text-muted">ยังไม่มีประวัติ (ออเดอร์ก่อนเปิดระบบบันทึกประวัติ)</p>
            ) : (
              <ol className="relative flex flex-col gap-3.5 before:absolute before:bottom-2 before:left-[4px] before:top-2 before:w-px before:bg-line-subtle">
                {detail.history.map((h, i) => (
                  <li key={i} className="relative flex gap-3">
                    <span
                      className={`relative mt-[7px] h-[9px] w-[9px] flex-none rounded-full ring-2 ring-white ${
                        h.actor === 'system' ? 'bg-[#2E9E62]' : h.actor === 'admin' ? 'bg-brand' : 'bg-[#2F7FD6]'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className={i === 0 ? 'font-bold text-ink' : 'font-medium text-ink'}>{ADMIN_STATUS_LABEL[h.to]}</p>
                      <p className="text-xs text-muted">
                        <span className="tabular-nums">{formatDateTime(h.at)}</span> · {ACTOR_LABEL[h.actor]}
                        {h.reason && ` · ${h.reason}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </DetailGroup>
        </div>

        {!!detail?.evidence.length && (
          <div className="md:col-span-2">
            <DetailGroup icon={<CameraIcon size={16} />} title="รูปหลักฐาน">
              <div className="flex flex-wrap gap-6">
                {detail.evidence.map((ev) => {
                  const label = ev.stage === 'packing' ? 'ตอนแพ็ก' : 'ตอนรับคืน'
                  return (
                    <div key={ev.stage}>
                      <p className="mb-1.5 text-xs text-secondary">{label}</p>
                      <div className="flex flex-wrap gap-2">
                        {ev.urls.map((u, i) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" className="focus-ring rounded-lg">
                            <img src={u} alt={`รูป${label} ${i + 1}`} className="h-16 w-16 rounded-lg border border-line-subtle object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </DetailGroup>
          </div>
        )}
      </div>
    </details>
  )
}

function DetailGroup({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-secondary">
        <span className="text-muted">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function MoneyRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-secondary">{label}</dt>
      <dd className="tabular-nums text-ink">{formatBaht(value)}</dd>
    </div>
  )
}

// ซ่อนเลขบัญชีเหลือ 4 หลักท้าย: ไว้เทียบกับลูกค้าตอนถามว่าเงินเข้าหรือยัง เลขเต็มอยู่ในคิว "รอโอนเงินคืน" ที่เดียว
function maskAccount(no: string): string {
  const digits = no.replace(/\D/g, '')
  return digits.length <= 4 ? digits : `xxx-x-x${digits.slice(-4)}`
}

// ผลการคืนเงิน: สีและไอคอนบอกสถานะให้เห็นก่อนอ่านตัวเลข
function RefundInfo({ order, detail }: { order: OrderSummary; detail: OrderDetail | null }) {
  const what = order.status === 'completed' ? 'มัดจำ' : 'เงิน'
  const deductions = order.status === 'completed' ? (detail?.deductions ?? []) : []

  let state: { tone: string; icon: ReactNode; title: string } | null = null
  if (order.refundStatus === 'transferred')
    state = { tone: 'bg-success-subtle text-success', icon: <CheckCircleIcon size={20} weight="fill" />, title: `คืน${what}แล้ว` }
  else if (order.refundStatus === 'pending')
    state = { tone: 'bg-warning-subtle text-warning', icon: <ClockIcon size={20} weight="fill" />, title: `รอโอนคืน${what}` }
  else if (order.refundStatus === 'failed')
    state = { tone: 'bg-danger-subtle text-danger', icon: <WarningCircleIcon size={20} weight="fill" />, title: 'โอนคืนไม่สำเร็จ' }
  else if (order.status === 'completed')
    state =
      order.depositTotal > 0
        ? { tone: 'bg-sunken text-ink', icon: <ProhibitIcon size={20} />, title: 'ยึดมัดจำ ไม่มียอดคืน' }
        : { tone: 'bg-sunken text-secondary', icon: <MinusCircleIcon size={20} />, title: 'ไม่มีมัดจำ ไม่ต้องคืนเงิน' }

  if (!state) return null
  const hasRefund = order.refundStatus !== null
  const showAccount = hasRefund && !!order.refundAccountNumber

  return (
    <DetailGroup icon={<BankIcon size={16} />} title="คืนเงิน">
      <div className="overflow-hidden rounded-control border border-line-subtle">
        <div className={`flex items-center gap-2.5 px-4 py-3 ${state.tone}`}>
          {state.icon}
          <p className="flex-1 font-semibold">{state.title}</p>
          {hasRefund && <p className="text-lg font-bold tabular-nums">{formatBaht(order.refundAmount ?? 0)}</p>}
        </div>

        {(deductions.length > 0 || showAccount || order.refundedAt) && (
          <div className="flex flex-col gap-3 px-4 py-3">
            {deductions.length > 0 && (
              <dl className="flex flex-col gap-1">
                <MoneyRow label="มัดจำ" value={order.depositTotal} />
                {deductions.map((d, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-4">
                    <dt className="text-secondary">
                      หัก {DEDUCTION_LABEL[d.type] ?? d.type}
                      {d.note && <span className="text-muted"> · {d.note}</span>}
                    </dt>
                    <dd className="tabular-nums text-danger">−{formatBaht(d.amount)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {showAccount && (
              <div className={deductions.length > 0 ? 'border-t border-line-subtle pt-3' : ''}>
                <p className="text-xs text-muted">{order.refundStatus === 'transferred' ? 'โอนเข้าบัญชี' : 'บัญชีรับเงินคืน'}</p>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-ink">{order.refundBank}</span>
                  <span className="whitespace-nowrap font-mono text-ink">{maskAccount(order.refundAccountNumber ?? '')}</span>
                </p>
                <p className="text-secondary">{order.refundAccountName}</p>
              </div>
            )}

            {order.refundedAt && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <CalendarCheckIcon size={14} />
                โอนเมื่อ <span className="tabular-nums">{formatDateTime(order.refundedAt)}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </DetailGroup>
  )
}


function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className="flex justify-between gap-4">
      <span className={strong ? 'font-medium text-ink' : 'text-secondary'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-bold text-ink' : 'text-ink'}`}>{value}</span>
    </p>
  )
}
