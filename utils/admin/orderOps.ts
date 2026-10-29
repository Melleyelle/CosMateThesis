// ข้อมูลเสริมและคำสั่งของหน้าออเดอร์แอดมิน (คิวงาน) — ต้องรัน Step 16 และ 17 แล้ว
import { createClient } from '@/utils/client'
import type { OrderSummary } from '@/utils/customer/fetchOrders'
import type { OrderStatus } from '@/utils/orderStatus'
import type { BookingSettings } from '@/utils/customer/bookingSettings'
import { dayDiff, shipByDate } from '@/utils/admin/fetchDashboard'
import { toISODate } from '@/utils/dateUtils'

// งานที่แผงขวาต้องแสดงให้ออเดอร์นี้
export type OrderTask = 'id' | 'slip' | 'pack' | 'inspect' | 'refund' | 'lost' | 'view'

export const OVERDUE_LOST_DAYS = 7 // ตรงกับ app_settings.overdue_lost_days

export function returnByDate(order: OrderSummary): string | null {
  return order.lines.map((l) => l.endDate).sort().slice(-1)[0] ?? null
}

// วันคืนช้า: นับถึงวันที่ลูกค้ากรอกเลขพัสดุ (ยังไม่กรอก = นับถึงวันนี้)
export function lateDays(order: OrderSummary, today: string): number {
  const due = returnByDate(order)
  if (!due) return 0
  const back = order.returnSubmittedAt ? toISODate(new Date(order.returnSubmittedAt)) : today
  return Math.max(0, dayDiff(due, back))
}

export function taskOf(order: OrderSummary, today: string): OrderTask {
  if (order.refundStatus === 'pending' || order.refundStatus === 'failed') return 'refund'
  if (order.status === 'awaiting_id') return 'id' // เช่าครั้งแรก รอร้านตรวจรูปบัตร (Step 25)
  if (order.status === 'manual_review') return 'slip'
  if (order.status === 'paid') return 'pack'
  if (order.status === 'returned' || order.status === 'inspecting') return 'inspect'
  if (order.status === 'active' && order.returnTrackingNo) return 'inspect' // ออเดอร์ก่อน Step 17
  if (order.status === 'active' && lateDays(order, today) > OVERDUE_LOST_DAYS) return 'lost'
  return 'view'
}

// เส้นตายที่แอดมินควรเห็นในแถวรายการ
export function dueOf(
  order: OrderSummary,
  s: BookingSettings,
  today: string,
): { text: string; tone: 'urgent' | 'late' | 'normal'; sortKey: string } {
  const task = taskOf(order, today)
  if (task === 'refund') {
    return { text: `โอนคืน ฿${(order.refundAmount ?? 0).toLocaleString('th-TH')}`, tone: order.refundStatus === 'failed' ? 'late' : 'normal', sortKey: order.updatedAt }
  }
  if (task === 'id') return { text: 'ตรวจบัตร', tone: 'urgent', sortKey: order.createdAt }
  if (task === 'slip') return { text: 'ตรวจสลิป', tone: 'urgent', sortKey: order.createdAt }
  if (task === 'pack') {
    const pickup = order.deliveryMethod === 'pickup'
    const shipBy = order.lines.map((l) => shipByDate(l.startDate, s, order.deliveryMethod)).sort()[0] ?? today
    const diff = dayDiff(today, shipBy)
    return {
      text: pickup
        ? diff < 0 ? `ยังไม่มารับ ${-diff} วัน` : diff === 0 ? 'มารับวันนี้' : `มารับใน ${diff} วัน`
        : diff < 0 ? `ส่งช้าแล้ว ${-diff} วัน` : diff === 0 ? 'ต้องส่งวันนี้' : `ส่งภายใน ${diff} วัน`,
      tone: diff < 0 ? 'late' : diff === 0 ? 'urgent' : 'normal',
      sortKey: shipBy,
    }
  }
  if (task === 'inspect' || task === 'lost') {
    const late = lateDays(order, today)
    return {
      text: task === 'lost' ? `ไม่คืน ${late} วัน` : late > 0 ? `คืนช้า ${late} วัน` : 'คืนตรงเวลา',
      tone: late > 0 ? 'late' : 'normal',
      sortKey: order.returnSubmittedAt ?? returnByDate(order) ?? today,
    }
  }
  if (order.status === 'shipped' || order.status === 'active') {
    const due = returnByDate(order) ?? today
    const late = lateDays(order, today)
    return { text: late > 0 ? `เลยกำหนดคืน ${late} วัน` : `คืนภายใน ${due.slice(8)}/${due.slice(5, 7)}`, tone: late > 0 ? 'late' : 'normal', sortKey: due }
  }
  return { text: '', tone: 'normal', sortKey: order.createdAt }
}

export function fullAddress(o: OrderSummary): string {
  return [o.shipAddress, o.shipSubdistrict, o.shipDistrict, o.shipProvince, o.shipPostalCode].filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// ข้อมูลเสริมที่โหลดเมื่อเปิดแผงขวา (ไม่ดึงพร้อมรายการ เพื่อให้หน้ารายการเบา)
// ---------------------------------------------------------------------------

export type OrderExtras = {
  slipPath: string | null
  slipAmount: number | null
  slipNote: string | null
  slipSubmittedAt: string | null
  receivedAt: string | null
  receiptIssueNote: string | null
  overdueFlaggedAt: string | null
  inspectionResult: string | null
  lateFee: number
  damageFee: number
}

export type HistoryRow = { from: OrderStatus | null; to: OrderStatus; actor: 'customer' | 'admin' | 'system'; reason: string | null; at: string }
export type Evidence = { stage: 'packing' | 'return_received'; urls: string[]; checklist: { name: string; checked: boolean }[]; note: string | null; at: string }
export type Deduction = { type: string; amount: number; note: string | null }

export type OrderDetail = {
  extras: OrderExtras | null
  slipUrl: string | null
  history: HistoryRow[]
  evidence: Evidence[]
  deductions: Deduction[]
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
  const supabase = createClient()
  const empty: OrderDetail = { extras: null, slipUrl: null, history: [], evidence: [], deductions: [] }
  if (!supabase) return empty

  const [extrasRes, historyRes, evidenceRes, dedRes] = await Promise.all([
    supabase
      .from('orders')
      .select('slip_image_path, slip_amount, slip_verify_result, slip_submitted_at, received_at, receipt_issue_note, overdue_flagged_at, inspection_result, late_fee, damage_fee')
      .eq('id', orderId)
      .maybeSingle(),
    supabase.from('order_status_history').select('from_status, to_status, actor, reason, changed_at').eq('order_id', orderId).order('changed_at', { ascending: false }),
    supabase.from('order_evidence').select('stage, image_paths, checklist, note, created_at').eq('order_id', orderId),
    supabase.from('order_deductions').select('type, amount, note').eq('order_id', orderId).order('created_at'),
  ])

  const e = extrasRes.data as Record<string, unknown> | null
  const extras: OrderExtras | null = e
    ? {
        slipPath: (e.slip_image_path as string) ?? null,
        slipAmount: e.slip_amount == null ? null : Number(e.slip_amount),
        slipNote: ((e.slip_verify_result as { note?: string } | null)?.note as string) ?? null,
        slipSubmittedAt: (e.slip_submitted_at as string) ?? null,
        receivedAt: (e.received_at as string) ?? null,
        receiptIssueNote: (e.receipt_issue_note as string) ?? null,
        overdueFlaggedAt: (e.overdue_flagged_at as string) ?? null,
        inspectionResult: (e.inspection_result as string) ?? null,
        lateFee: Number(e.late_fee ?? 0),
        damageFee: Number(e.damage_fee ?? 0),
      }
    : null

  let slipUrl: string | null = null
  if (extras?.slipPath) {
    const { data } = await supabase.storage.from('payment-slips').createSignedUrl(extras.slipPath, 60 * 30)
    slipUrl = data?.signedUrl ?? null
  }

  type EvRow = { stage: Evidence['stage']; image_paths: string[]; checklist: Evidence['checklist'] | null; note: string | null; created_at: string }
  const evRows = (evidenceRes.data ?? []) as EvRow[]
  const allPaths = evRows.flatMap((r) => r.image_paths)
  const signed = new Map<string, string>()
  if (allPaths.length) {
    const { data } = await supabase.storage.from('order-evidence').createSignedUrls(allPaths, 60 * 30)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }

  type HRow = { from_status: OrderStatus | null; to_status: OrderStatus; actor: HistoryRow['actor']; reason: string | null; changed_at: string }
  return {
    extras,
    slipUrl,
    history: ((historyRes.data ?? []) as HRow[]).map((h) => ({ from: h.from_status, to: h.to_status, actor: h.actor, reason: h.reason, at: h.changed_at })),
    evidence: evRows.map((r) => ({
      stage: r.stage,
      urls: r.image_paths.map((p) => signed.get(p)).filter((u): u is string => !!u),
      checklist: Array.isArray(r.checklist) ? r.checklist : [],
      note: r.note,
      at: r.created_at,
    })),
    deductions: ((dedRes.data ?? []) as { type: string; amount: number | string; note: string | null }[]).map((d) => ({ type: d.type, amount: Number(d.amount), note: d.note })),
  }
}

// เช็กลิสต์ของในกล่อง: เช่าแยกชิ้น = ชิ้นที่เช่า · เช่าทั้งชุด = "สิ่งที่รวมในชุด" · ไม่มีข้อมูล = ตัวชุดเอง
export async function fetchPackChecklist(order: OrderSummary): Promise<string[]> {
  const supabase = createClient()
  const productIds = [...new Set(order.lines.filter((l) => !l.pieceNames && l.productId).map((l) => l.productId as string))]
  const byProduct = new Map<string, string[]>()
  if (supabase && productIds.length) {
    const { data } = await supabase
      .from('product_inclusions')
      .select('product_id, name, display_order')
      .in('product_id', productIds)
      .order('display_order')
    for (const r of (data ?? []) as { product_id: string; name: string }[]) {
      byProduct.set(r.product_id, [...(byProduct.get(r.product_id) ?? []), r.name])
    }
  }
  const multi = order.lines.length > 1
  return order.lines.flatMap((l) => {
    const names = l.pieceNames ?? (l.productId ? byProduct.get(l.productId) : undefined) ?? [l.productName]
    return names.map((n) => (multi ? `${l.productName} · ${n}` : n))
  })
}

// ย่อรูปฝั่งเบราว์เซอร์ก่อนอัปโหลด (ด้านยาวไม่เกิน 1600px, JPEG) — รูปมือถือ 5–10 MB เหลือราว 300 KB
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
    return blob ?? file
  } catch {
    return file
  }
}

export async function uploadEvidence(orderId: string, stage: 'pack' | 'return', file: File): Promise<{ path: string | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { path: null, error: 'Supabase ยังไม่ได้ตั้งค่า' }
  if (!file.type.startsWith('image/')) return { path: null, error: 'กรุณาเลือกไฟล์รูปภาพ' }
  const blob = await shrinkImage(file)
  const path = `${orderId}/${stage}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
  const { error } = await supabase.storage.from('order-evidence').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  return error ? { path: null, error: 'อัปโหลดรูปไม่สำเร็จ' } : { path, error: null }
}

// ---------------------------------------------------------------------------
// คำสั่ง (เรียกฟังก์ชันใน Step 17 / ของเดิม)
// ---------------------------------------------------------------------------

export async function shipOrder(orderId: string, trackingNo: string, checklist: string[], imagePaths: string[]) {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ตั้งค่า' }
  const { error } = await supabase.rpc('admin_ship_order', {
    p_order_id: orderId,
    p_tracking_no: trackingNo,
    p_checklist: checklist.map((name) => ({ name, checked: true })),
    p_image_paths: imagePaths,
  })
  return { error: error?.message ?? null }
}

// อีเมลแจ้งลูกค้า (ส่งฝั่งเซิร์ฟเวอร์) — เรียกหลังคำสั่งสำเร็จ ถ้าล้มไม่กระทบสถานะออเดอร์
//   shipped = จัดส่งแล้ว · inspected = ผลตรวจสภาพ/การหักมัดจำ · refunded = โอนเงินคืนสำเร็จ
export async function notifyCustomer(
  orderId: string,
  kind: 'shipped' | 'inspected' | 'refunded',
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/orders/${orderId}/notify-${kind}`, { method: 'POST' })
    if (res.ok) return { error: null }
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    return { error: body?.error ?? `HTTP ${res.status}` }
  } catch {
    return { error: 'NETWORK_ERROR' }
  }
}

// รับเองที่ร้าน: ส่งมอบให้ลูกค้า/ไรเดอร์ → paid → active (ไม่ผ่าน shipped)
export async function handoverOrder(orderId: string, handoverTo: string, checklist: string[], imagePaths: string[]) {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ตั้งค่า' }
  const { error } = await supabase.rpc('admin_handover_order', {
    p_order_id: orderId,
    p_handover_to: handoverTo,
    p_checklist: checklist.map((name) => ({ name, checked: true })),
    p_image_paths: imagePaths,
  })
  return { error: error?.message ?? null }
}

export type DeductionInput ={ type: 'damage' | 'missing_part' | 'special_cleaning' | 'lost'; amount: number; note: string; orderItemId: string | null }

export async function receiveAndInspect(args: {
  orderId: string
  imagePaths: string[]
  checklist: { name: string; checked: boolean }[]
  deductions: DeductionInput[]
  waiveLate: boolean
  severity: 'minor' | 'major'
  returnMethod: 'ship' | 'walk_in' // walk_in = ลูกค้านำมาคืนที่ร้าน ไม่ต้องมีเลขพัสดุ
}) {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ตั้งค่า' }
  const { error } = await supabase.rpc('admin_receive_and_inspect', {
    p_order_id: args.orderId,
    p_image_paths: args.imagePaths,
    p_checklist: args.checklist,
    p_deductions: args.deductions.map((d) => ({ type: d.type, amount: d.amount, note: d.note || null, order_item_id: d.orderItemId })),
    p_waive_late: args.waiveLate,
    p_severity: args.severity,
    p_return_method: args.returnMethod,
  })
  return { error: error?.message ?? null }
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ตั้งค่า' }
  const { error } = await supabase.rpc('admin_update_order_status', { p_order_id: orderId, p_new_status: status })
  return { error: error?.message ?? null }
}

export async function markRefund(orderId: string, status: 'transferred' | 'failed') {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ตั้งค่า' }
  const { error } = await supabase.rpc('admin_mark_refund', { p_order_id: orderId, p_status: status })
  return { error: error?.message ?? null }
}

export const DEDUCTION_LABEL: Record<string, string> = {
  late_return: 'คืนช้า',
  damage: 'ชำรุด',
  missing_part: 'ของไม่ครบ',
  special_cleaning: 'ซักพิเศษ',
  lost: 'สูญหาย / ไม่คืนชุด',
}

export const ACTOR_LABEL: Record<HistoryRow['actor'], string> = { customer: 'ลูกค้า', admin: 'แอดมิน', system: 'ระบบ' }
