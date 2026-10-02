import Link from 'next/link'
import { ImageIcon, StarIcon } from '@phosphor-icons/react'
import { formatBaht } from '@/utils/dateUtils'

interface CostumeGridCardProps {
  costume: {
    id: string
    name: string
    coverImageUrl?: string | null
    characterName?: string | null
    seriesName?: string | null
    minPrice?: number | null
    avgRating?: number | null
    reviewCount?: number
  }
  heldDays: number
}

export default function CostumeGridCard({ costume, heldDays }: CostumeGridCardProps) {
  return (
    <Link
      href={`/costumes/${encodeURIComponent(costume.id)}`}
      className="group block overflow-hidden rounded-2xl border-2 border-[#263544]/15 bg-white transition hover:-translate-y-1 hover:border-[#E5457F] hover:shadow-[4px_4px_0_0_#263544]"
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
      <div className="p-3 sm:p-4">
        {costume.seriesName && <p className="truncate text-sm text-[#263544]/55">{costume.seriesName}</p>}
        <h2 className="mt-1 line-clamp-2 min-h-10 font-semibold text-[#263544]">{costume.name}</h2>
        {costume.characterName && (
          <p className="mt-1 truncate text-sm text-[#263544]/60">ตัวละคร: {costume.characterName}</p>
        )}
        {costume.reviewCount != null && costume.reviewCount > 0 && costume.avgRating != null && (
          <p className="mt-2 flex items-center gap-1 text-sm text-[#263544]/70">
            <StarIcon size={14} weight="fill" className="text-[#E5A900]" />
            <span>{costume.avgRating.toFixed(1)}</span>
            <span>({costume.reviewCount} รีวิว)</span>
          </p>
        )}
        <p className="mt-3 font-bold text-[#E5457F]">
          {costume.minPrice != null ? formatBaht(costume.minPrice) : 'ยังไม่ตั้งราคา'}
          {costume.minPrice != null && <span className="text-sm font-medium text-[#263544]/60"> / {heldDays} วัน</span>}
        </p>
      </div>
    </Link>
  )
}