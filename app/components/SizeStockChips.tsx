// app/components/SizeStockChips.tsx
// บรรทัดไซส์บนการ์ดสินค้า: "เหลือ S 2 ตัว · M 1 ตัว" ตัวหนังสือสีเทาบรรทัดเดียว
// เดิมเป็นแคปซูลต่อไซส์ ซึ่งทำให้การ์ดข้อมูลแน่นเกินไป · แสดงเฉพาะไซส์ที่ยังเช่าได้
import type { SizeStock } from '@/utils/sizeStock'
import { totalAvailable } from '@/utils/sizeStock'

type Props = {
  sizes: SizeStock[]
  /** จำนวนไซส์สูงสุดที่แสดง เกินจากนี้รวมเป็น "+n" (การ์ดแคบบนมือถือ) */
  max?: number
}

export default function SizeStockChips({ sizes, max = 4 }: Props) {
  if (sizes.length === 0) return null

  if (totalAvailable(sizes) === 0) {
    return <p className="truncate text-body-sm text-muted">หมดชั่วคราวทุกไซส์</p>
  }

  const available = sizes.filter((s) => s.availableCount > 0)
  const shown = available.slice(0, max)
  const hidden = available.length - shown.length

  return (
    <p className="truncate text-body-sm text-muted">
      เหลือ {shown.map((s) => `${s.size} ${s.availableCount} ตัว`).join(' · ')}
      {hidden > 0 && ` +${hidden} ไซส์`}
    </p>
  )
}
