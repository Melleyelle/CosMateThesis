import { createClient } from '@/utils/client'
import { depositForRental } from '@/utils/customer/pricing'
import type { VariantSummary } from '@/utils/customer/fetchVariantSummaries'

// ชิ้นส่วนที่เช่าแยกได้ (product_inclusions ที่ตั้ง rental_price ไว้)
export type PieceInfo = {
  id: string
  productId: string
  name: string
  price: number | null // null = ชิ้นนี้ไม่เปิดให้เช่าแยก
  laundryFee: number
  displayOrder: number
}

export async function fetchPieces(productIds: string[]): Promise<Record<string, PieceInfo>> {
  const supabase = createClient()
  const ids = Array.from(new Set(productIds))
  if (!supabase || ids.length === 0) return {}

  const { data, error } = await supabase
    .from('product_inclusions')
    .select('id, product_id, name, rental_price, laundry_fee, display_order')
    .in('product_id', ids)
  if (error) return {}

  const result: Record<string, PieceInfo> = {}
  for (const r of data ?? []) {
    result[r.id] = {
      id: r.id,
      productId: r.product_id,
      name: r.name,
      price: r.rental_price == null ? null : Number(r.rental_price),
      laundryFee: Number(r.laundry_fee ?? 0),
      displayOrder: r.display_order ?? 0,
    }
  }
  return result
}

export type LinePrice = {
  rental: number
  deposit: number
  laundry: number
  pieceNames: string[] | null // null = เช่าทั้งชุด
  invalid: boolean // ชิ้นที่เลือกไว้ถูกลบหรือปิดเช่าแยกไปแล้ว
}

// ราคาต่อรายการ: ทั้งชุดใช้ราคาไซส์ / แยกชิ้นใช้ผลรวมราคาชิ้น + มัดจำตาม tier + ค่าซักรายชิ้น
// ต้องตรงกับที่ create_booking() คำนวณในฐานข้อมูล
export function priceLine(
  variant: VariantSummary,
  pieceIds: string[] | undefined,
  pieces: Record<string, PieceInfo>,
): LinePrice {
  if (!pieceIds || pieceIds.length === 0) {
    return {
      rental: variant.packagePrice,
      deposit: variant.depositAmount,
      laundry: variant.laundryFee,
      pieceNames: null,
      invalid: false,
    }
  }

  const chosen = pieceIds.map((id) => pieces[id])
  const invalid = chosen.some((p) => !p || p.productId !== variant.productId || p.price == null)
  const valid = chosen.filter((p): p is PieceInfo => !!p && p.price != null).sort((a, b) => a.displayOrder - b.displayOrder)
  const rental = valid.reduce((sum, p) => sum + (p.price ?? 0), 0)
  return {
    rental,
    deposit: depositForRental(rental).amount,
    laundry: valid.reduce((sum, p) => sum + p.laundryFee, 0),
    pieceNames: valid.map((p) => p.name),
    invalid,
  }
}
