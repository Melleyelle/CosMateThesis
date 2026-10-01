/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { ImageIcon } from '@phosphor-icons/react'
import type { CatalogCostume } from '@/utils/customer/fetchCatalog'
import { COLOR_HEX } from '@/utils/customer/filterOptions'
import { formatBaht } from '@/utils/dateUtils'
import FavoriteButton from './FavoriteButton'
import { RatingBadge } from './StarRating'

// การ์ดชุดตามดีไซน์: รูปกรอบกรมท่ามุมโค้ง / จุดสี / ชื่อเรื่อง / ชื่อชุด / ไซส์ / ราคาชมพู + ปุ่มหัวใจ
export default function CostumeGridCard({ costume, heldDays }: { costume: CatalogCostume; heldDays: number }) {
  const outOfStock = costume.totalUnits > 0 && costume.availableUnits === 0
  const href = `/costumes/${costume.id}`

  return (
    <div className="group flex flex-col">
      <Link
        href={href}
        className="relative block aspect-[4/5] overflow-hidden rounded-2xl border-2 border-[#263544] bg-[#FDE3EE]"
      >
        {costume.coverImageUrl ? (
          <img
            src={costume.coverImageUrl}
            alt={costume.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#E5457F]/40">
            <ImageIcon size={48} />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-x-0 bottom-0 bg-[#263544]/85 py-1.5 text-center text-xs font-semibold text-white">
            ไม่พร้อมให้เช่าชั่วคราว
          </div>
        )}
      </Link>

      <div className="mt-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {costume.colorKeys.length > 0 && (
            <div className="mb-1 flex gap-1">
              {costume.colorKeys.slice(0, 5).map((key) => (
                <span
                  key={key}
                  className="h-4 w-4 rounded-full border border-[#263544]/40"
                  style={{ backgroundColor: COLOR_HEX[key] }}
                />
              ))}
            </div>
          )}
          {costume.seriesName && (
            <p className="truncate text-[11px] text-[#263544]/50">{costume.seriesName}</p>
          )}
          <Link href={href} className="line-clamp-2 font-semibold leading-snug text-[#263544] hover:text-[#E5457F]">
            {costume.name}
          </Link>
          {(costume.sizes.length > 0 || costume.reviewCount > 0) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#263544]/60">
              {costume.sizes.length > 0 && <span>ไซส์: {costume.sizes.join(', ')}</span>}
              {costume.avgRating !== null && <RatingBadge avg={costume.avgRating} count={costume.reviewCount} />}
            </div>
          )}
          <p className="mt-1 text-lg font-bold text-[#E5457F]">
            {costume.minPrice !== null ? `${formatBaht(costume.minPrice)} / ${heldDays} วัน` : 'ยังไม่ตั้งราคา'}
          </p>
        </div>
        <FavoriteButton productId={costume.id} />
      </div>
    </div>
  )
}
