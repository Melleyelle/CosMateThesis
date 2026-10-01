/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { ImageIcon, StarIcon } from '@phosphor-icons/react'

export type TopCostume = {
  productId: string
  name: string
  coverImageUrl: string | null
  bookings: number
  rating: number | null
}

// อันดับชุดที่ถูกเช่ามากที่สุด: แท่งแนวนอนเรียงจากมากไปน้อย (ป้ายตัวเลขทุกแถวเพราะมีแค่ 5 แถว)
export default function TopCostumes({ items }: { items: TopCostume[] }) {
  if (items.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-[#6B7280]">ยังไม่มีการเช่าใน 90 วันที่ผ่านมา</p>
  }
  const max = Math.max(...items.map((i) => i.bookings))

  return (
    <ol className="space-y-3.5 px-5 py-5">
      {items.map((item) => (
        <li key={item.productId}>
          <Link href={`/admin/inventory/${item.productId}/edit`} className="group flex items-center gap-3">
            <span className="h-10 w-8 flex-shrink-0 overflow-hidden rounded-md bg-[#FDE3EE]">
              {item.coverImageUrl ? (
                <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-[#E5457F]/50">
                  <ImageIcon size={14} />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-[#263544] group-hover:text-[#C92D67]">{item.name}</span>
                <span className="flex flex-shrink-0 items-center gap-2 text-xs tabular-nums text-[#5B6472]">
                  {item.rating !== null && (
                    <span className="inline-flex items-center gap-0.5">
                      <StarIcon size={11} weight="fill" className="text-[#F5B400]" />
                      {item.rating.toFixed(1)}
                    </span>
                  )}
                  <span className="font-semibold text-[#263544]">{item.bookings} ครั้ง</span>
                </span>
              </span>
              <span className="mt-1.5 block h-1.5 rounded-full bg-[#F0EFF4]">
                <span
                  className="block h-full rounded-full bg-[#263544]"
                  style={{ width: `${Math.max(6, (item.bookings / max) * 100)}%` }}
                />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
