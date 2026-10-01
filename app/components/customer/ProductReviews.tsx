'use client'

import { useEffect, useState } from 'react'
import { ChatCircleDotsIcon, StarIcon } from '@phosphor-icons/react'
import { createClient } from '@/utils/client'
import { formatDateTime } from '@/utils/dateUtils'

interface ProductReview {
  id: string
  rating: number
  comment: string | null
  admin_reply: string | null
  created_at: string
}

export default function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ProductReview[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadReviews() {
      const supabase = createClient()
      if (!supabase) {
        if (!cancelled) {
          setLoadError(true)
          setLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('product_reviews')
        .select('id, rating, comment, admin_reply, created_at')
        .eq('product_id', productId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(50)

      if (cancelled) return
      if (error) setLoadError(true)
      else setReviews((data ?? []) as ProductReview[])
      setLoading(false)
    }

    loadReviews()
    return () => {
      cancelled = true
    }
  }, [productId])

  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length
    : 0

  return (
    <section id="reviews" className="mt-12 scroll-mt-24 border-t border-[#263544]/10 pt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#263544]">รีวิวจากผู้เช่า</h2>
          <p className="mt-1 text-sm text-[#263544]/60">
            {reviews.length > 0 ? `${reviews.length} รีวิว` : 'ความคิดเห็นจากผู้ที่เคยเช่าชุดนี้'}
          </p>
        </div>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#263544]">
            <StarIcon size={18} weight="fill" className="text-[#E5A900]" />
            {average.toFixed(1)} / 5
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="กำลังโหลดรีวิว">
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : loadError ? (
        <p role="status" className="rounded-xl bg-[#F7F7F8] px-5 py-8 text-center text-sm text-[#263544]/60">
          ยังโหลดรีวิวไม่ได้ในขณะนี้
        </p>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl bg-[#F7F7F8] px-5 py-10 text-center">
          <ChatCircleDotsIcon size={28} className="mx-auto text-[#E5457F]/70" />
          <p className="mt-2 text-sm text-[#263544]/60">ยังไม่มีรีวิวชุดนี้</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#263544]/10">
          {reviews.map((review) => (
            <li key={review.id} className="py-5 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1" aria-label={`คะแนน ${review.rating} จาก 5`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <StarIcon
                      key={index}
                      size={16}
                      weight={index < review.rating ? 'fill' : 'regular'}
                      className={index < review.rating ? 'text-[#E5A900]' : 'text-gray-300'}
                    />
                  ))}
                </div>
                <time className="text-xs text-[#263544]/50" dateTime={review.created_at}>
                  {formatDateTime(review.created_at)}
                </time>
              </div>
              {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm text-[#263544]/80">{review.comment}</p>}
              {review.admin_reply && (
                <div className="mt-3 rounded-lg bg-[#FDE3EE]/60 px-4 py-3">
                  <p className="text-xs font-semibold text-[#263544]">คำตอบจากร้าน</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#263544]/75">{review.admin_reply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}