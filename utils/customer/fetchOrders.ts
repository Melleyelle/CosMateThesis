import { createClient } from '@/utils/client'
import type { OrderStatus } from '@/utils/orderStatus'

export type OrderLine = {
  id: string
  startDate: string
  endDate: string
  rentalPrice: number
  depositAmount: number
  laundryFee: number
  size: string | null
  itemCode: string | null // แอดมินเท่านั้นที่ต้องใช้ (ป้ายรหัสชุดจริงที่ต้องหยิบไปแพ็ก)
  productId: string | null
  productName: string
  coverImageUrl: string | null
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
  ship_address: string
  ship_subdistrict: string | null
  ship_district: string | null
  ship_province: string
  ship_postal_code: string
  customer_note: string | null
  rental_total: number | string
  deposit_total: number | string
  laundry_total: number | string
  shipping_fee: number | string
  grand_total: number | string
  refund_account_name?: string | null
  refund_bank?: string | null
  refund_account_number?: string | null
  order_items:
    | {
        id: string
        start_date: string
        end_date: string
        rental_price: number | string
        deposit_amount: number | string
        laundry_fee: number | string
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
  customer_note, rental_total, deposit_total, laundry_total, shipping_fee, grand_total
`

const LINE_COLUMNS = `
  id, start_date, end_date, rental_price, deposit_amount, laundry_fee,
  product_variants ( size, products ( id, name, cover_image_url ) )
`

const LINE_COLUMNS_ADMIN = `
  id, start_date, end_date, rental_price, deposit_amount, laundry_fee,
  product_items ( item_code ),
  product_variants ( size, products ( id, name, cover_image_url ) )
`

function mapOrder(o: OrderRow): OrderSummary {
  return {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    shipName: o.ship_name,
    shipPhone: o.ship_phone,
    shipAddress: o.ship_address,
    shipSubdistrict: o.ship_subdistrict,
    shipDistrict: o.ship_district,
    shipProvince: o.ship_province,
    shipPostalCode: o.ship_postal_code,
    customerNote: o.customer_note,
    rentalTotal: Number(o.rental_total),
    depositTotal: Number(o.deposit_total),
    laundryTotal: Number(o.laundry_total),
    shippingFee: Number(o.shipping_fee),
    grandTotal: Number(o.grand_total),
    refundAccountName: o.refund_account_name ?? null,
    refundBank: o.refund_bank ?? null,
    refundAccountNumber: o.refund_account_number ?? null,
    lines: (o.order_items ?? [])
      .map((i) => ({
        id: i.id,
        startDate: i.start_date,
        endDate: i.end_date,
        rentalPrice: Number(i.rental_price),
        depositAmount: Number(i.deposit_amount),
        laundryFee: Number(i.laundry_fee),
        size: i.product_variants?.size ?? null,
        itemCode: i.product_items?.item_code ?? null,
        productId: i.product_variants?.products?.id ?? null,
        productName: i.product_variants?.products?.name ?? 'ชุดที่ถูกลบออกจากคลัง',
        coverImageUrl: i.product_variants?.products?.cover_image_url ?? null,
      }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  }
}

// ลูกค้า: ออเดอร์เดียว (RLS กันไม่ให้เห็นของคนอื่นอยู่แล้ว)
export async function fetchOrder(orderId: string): Promise<{ data: OrderSummary | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const { data, error } = await supabase
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items ( ${LINE_COLUMNS} )`)
    .eq('id', orderId)
    .maybeSingle()

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

  const { data, error } = await supabase
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items ( ${LINE_COLUMNS} )`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: ((data ?? []) as unknown as OrderRow[]).map(mapOrder), error: null }
}

// แอดมิน: ออเดอร์ทั้งหมด พร้อมรหัสชุดจริงที่ระบบจัดสรรให้
export async function fetchAllOrdersForAdmin(): Promise<{ data: OrderSummary[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const query = (columns: string) =>
    supabase.from('orders').select(`${columns}, order_items ( ${LINE_COLUMNS_ADMIN} )`).order('created_at', { ascending: false })

  // ลองดึงบัญชีคืนมัดจำด้วย ถ้ายังไม่ได้รัน Step 10 (ไม่มีคอลัมน์) ให้ถอยไปดึงแบบเดิม หน้าไม่พัง
  let { data, error } = await query(`${ORDER_COLUMNS}, refund_account_name, refund_bank, refund_account_number`)
  if (error && error.message.includes('refund_')) {
    ;({ data, error } = await query(ORDER_COLUMNS))
  }

  if (error) return { data: [], error: error.message }
  return { data: ((data ?? []) as unknown as OrderRow[]).map(mapOrder), error: null }
}
