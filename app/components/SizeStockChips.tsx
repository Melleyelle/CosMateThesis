// app/components/SizeStockChips.tsx
// แถบไซส์บนการ์ดสินค้า: "S 2 ตัว · M เหลือ 1 · L หมด"
// สถานะบอกด้วยข้อความเสมอ ไม่ใช้สีอย่างเดียว (WCAG) · สีตาม design system
import type { SizeStock } from '@/utils/sizeStock'
import { totalAvailable } from '@/utils/sizeStock'

type Props = {
  sizes: SizeStock[]
  /** จำนวนไซส์สูงสุดที่แสดง เกินจากนี้รวมเป็น "+n ไซส์" (การ์ดแคบบนมือถือ) */
  max?: number
}

export default function SizeStockChips({ sizes, max = 4 }: Props) {
  if (sizes.length === 0) return null

  if (totalAvailable(sizes) === 0) {
    return (
      <p className="text-xs font-medium text-[#6E6E6E]">หมดชั่วคราวทุกไซส์</p>
    )
  }

  const shown = sizes.slice(0, max)
  const hidden = sizes.length - shown.length

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="ไซส์และจำนวนที่มี">
      {shown.map(({ size, availableCount }) => {
        const soldOut = availableCount === 0
        const low = availableCount === 1
        return (
          <li
            key={size}
            className={[
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-5',
              soldOut
                ? 'border-[#E5E5E5] bg-[#F7F7F7] text-[#6E6E6E]'
                : low
                  ? 'border-[#FAD2E1] bg-[#FDEEF3] text-[#B8285D]'
                  : 'border-[#E5E5E5] bg-white text-[#2E2E2E]',
            ].join(' ')}
          >
            <span className={`font-semibold ${soldOut ? 'line-through' : ''}`}>{size}</span>
            <span>{soldOut ? 'หมด' : low ? 'เหลือ 1' : `${availableCount} ตัว`}</span>
          </li>
        )
      })}
      {hidden > 0 && (
        <li className="inline-flex items-center rounded-full px-1 text-xs leading-5 text-[#6E6E6E]">
          +{hidden} ไซส์
        </li>
      )}
    </ul>
  )
}