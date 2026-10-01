/* eslint-disable @next/next/no-img-element */
import { ChatCircleTextIcon, SealCheckIcon } from '@phosphor-icons/react'
import { StarDisplay } from './StarRating'
import { SIZE_FIT_LABEL, type Review } from '@/utils/customer/reviews'
import { parseISODate } from '@/utils/dateUtils'

function monthYear(iso: string) {
  return parseISODate(iso).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })
}

export default function ReviewCard({ review, onImageClick }: { review: Review; onImageClick?: (url: string) => void }) {
  const facts = [
    review.size && `เช่าไซส์ ${review.size}`,
    review.sizeFit && `ไซส์${SIZE_FIT_LABEL[review.sizeFit]}`,
    review.heightCm && `ส่วนสูง ${review.heightCm} ซม.`,
  ].filter(Boolean)

  return (
    <article className="border-b border-gray-100 py-5 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FDE3EE] text-sm font-bold text-[#E5457F]">
          {review.reviewerName.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#263544]">{review.reviewerName}</p>
          <div className="flex items-center gap-2">
            <StarDisplay value={review.rating} size={14} />
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#4CAF7A]">
              <SealCheckIcon size={13} weight="fill" />
              ผู้เช่าจริง
            </span>
          </div>
        </div>
        <span className="ml-auto text-xs text-[#263544]/40">
          {review.rentedOn ? `เช่าเมื่อ ${monthYear(review.rentedOn)}` : ''}
        </span>
      </div>

      {facts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <span key={f as string} className="rounded-md bg-[#EDE6FA] px-2 py-0.5 text-[11px] font-medium text-[#263544]">
              {f}
            </span>
          ))}
        </div>
      )}

      {review.comment && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#263544]/85">{review.comment}</p>
      )}

      {review.imageUrls.length > 0 && (
        <div className="mt-3 flex gap-2">
          {review.imageUrls.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => onImageClick?.(url)}
              className="h-24 w-20 overflow-hidden rounded-xl border border-gray-200 transition hover:opacity-90"
            >
              <img src={url} alt="รูปจากผู้รีวิว" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {review.adminReply && (
        <div className="mt-3 rounded-xl border-l-4 border-[#E5457F] bg-[#FFFAFC] px-3 py-2">
          <p className="flex items-center gap-1 text-xs font-bold text-[#E5457F]">
            <ChatCircleTextIcon size={14} weight="fill" />
            ตอบกลับจากร้าน
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-[#263544]/80">{review.adminReply}</p>
        </div>
      )}
    </article>
  )
}
