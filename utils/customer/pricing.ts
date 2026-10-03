// มัดจำตามยอดค่าเช่ารวม — กฎเดียวใช้ได้ทุกกรณี (เช่าทั้งชุด / เลือกแยกชิ้น / พร็อพเดี่ยว)
// ยอดรวมต่ำกว่า DEPOSIT_FREE_BELOW ไม่เก็บมัดจำ ตั้งแต่นั้นขึ้นไปเช็กตาม tier
// TODO: ตัวเลข tier ยกเว้น 501–1,000 = ฿250 เป็นค่าตั้งต้น — แก้ให้ตรงตารางจริงที่นี่ที่เดียว
export const DEPOSIT_FREE_BELOW = 250

export const DEPOSIT_TIERS: { min: number; max: number | null; deposit: number }[] = [
  { min: 250, max: 500, deposit: 150 },
  { min: 501, max: 1000, deposit: 250 },
  { min: 1001, max: 2000, deposit: 500 },
  { min: 2001, max: null, deposit: 1000 },
]

export function depositForRental(rentalTotal: number): { amount: number } {
  if (rentalTotal < DEPOSIT_FREE_BELOW) return { amount: 0 }
  // tier เรียงจากน้อยไปมาก → อันแรกที่ยอดไม่เกินเพดาน (ยอดมีเศษสตางค์เช่น 500.5 จึงตกไป tier ถัดไป)
  const tier = DEPOSIT_TIERS.find((t) => rentalTotal <= (t.max ?? Infinity)) ?? DEPOSIT_TIERS[DEPOSIT_TIERS.length - 1]
  return { amount: tier.deposit }
}
