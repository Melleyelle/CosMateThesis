import { createClient } from '@/utils/client'
import type { OrderStatus } from '@/utils/orderStatus'
import type { DeliveryMethod } from '@/utils/customer/bookingSettings'

export type OrderLine = {
  id: string
  startDate: string
  endDate: string
  rentalPrice: number // ค่าเช่ารวมของรายการ = baseRentalPrice + extraDaysFee
  rentalDays: number
  baseRentalPrice: number // ค่าเช่าวันแรก
  extraDayRate: number // อัตราวันเพิ่มต่อวันที่ใช้จริงตอนจอง (รายการก่อน v2 = 0)
  extraDaysFee: number
  depositAmount: number
  laundryFee: number
  size: string | null
  itemCode: string | null // แอดมินเท่านั้นที่ต้องใช้ (ป้ายรหัสชุดจริงที่ต้องหยิบไปแพ็ก)
  productId: string | null
  productName: string
  coverImageUrl: string | null
  pieceNames: string[] | null // เช่าแยกชิ้น: ชื่อชิ้นที่เช่า / null = เช่าทั้งชุด
  // รองเท้าที่มากับชุด (Step 19): id รายการชุดที่รองเท้านี้ติดมาด้วย และชื่อชุดนั้น · null = รายการปกติ
  parentLineId: string | null
  bundledWith: string | null
  // รองเท้าไซส์ที่เลือกไม่ว่างตอนจอง ร้านต้องจัดหาคู่ใกล้เคียงให้ (Step 29) · null = ไม่ต้องจัดหา
  shoeSourcing: ShoeSourcing | null
}

// ค่ารองเท้าที่หาไม่ได้ รวมเข้ายอดคืนเงินตอนตรวจรับคืน (admin_receive_and_inspect ของ Step 29)
export function shoeRefundOf(order: OrderSummary): number {
  return order.lines.reduce((sum, l) => sum + (l.shoeSourcing?.status === 'refund' ? l.shoeSourcing.amount : 0), 0)
}

export type ShoeSourcingStatus = 'pending' | 'sourced' | 'refund'
export type ShoeSourcing = {
  status: ShoeSourcingStatus
  size: string | null
  amount: number // หาไม่ได้ = คืนค่ารองเท้าเท่านี้ (ราคาชิ้นรองเท้าตอนจอง)
  note: string | null // โน้ตของแอดมิน (ดึงเฉพาะฝั่งแอดมิน)
}

export type OrderSummary = {
  id: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  shipName: string
  shipPhone: string
  shipAddress: string
  shipSubdistrict: string | null
  shipDistrict: string | null
  shipProvince: string
  shipPostalCode: string
  customerNote: string | null
  rentalTotal: number
  depositTotal: number
  laundryTotal: number
  shippingFee: number
  grandTotal: number
  // บัญชีรับมัดจำคืน (มีหลังรัน Step 10 และลูกค้ากรอกตอนชำระเงิน)
  refundAccountName: string | null
  refundBank: string | null
  refundAccountNumber: string | null
  // การยกเลิก/คืนเงิน (Step 13): refundStatus null = ไม่มีเงินต้องคืน
  cancelReason: string | null
  refundStatus: 'pending' | 'transferred' | 'failed' | null
  refundAmount: number | null
  refundedAt: string | null
  // เลขพัสดุ: ร้านกรอกตอนส่งออก / ลูกค้ากรอกตอนส่งคืน
  shipCarrier: string | null // รหัสขนส่งที่ลูกค้าเลือก (Step 20) · ชื่อดูที่ shipCarrierName()
  shipTrackingNo: string | null
  returnCarrier: string | null
  returnTrackingNo: string | null
  returnSubmittedAt: string | null
  // วิธีรับชุด (v3): ship = จัดส่ง / pickup = รับเองที่ร้าน (ที่อยู่ ship_* ว่างได้)
  deliveryMethod: DeliveryMethod
  handoverTo: string | null
  handedOverAt: string | null
  returnMethod: 'ship' | 'walk_in' | null
  // awaiting_id (Step 25): ร้านต้องตรวจบัตรให้เสร็จก่อนเวลานี้ ไม่งั้นออเดอร์หมดอายุเอง
  idReviewExpiresAt: string | null
  lines: OrderLine[]
}

type OrderRow = {
  id: string
  order_number: string
  status: OrderStatus
  created_at: string
  updated_at: string
  ship_name: string
  ship_phone: string
  ship_address: string | null
  ship_subdistrict: string | null
  ship_district: string | null
  ship_province: string | null
  ship_postal_code: string | null
  customer_note: string | null
  rental_total: number | string
  deposit_total: number | string
  laundry_total: number | string
  shipping_fee: number | string
  grand_total: number | string
  refund_account_name?: string | null
  refund_bank?: string | null
  refund_account_number?: string | null
  cancel_reason?: string | null
  refund_status?: 'pending' | 'transferred' | 'failed' | null
  refund_amount?: number | string | null
  refunded_at?: string | null
  ship_carrier?: string | null
  ship_tracking_no?: string | null
  return_carrier?: string | null
  return_tracking_no?: string | null
  return_submitted_at?: string | null
  delivery_method?: string | null
  handover_to?: string | null
  handed_over_at?: string | null
  return_method?: 'ship' | 'walk_in' | null
  id_review_expires_at?: string | null
  order_items:
    | {
        id: string
        parent_item_id?: string | null
        start_date: string
        end_date: string
        rental_price: number | string
        rental_days: number | null
        base_rental_price: number | string | null
        extra_day_rate: number | string | null
        extra_days_fee: number | string | null
        deposit_amount: number | string
        laundry_fee: number | string
        pieces?: { name: string }[] | null
        shoe_sourcing_status?: ShoeSourcingStatus | null
        shoe_sourcing_size?: string | null
        shoe_sourcing_amount?: number | string | null
        shoe_sourcing_note?: string | null
        product_items?: { item_code: string } | null
        product_variants: {
          size: string
          products: { id: string; name: string; cover_image_url: string | null } | null
        } | null
      }[]
    | null
}

const ORDER_COLUMNS = `
  id, order_number, status, created_at, updated_at,
  ship_name, ship_phone, ship_address, ship_subdistrict, ship_district, ship_province, ship_postal_code,
  customer_note, rental_total, deposit_total, laundry_total, shipping_fee, grand_total,
  refund_account_name, refund_bank, refund_account_number,
  cancel_reason, refund_status, refund_amount, refunded_at,
  ship_carrier, ship_tracking_no, return_carrier, return_tracking_no, return_submitted_at,
  delivery_method, handover_to, handed_over_at, return_method, id_review_expires_at
`
// ship_carrier ต้องรัน SQL Step 20 ก่อน

// parent_item_id ต้องรัน SQL Step 19 ก่อน · shoe_sourcing_* ต้องรัน Step 29 (ยังไม่รัน = ดึงแบบไม่มี ดู selectOrders)
// โน้ตจัดหารองเท้าเป็นของร้าน ดึงเฉพาะฝั่งแอดมิน
function lineColumns(admin: boolean, sourcing: boolean): string {
  return `
  id, parent_item_id, start_date, end_date, rental_price, rental_days, base_rental_price, extra_day_rate, extra_days_fee,
  deposit_amount, laundry_fee, pieces,
  ${sourcing ? `shoe_sourcing_status, shoe_sourcing_size, shoe_sourcing_amount,${admin ? ' shoe_sourcing_note,' : ''}` : ''}
  ${admin ? 'product_items ( item_code ),' : ''}
  product_variants ( size, products ( id, name, cover_image_url ) )
`
}

// ลองดึงพร้อมคอลัมน์ Step 29 ก่อน ถ้าฐานข้อมูลยังไม่มีคอลัมน์ก็ดึงใหม่แบบเดิม
async function selectOrders<T>(
  admin: boolean,
  run: (columns: string) => PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<{ data: T; error: { message: string } | null }> {
  const res = await run(`${ORDER_COLUMNS}, order_items ( ${lineColumns(admin, true)} )`)
  if (!res.error || !res.error.message.includes('shoe_sourcing')) return res
  return run(`${ORDER_COLUMNS}, order_items ( ${lineColumns(admin, false)} )`)
}

function daysInclusive(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
}

function mapOrder(o: OrderRow): OrderSummary {
  return {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    shipName: o.ship_name,
    shipPhone: o.ship_phone,
    shipAddress: o.ship_address ?? '',
    shipSubdistrict: o.ship_subdistrict,
    shipDistrict: o.ship_district,
    shipProvince: o.ship_province ?? '',
    shipPostalCode: o.ship_postal_code ?? '',
    customerNote: o.customer_note,
    rentalTotal: Number(o.rental_total),
    depositTotal: Number(o.deposit_total),
    laundryTotal: Number(o.laundry_total),
    shippingFee: Number(o.shipping_fee),
    grandTotal: Number(o.grand_total),
    refundAccountName: o.refund_account_name ?? null,
    refundBank: o.refund_bank ?? null,
    refundAccountNumber: o.refund_account_number ?? null,
    cancelReason: o.cancel_reason ?? null,
    refundStatus: o.refund_status ?? null,
    refundAmount: o.refund_amount == null ? null : Number(o.refund_amount),
    refundedAt: o.refunded_at ?? null,
    shipCarrier: o.ship_carrier ?? null,
    shipTrackingNo: o.ship_tracking_no ?? null,
    returnCarrier: o.return_carrier ?? null,
    returnTrackingNo: o.return_tracking_no ?? null,
    returnSubmittedAt: o.return_submitted_at ?? null,
    deliveryMethod: o.delivery_method === 'pickup' ? 'pickup' : 'ship',
    handoverTo: o.handover_to ?? null,
    handedOverAt: o.handed_over_at ?? null,
    returnMethod: o.return_method ?? null,
    idReviewExpiresAt: o.id_review_expires_at ?? null,
    lines: orderLines(o.order_items ?? []),
  }
}

// รองเท้าที่มากับชุดเรียงต่อจากรายการชุดของมันเสมอ (ไม่ปนกับรายการอื่นที่วันเริ่มเดียวกัน)
function orderLines(items: NonNullable<OrderRow['order_items']>): OrderLine[] {
  const nameById = new Map(items.map((i) => [i.id, i.product_variants?.products?.name ?? null]))
  const lines = items.map((i) => ({
        id: i.id,
        startDate: i.start_date,
        endDate: i.end_date,
        rentalPrice: Number(i.rental_price),
        rentalDays: i.rental_days ?? daysInclusive(i.start_date, i.end_date),
        baseRentalPrice: Number(i.base_rental_price ?? i.rental_price),
        extraDayRate: Number(i.extra_day_rate ?? 0),
        extraDaysFee: Number(i.extra_days_fee ?? 0),
        depositAmount: Number(i.deposit_amount),
        laundryFee: Number(i.laundry_fee),
        size: i.product_variants?.size ?? null,
        itemCode: i.product_items?.item_code ?? null,
        productId: i.product_variants?.products?.id ?? null,
        productName: i.product_variants?.products?.name ?? 'ชุดที่ถูกลบออกจากคลัง',
        coverImageUrl: i.product_variants?.products?.cover_image_url ?? null,
        pieceNames: i.pieces && i.pieces.length > 0 ? i.pieces.map((p) => p.name) : null,
        parentLineId: i.parent_item_id ?? null,
        bundledWith: i.parent_item_id ? (nameById.get(i.parent_item_id) ?? 'ชุด') : null,
        shoeSourcing: i.shoe_sourcing_status
          ? {
              status: i.shoe_sourcing_status,
              size: i.shoe_sourcing_size ?? null,
              amount: Number(i.shoe_sourcing_amount ?? 0),
              note: i.shoe_sourcing_note ?? null,
            }
          : null,
      }))
  const parents = lines.filter((l) => !l.parentLineId).sort((a, b) => a.startDate.localeCompare(b.startDate))
  return parents.flatMap((p) => [p, ...lines.filter((l) => l.parentLineId === p.id)])
}

// ลูกค้า: ออเดอร์เดียว (RLS กันไม่ให้เห็นของคนอื่นอยู่แล้ว)
export async function fetchOrder(orderId: string): Promise<{ data: OrderSummary | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const { data, error } = await selectOrders(false, (columns) =>
    supabase.from('orders').select(columns).eq('id', orderId).maybeSingle(),
  )

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'ไม่พบออเดอร์นี้' }
  return { data: mapOrder(data as unknown as OrderRow), error: null }
}

// ลูกค้า: ออเดอร์ทั้งหมดของตัวเอง
// กรอง user_id ซ้ำกับ RLS โดยตั้งใจ — ถ้าแอดมินเปิดหน้านี้ จะได้เห็นเฉพาะของตัวเองเหมือนลูกค้าทั่วไป
export async function fetchMyOrders(): Promise<{ data: OrderSummary[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'กรุณาเข้าสู่ระบบ' }

  const { data, error } = await selectOrders(false, (columns) =>
    supabase.from('orders').select(columns).eq('user_id', user.id).order('created_at', { ascending: false }),
  )

  if (error) return { data: [], error: error.message }
  return { data: ((data ?? []) as unknown as OrderRow[]).map(mapOrder), error: null }
}

// แอดมิน: ออเดอร์ทั้งหมดของสมาชิกคนเดียว (หน้ารายละเอียดสมาชิก)
export async function fetchOrdersOfMemberForAdmin(userId: string): Promise<{ data: OrderSummary[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const { data, error } = await selectOrders(true, (columns) =>
    supabase.from('orders').select(columns).eq('user_id', userId).order('created_at', { ascending: false }),
  )

  if (error) return { data: [], error: error.message }
  return { data: ((data ?? []) as unknown as OrderRow[]).map(mapOrder), error: null }
}

// แอดมิน: ออเดอร์ทั้งหมด พร้อมรหัสชุดจริงที่ระบบจัดสรรให้
export async function fetchAllOrdersForAdmin(): Promise<{ data: OrderSummary[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  // ต้องรัน Step 10 และ 13 แล้ว (คอลัมน์ refund_* / cancel_reason)
  const { data, error } = await selectOrders(true, (columns) =>
    supabase.from('orders').select(columns).order('created_at', { ascending: false }),
  )

  if (error) return { data: [], error: error.message }
  return { data: ((data ?? []) as unknown as OrderRow[]).map(mapOrder), error: null }
}
