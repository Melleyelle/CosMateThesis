import Link from 'next/link'
import { ImageIcon, StarIcon } from '@phosphor-icons/react'
import { formatBaht } from '@/utils/dateUtils'
import { COLOR_OPTIONS } from '@/utils/customer/filterOptions'
import SizeStockChips from '@/app/components/SizeStockChips'
import { pricesVary, type SizeStock } from '@/utils/sizeStock'

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
  /** ไซส์และจำนวนที่พร้อมเช่า · undefined = กำลังโหลด (จองพื้นที่ไว้ การ์ดไม่กระตุก) */
  sizes?: SizeStock[]
  /** v2 = design system ใหม่ (สี ink ขนาดกะทัดรัด) · ทยอยย้ายทีละหน้า หน้าที่ยังไม่ย้ายใช้ค่าเดิม
   *  gumroad = ทดลอง design v2 แนว Gumroad (เส้น 1px · ยก + เงาแข็งเฉพาะ hover) */
  variant?: 'legacy' | 'v2' | 'gumroad'
}

const s = {
  root: 'rounded-2xl border-2 border-[#263544] bg-white transition hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#263544]',
  media: 'bg-[#FDE3EE]',
  placeholder: 'text-[#E5457F]/50',
  swatch: 'border-[1.5px] border-[#263544]',
  series: 'h-5 text-sm leading-5 text-[#263544]/55',
  name: 'text-lg leading-snug text-[#263544] sm:text-xl',
  rating: 'text-base text-[#263544]/80',
  price: 'text-lg text-brand sm:text-xl',
}

const MAX_SWATCHES = 4

// ใช้ร่วมกันทั้งการ์ด legacy และ v2 — ถ้าราคาต่างกันตามไซส์ ขึ้นต้นด้วย "เริ่ม" ลูกค้าจะไม่คิดว่าทุกไซส์ราคานี้
function priceLabel(minPrice: number | null | undefined, heldDays: number, sizes?: SizeStock[]) {
  if (minPrice == null) return 'ยังไม่ตั้งราคา'
  return `${sizes && pricesVary(sizes) ? 'เริ่ม ' : ''}${formatBaht(minPrice)} / ${heldDays} วัน`
}

// คะแนนรีวิวแสดงทุกการ์ด (เนื้อหาเท่ากันทุกใบ) — ยังไม่มีรีวิวแสดง 0.0
function hasRating(costume: CostumeGridCardProps['costume']) {
  return (costume.reviewCount ?? 0) > 0 && costume.avgRating != null
}

function ratingValue(costume: CostumeGridCardProps['costume']) {
  return hasRating(costume) ? costume.avgRating!.toFixed(1) : '0.0'
}

/** สัดส่วนรูปของการ์ด v2 — export ให้โครงการ์ดตอนโหลด (skeleton) สูงเท่าการ์ดจริง */
export const CARD_MEDIA = 'aspect-[4/5] max-h-[50vh]'

export default function CostumeGridCard({ costume, heldDays, sizes, variant = 'legacy' }: CostumeGridCardProps) {
  if (variant !== 'legacy')
    return <CostumeGridCardV2 costume={costume} heldDays={heldDays} sizes={sizes} gumroad={variant === 'gumroad'} />
  const colors = (costume.colorKeys ?? []).map((k) => COLOR_BY_KEY[k]).filter(Boolean)

  return (
    <Link
      href={`/costumes/${encodeURIComponent(costume.id)}`}
      className={`group flex h-full flex-col overflow-hidden ${s.root}`}
    >
      <div className={`aspect-[3/4] overflow-hidden ${s.media}`}>
        {costume.coverImageUrl ? (
          <img
            src={costume.coverImageUrl}
            alt={costume.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className={`flex h-full items-center justify-center ${s.placeholder}`}>
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
              className={`h-6 w-6 shrink-0 rounded-full ${s.swatch}`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        <p className={`truncate ${s.series}`}>{costume.seriesName}</p>
        <h2 className={`mt-0.5 line-clamp-2 min-h-[2.75em] font-bold ${s.name}`}>
          {costume.name}
        </h2>
        <p className={`mt-1.5 flex h-6 items-center gap-1 ${s.rating}`}>
          <StarIcon size={16} weight="fill" className="text-[#F5B400]" />
          <span>{ratingValue(costume)}</span>
          <span>({costume.reviewCount ?? 0} รีวิว)</span>
        </p>
        {/* ไซส์ที่ว่าง เป็นตัวหนังสือสีเทาบรรทัดเดียว — ลูกค้าไม่ต้องกดเข้าไปดูทีละชุด แต่ไม่แย่งสายตาจากชื่อและราคา */}
        <div className="mt-1 h-6">
          {sizes && <SizeStockChips sizes={sizes} max={3} />}
        </div>
        <p className={`mt-auto pt-2 font-bold ${s.price}`}>
          {priceLabel(costume.minPrice, heldDays, sizes)}
        </p>
      </div>
    </Link>
  )
}

// การ์ดตาม design system ใหม่: เส้นหนา + เงาแข็งตอน hover สี ink
// สีของชุดลอยอยู่มุมล่างของรูป และคะแนนรีวิวอยู่แถวเดียวกับราคา — ไม่มีแถวว่างที่จองไว้เปล่า ๆ การ์ดจึงกระชับ
// gumroad: เส้น 1px · hover ยกซ้ายบน + เงาแข็ง (.lift) · รูปคั่นด้วยเส้น 1px เหมือนกรอบรูป
function CostumeGridCardV2({
  costume,
  heldDays,
  sizes,
  gumroad = false,
}: Omit<CostumeGridCardProps, 'variant'> & { gumroad?: boolean }) {
  const colors = (costume.colorKeys ?? []).map((k) => COLOR_BY_KEY[k]).filter(Boolean)
  const shown = colors.slice(0, MAX_SWATCHES)
  const rated = hasRating(costume)

  return (
    <Link
      href={`/costumes/${encodeURIComponent(costume.id)}`}
      className={`focus-ring group flex h-full flex-col overflow-hidden rounded-card bg-surface ${
        gumroad
          ? 'lift border border-line'
          : 'border-2 border-ink transition hover:-translate-y-1 hover:shadow-[4px_4px_0_0_var(--color-ink)] motion-reduce:hover:translate-y-0'
      }`}
    >
      {/* 4:5 และสูงไม่เกินครึ่งจอ — จอเตี้ยยังเห็นการ์ดทั้งใบ ครอปแล้วเน้นส่วนบน (หน้า/ช่วงตัว) ของรูปชุด */}
      <div
        className={`relative overflow-hidden ${CARD_MEDIA} ${gumroad ? 'border-b border-line bg-sunken' : 'bg-brand-subtle'}`}
      >
        {costume.coverImageUrl ? (
          <img
            src={costume.coverImageUrl}
            alt={costume.name}
            className="h-full w-full object-cover object-[center_25%] transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className={`flex h-full items-center justify-center ${gumroad ? 'text-muted' : 'text-brand/50'}`}>
            <ImageIcon size={48} />
          </div>
        )}
        {/* พื้นขาวโปร่งใต้จุดสี ให้อ่านออกทั้งบนรูปสว่างและรูปมืด (จุดสีขาวบนพื้นขาวก็ยังเห็นขอบ) */}
        {shown.length > 0 && (
          <div
            className={`absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-surface/90 px-1.5 py-1 backdrop-blur-sm ${
              gumroad ? 'border border-line' : 'shadow-raised'
            }`}
            aria-label={`สี: ${colors.map((c) => c.label).join(', ')}`}
          >
            {shown.map((c) => (
              <span
                key={c.key}
                title={c.label}
                className="h-4 w-4 shrink-0 rounded-full border border-black/25"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {colors.length > shown.length && (
              <span className="px-0.5 text-caption font-semibold leading-none text-secondary">
                +{colors.length - shown.length}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="h-[22px] truncate text-body-sm text-muted">{costume.seriesName}</p>
        <h2 className="mt-0.5 line-clamp-2 min-h-[2.75em] text-h3 font-bold text-ink">{costume.name}</h2>
        {/* ไซส์ที่ว่าง เป็นตัวหนังสือสีเทาบรรทัดเดียว — ลูกค้าไม่ต้องกดเข้าไปดูทีละชุด แต่ไม่แย่งสายตาจากชื่อและราคา */}
        <div className="mt-1 h-6">{sizes && <SizeStockChips sizes={sizes} max={3} />}</div>
        {/* การ์ดแคบบนมือถือ: คะแนนตกลงบรรทัดใหม่แทนการบีบราคา */}
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 pt-2">
          <p className="text-h3 font-bold text-brand">
            {priceLabel(costume.minPrice, heldDays, sizes)}
          </p>
          {/* แสดงทุกการ์ดให้เนื้อหาเท่ากัน · ยังไม่มีรีวิว = 0.0 (0) ดาวสีเดียวกัน */}
          <p
            className="flex shrink-0 items-center gap-1 text-body-sm text-secondary"
            aria-label={rated ? `คะแนน ${ratingValue(costume)} จาก ${costume.reviewCount} รีวิว` : 'ยังไม่มีรีวิว'}
          >
            <StarIcon size={14} weight="fill" className="text-[#F5B400]" />
            <span className="font-semibold text-ink">{ratingValue(costume)}</span>
            <span>({costume.reviewCount ?? 0})</span>
          </p>
        </div>
      </div>
    </Link>
  )
}