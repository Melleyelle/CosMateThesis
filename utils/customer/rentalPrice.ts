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
