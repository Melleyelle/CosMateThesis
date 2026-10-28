import { createClient } from '@/utils/client'
import { pieceDeposit } from '@/utils/rentalTiers'
import { calcRentalPrice } from '@/utils/customer/rentalPrice'
import type { BookingSettings } from '@/utils/customer/bookingSettings'
import type { VariantSummary } from '@/utils/customer/fetchVariantSummaries'

// ชิ้นส่วนที่เช่าแยกได้ (product_inclusions ที่ตั้ง rental_price ไว้)
export type PieceInfo = {
  id: string
  productId: string
  name: string
  price: number | null // null = ชิ้นนี้ไม่เปิดให้เช่าแยก
  laundryFee: number
  displayOrder: number
  isShoe: boolean // รองเท้าที่มากับชุด (Step 19) — ราคานี้หักออกเมื่อเช่าทั้งชุดแต่ไม่รับรองเท้า
}

type PieceRow = {
  id: string
  product_id: string
  name: string
  rental_price: number | string | null
  laundry_fee: number | string | null
  display_order: number | null
  shoe_product_id?: string | null
}

export async function fetchPieces(productIds: string[]): Promise<Record<string, PieceInfo>> {
  const supabase = createClient()
  const ids = Array.from(new Set(productIds))
  if (!supabase || ids.length === 0) return {}

  const columns = 'id, product_id, name, rental_price, laundry_fee, display_order'
  let res: { data: unknown[] | null; error: unknown } = await supabase
    .from('product_inclusions')
    .select(`${columns}, shoe_product_id`)
    .in('product_id', ids)
  // ยังไม่ได้รัน Step 19 → ดึงแบบเดิม (ไม่มีรองเท้าที่มากับชุด)
  if (res.error) res = await supabase.from('product_inclusions').select(columns).in('product_id', ids)
  const { data, error } = res
  if (error) return {}

  const result: Record<string, PieceInfo> = {}
  for (const r of (data ?? []) as PieceRow[]) {
    result[r.id] = {
      id: r.id,
      productId: r.product_id,
      name: r.name,
      price: r.rental_price == null ? null : Number(r.rental_price),
      laundryFee: Number(r.laundry_fee ?? 0),
      displayOrder: r.display_order ?? 0,
      isShoe: !!r.shoe_product_id,
    }
  }
  return result
}

export type LinePrice = {
  rental: number // ค่าเช่ารวมของรายการ (วันแรก + วันเพิ่ม)
  baseRental: number
  dayRate: number
  extraFee: number
  rentalDays: number
  deposit: number
  laundry: number
  pieceNames: string[] | null // null = เช่าทั้งชุด
  shoeDiscount: number // เช่าทั้งชุดแต่ไม่รับรองเท้า: ส่วนที่หักออกจากค่าเช่าวันแรก (0 = ไม่หัก)
  invalid: boolean // ชิ้นที่เลือกไว้ถูกลบหรือปิดเช่าแยกไปแล้ว / รองเท้าไม่ตรงกับที่เลือก
}

// ราคาต่อรายการ: ทั้งชุดใช้ราคาไซส์ / แยกชิ้นใช้ผลรวมราคาชิ้น + ค่าวันเพิ่ม
// มัดจำไม่ขึ้นตามจำนวนวัน และขึ้นกับชุดจริงตัวที่จะได้ (Step 21) → ส่ง quotedDeposit จาก quoteDeposits() มา
//   ไม่มี (ยังโหลดไม่เสร็จ/ยังไม่ได้รัน SQL) = ใช้มัดจำของไซส์ · แยกชิ้นคิดสัดส่วนเหมือน public.piece_deposit()
// รองเท้าที่มากับชุด: ทั้งชุดไม่ส่ง shoeVariantId = ไม่รับรองเท้า หักราคาชิ้นรองเท้า (มัดจำเท่าเดิม)
export function priceLine(
  variant: VariantSummary,
  pieceIds: string[] | undefined,
  pieces: Record<string, PieceInfo>,
  rentalDays: number,
  settings: BookingSettings,
  shoeVariantId?: string,
  quotedDeposit?: number | null,
): LinePrice {
  const shoePiece = Object.values(pieces).find((p) => p.productId === variant.productId && p.isShoe)

  if (!pieceIds || pieceIds.length === 0) {
    const shoeDiscount = shoePiece && !shoeVariantId ? Math.min(shoePiece.price ?? 0, variant.packagePrice) : 0
    const p = calcRentalPrice({ baseRental: variant.packagePrice - shoeDiscount, rentalDays, isPieces: false, settings })
    return {
      rental: p.rentalPrice,
      baseRental: p.baseRental,
      dayRate: p.dayRate,
      extraFee: p.extraFee,
      rentalDays,
      deposit: quotedDeposit ?? variant.depositAmount,
      laundry: variant.laundryFee,
      pieceNames: null,
      shoeDiscount,
      // เลือกรองเท้ามาแต่ชุดไม่มีรองเท้าแล้ว (แอดมินเอาออก)
      invalid: !!shoeVariantId && !shoePiece,
    }
  }

  const chosen = pieceIds.map((id) => pieces[id])
  // ติ๊กรองเท้าต้องมีไซส์รองเท้า และมีไซส์รองเท้าได้ต่อเมื่อติ๊กรองเท้า
  const shoeChosen = chosen.some((p) => p?.isShoe)
  const invalid =
    chosen.some((p) => !p || p.productId !== variant.productId || p.price == null) || shoeChosen !== !!shoeVariantId
  const valid = chosen.filter((p): p is PieceInfo => !!p && p.price != null).sort((a, b) => a.displayOrder - b.displayOrder)
  const base = valid.reduce((sum, p) => sum + (p.price ?? 0), 0)
  const p = calcRentalPrice({ baseRental: base, rentalDays, isPieces: true, settings })
  return {
    rental: p.rentalPrice,
    baseRental: p.baseRental,
    dayRate: p.dayRate,
    extraFee: p.extraFee,
    rentalDays,
    deposit: quotedDeposit ?? pieceDeposit(variant.depositAmount, variant.packagePrice, base),
    laundry: valid.reduce((sum, p) => sum + p.laundryFee, 0),
    pieceNames: valid.map((p) => p.name),
    shoeDiscount: 0,
    invalid,
  }
}
