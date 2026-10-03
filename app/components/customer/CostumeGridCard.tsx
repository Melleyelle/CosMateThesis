import Link from 'next/link'
import { ImageIcon, StarIcon } from '@phosphor-icons/react'
import { formatBaht } from '@/utils/dateUtils'
import { COLOR_OPTIONS } from '@/utils/customer/filterOptions'

const COLOR_BY_KEY = Object.fromEntries(COLOR_OPTIONS.map((c) => [c.key, c]))

interface CostumeGridCardProps {
  costume: {
    id: string
    name: string
    coverImageUrl?: string | null
    seriesName?: string | null
    colorKeys?: string[]
    minPrice?: number | null
    avgRating?: number | null
    reviewCount?: number
  }
  heldDays: number
}

export default function CostumeGridCard({ costume, heldDays }: CostumeGridCardProps) {
  const colors = (costume.colorKeys ?? []).map((k) => COLOR_BY_KEY[k]).filter(Boolean)

  return (
    <Link
      href={`/costumes/${encodeURIComponent(costume.id)}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-[#263544] bg-white transition hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#263544]"
    >
      <div className="aspect-[3/4] overflow-hidden bg-[#FDE3EE]">
        {costume.coverImageUrl ? (
          <img
            src={costume.coverImageUrl}
            alt={costume.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#E5457F]/50">
            <ImageIcon size={48} />
          </div>
        )}
      </div>
      {/* ทุกบรรทัดจองที่ไว้เสมอ แม้ข้อมูลไม่ครบ — การ์ดทุกใบจึงสูงเท่ากัน */}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div
          className="mb-2 flex h-6 gap-1.5 overflow-hidden"
          aria-label={colors.length > 0 ? `สี: ${colors.map((c) => c.label).join(', ')}` : undefined}
        >
          {colors.map((c) => (
            <span
              key={c.key}
              title={c.label}
              className="h-6 w-6 shrink-0 rounded-full border-[1.5px] border-[#263544]"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        <p className="h-5 truncate text-sm leading-5 text-[#263544]/55">{costume.seriesName}</p>
        <h2 className="mt-0.5 line-clamp-2 min-h-[2.75em] text-lg font-bold leading-snug text-[#263544] sm:text-xl">
          {costume.name}
        </h2>
        <p className="mt-1.5 flex h-6 items-center gap-1 text-base text-[#263544]/80">
          {costume.reviewCount != null && costume.reviewCount > 0 && costume.avgRating != null && (
            <>
              <StarIcon size={16} weight="fill" className="text-[#F5B400]" />
              <span>{costume.avgRating.toFixed(1)}</span>
              <span>({costume.reviewCount} รีวิว)</span>
            </>
          )}
        </p>
        <p className="mt-auto pt-2 text-lg font-bold text-[#E5457F] sm:text-xl">
          {costume.minPrice != null ? `${formatBaht(costume.minPrice)} / ${heldDays} วัน` : 'ยังไม่ตั้งราคา'}
        </p>
      </div>
    </Link>
  )
}
