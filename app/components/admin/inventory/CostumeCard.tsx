import Image from 'next/image'
import Link from 'next/link'
import { ImageIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react'
import { StatusBadge } from '../ui'

export type InventoryCostume = {
  id: string
  name: string
  characterName: string | null
  seriesName: string | null
  franchiseType: string | null
  costumeCategory: string | null
  coverImageUrl: string | null
  status: 'active' | 'inactive'
  createdAt: string // ISO timestamp วันที่อัปโหลด
  totalUnits: number
  availableUnits: number
  minPrice: number | null
}

const FRANCHISE_LABEL: Record<string, string> = {
  anime: 'Anime',
  manga: 'Manga',
  game: 'Game',
  movie_series: 'Movie',
  vtuber: 'VTuber',
  original: 'Original',
}

const CATEGORY_LABEL: Record<string, string> = {
  cosplay: 'คอสเพลย์',
  fancy: 'แฟนซี',
  props_shoes: 'พร็อพ',
}

type Props = {
  costume: InventoryCostume
  onToggleStatus: (id: string, nextStatus: 'active' | 'inactive') => void
  onDelete: (id: string, name: string) => void
  statusUpdating?: boolean
  deleting?: boolean
}

// การ์ดชุดในคลัง (ฝั่งแอดมิน): พื้นเรียบ เส้นบาง — สีชมพูเหลือไว้ที่สวิตช์เปิดเช่าเท่านั้น
export default function CostumeCard({ costume, onToggleStatus, onDelete, statusUpdating, deleting }: Props) {
  const isSoldOut = costume.totalUnits > 0 && costume.availableUnits === 0
  const isLowStock = !isSoldOut && costume.availableUnits > 0 && costume.availableUnits < costume.totalUnits
  const isActive = costume.status === 'active'
  const meta = [
    costume.costumeCategory ? CATEGORY_LABEL[costume.costumeCategory] ?? costume.costumeCategory : null,
    costume.franchiseType ? FRANCHISE_LABEL[costume.franchiseType] ?? costume.franchiseType : null,
  ].filter(Boolean)

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white transition hover:border-[#C5CAD3] ${
        isActive ? 'border-[#E4E3EA]' : 'border-dashed border-[#D5D9E0]'
      }`}
    >
      <div className="relative aspect-square bg-[#F5F4F8]">
        {costume.coverImageUrl ? (
          <Image
            src={costume.coverImageUrl}
            alt={costume.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className={`object-cover transition ${isActive ? '' : 'opacity-60 grayscale-[40%]'}`}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-[#9AA3AF]">
            <ImageIcon size={28} />
            ยังไม่มีรูปหน้าปก
          </div>
        )}

        {(isSoldOut || isLowStock) && (
          <span className="absolute right-2.5 top-2.5">
            <StatusBadge tone={isSoldOut ? 'problem' : 'action'}>{isSoldOut ? 'ไม่มีตัวพร้อมเช่า' : `ไม่พร้อม ${costume.totalUnits - costume.availableUnits} ตัว`}</StatusBadge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {meta.length > 0 && <p className="mb-1 text-xs text-[#6B7280]">{meta.join(' / ')}</p>}
        <p className="truncate font-semibold text-[#263544]" title={costume.name}>
          {costume.name}
        </p>
        <p className="truncate text-sm text-[#6B7280]">{costume.seriesName || costume.characterName || '—'}</p>

        <div className="mt-3 flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular-nums text-[#263544]">
            {costume.minPrice === null ? (
              <span className="font-normal text-[#9AA3AF]">ยังไม่ตั้งราคา</span>
            ) : (
              <>
                <span className="text-xs font-normal text-[#6B7280]">เริ่ม </span>฿{costume.minPrice.toLocaleString('th-TH')}
              </>
            )}
          </span>
          <span className="text-xs tabular-nums text-[#6B7280]" title="ตัวที่พร้อมให้เช่า / ทั้งหมด">
            พร้อม {costume.availableUnits}/{costume.totalUnits} ตัว
          </span>
        </div>

        <div className="min-h-3 flex-1" />
        <div className="flex items-center gap-2 border-t border-[#EEEDF2] pt-3">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => onToggleStatus(costume.id, isActive ? 'inactive' : 'active')}
            disabled={statusUpdating}
            className="flex flex-1 items-center gap-2 text-left disabled:opacity-50"
            title="กดเพื่อสลับเปิดเช่า/งดเช่า"
          >
            <span
              className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                isActive ? 'bg-[#E5457F]' : 'bg-[#D5D9E0]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  isActive ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </span>
            <span className={`text-xs font-medium ${isActive ? 'text-[#263544]' : 'text-[#6B7280]'}`}>
              {statusUpdating ? 'กำลังบันทึก…' : isActive ? 'เปิดเช่า' : 'งดเช่า'}
            </span>
          </button>
          <Link
            href={`/admin/inventory/${costume.id}/edit`}
            className="inline-flex items-center gap-1 rounded-full border border-[#D5D9E0] px-3 py-1.5 text-xs font-semibold text-[#263544] transition hover:border-[#263544]"
          >
            <PencilSimpleIcon size={12} weight="bold" />
            แก้ไข
          </Link>
          <button
            type="button"
            onClick={() => onDelete(costume.id, costume.name)}
            disabled={deleting}
            className="rounded-full p-1.5 text-[#9AA3AF] transition hover:bg-[#FDE8E8] hover:text-[#B42318] disabled:opacity-50"
            aria-label={`ลบ ${costume.name}`}
            title="ลบชุดนี้ออกจากคลัง"
          >
            <TrashIcon size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
