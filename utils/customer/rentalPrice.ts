import type { BookingSettings } from '@/utils/customer/bookingSettings'

export type RentalPrice = {
  rentalDays: number
  baseRental: number // ราคาวันแรก: ราคาไซส์ (ทั้งชุด) หรือผลรวมราคาชิ้นที่เลือก (แยกชิ้น)
  dayRate: number // ค่าเช่าเพิ่มต่อวัน ตั้งแต่วันที่ 2
  extraFee: number // (rentalDays − 1) × dayRate
  rentalPrice: number // baseRental + extraFee
}

/**
 * ค่าเช่าของหนึ่งรายการ — ต้องตรงกับที่ create_booking() คำนวณในฐานข้อมูลทุกบาท
 *   ทั้งชุด:  dayRate = extra_day_rate
 *   แยกชิ้น: dayRate = ceil(min(baseRental × piece_extra_day_percent / 100, extra_day_rate))
 * ปัดขึ้นที่อัตราต่อวันก่อนคูณจำนวนวัน ยอดทุกตัวจึงเป็นบาทเต็มเสมอ
 * ยอดที่บันทึกจริงคำนวณในฐานข้อมูลเท่านั้น ฟังก์ชันนี้ใช้แสดงผล
 */
export function calcRentalPrice({
  baseRental,
  rentalDays,
  isPieces,
  settings,
}: {
  baseRental: number
  rentalDays: number
  isPieces: boolean
  settings: Pick<BookingSettings, 'extraDayRate' | 'pieceExtraDayPercent'>
}): RentalPrice {
  const dayRate = isPieces
    ? Math.ceil(Math.min((baseRental * settings.pieceExtraDayPercent) / 100, settings.extraDayRate))
    : settings.extraDayRate
  const extraFee = Math.max(0, rentalDays - 1) * dayRate
  return { rentalDays, baseRental, dayRate, extraFee, rentalPrice: baseRental + extraFee }
}

// ค่าตั้งราคาแยกชิ้น (SQL Step 30 · app_settings)
export type PieceSettings = { markupPercent: number; minPrice: number; roundTo: number }
export const DEFAULT_PIECE_SETTINGS: PieceSettings = { markupPercent: 120, minPrice: 100, roundTo: 10 }

// price = rental_price · weight = price_weight (ระดับชิ้น) · ทั้งคู่ตามฐานข้อมูล
//   มี price + มี weight = ราคาตามระบบ · มี price + ไม่มี weight = ราคาตายตัว · ไม่มี price = ไม่เปิดเช่าแยก (weight ยังนับในสัดส่วน)
export type PieceRule = { id: string; price: number | null; weight: number | null }

// ราคาชิ้นที่เปิดเช่าแยก เมื่อค่าเช่าเต็มชุด = unitPrice — ตรงกับ public.piece_prices()
export function piecePrices(rules: PieceRule[], unitPrice: number, settings: PieceSettings): Record<string, number> {
  const totalWeight = rules.reduce((sum, r) => sum + (r.weight ?? 0), 0)
  const fixed = rules.reduce((sum, r) => sum + (r.weight == null ? (r.price ?? 0) : 0), 0)
  const pool = Math.max(unitPrice - fixed, 0)
  const { markupPercent, minPrice, roundTo } = settings
  const result: Record<string, number> = {}
  for (const r of rules) {
    if (r.price == null) continue
    result[r.id] =
      r.weight == null
        ? r.price
        : Math.max(minPrice, Math.ceil((pool * r.weight * markupPercent) / (totalWeight * 100 * roundTo)) * roundTo)
  }
  return result
}

// ยอดแยกชิ้นไม่เกินค่าเช่าทั้งชุดของตัวนั้น — ตรงกับ public.pieces_rent()
// shoePrice = ราคารองเท้าที่ไม่ได้ติ๊ก (เพดานคือค่าเช่าทั้งชุดแบบไม่รับรองเท้า)
export function capPiecesTotal(total: number, unitPrice: number, shoePrice = 0): number {
  if (unitPrice <= 0) return total
  return Math.min(total, unitPrice - shoePrice > 0 ? unitPrice - shoePrice : unitPrice)
}
