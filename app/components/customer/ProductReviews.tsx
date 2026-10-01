'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { RulerIcon, StarIcon, XIcon } from '@phosphor-icons/react'
import ReviewCard from './ReviewCard'
import { StarDisplay } from './StarRating'
import { fetchProductReviews, sizeFitVerdict, type RatingSummary, type Review } from '@/utils/customer/reviews'

const PAGE = 5

// ส่วนรีวิวในหน้ารายละเอียดชุด: คะแนนเฉลี่ย + กราฟแท่ง + สรุปไซส์ + ตัวกรอง + รายการรีวิว
export default function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [starFilter, setStarFilter] = useState<number | null>(null)
  const [photosOnly, setPhotosOnly] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    fetchProductReviews(productId).then((res) => {
      setReviews(res.reviews)
      setSummary(res.summary)
      setLoading(false)
    })
  }, [productId])

  useEffect(() => setShown(PAGE), [starFilter, photosOnly])

  const filtered = useMemo(
    () =>
      reviews.filter(
        (r) => (starFilter === null || r.rating === starFilter) && (!photosOnly || r.imageUrls.length > 0),
      ),
    [reviews, starFilter, photosOnly],
  )
  const photoCount = reviews.filter((r) => r.imageUrls.length > 0).length
  const verdict = sizeFitVerdict(summary)

  return (
    <section id="reviews" className="scroll-mt-24 rounded-3xl bg-[#F7F7F8] p-6 lg:col-span-2">
      <h2 className="mb-4 text-lg font-bold text-[#263544]">
        รีวิวจากผู้เช่าจริง {summary && summary.reviewCount > 0 && `(${summary.reviewCount})`}
      </h2>

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
      ) : !summary || summary.reviewCount === 0 ? (
        <div className="rounded-2xl bg-white px-4 py-10 text-center">
          <StarIcon size={36} className="mx-auto text-[#F5B400]/50" />
          <p className="mt-2 font-semibold text-[#263544]">ยังไม่มีรีวิว</p>
          <p className="mt-1 text-sm text-[#263544]/60">เช่าชุดนี้แล้วกลับมาเป็นคนแรกที่รีวิวได้เลย</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 rounded-2xl bg-white p-5 sm:grid-cols-[180px_1fr]">
            <div className="text-center sm:border-r sm:border-gray-100 sm:pr-6">
              <p className="text-5xl font-extrabold text-[#263544]">{summary.avgRating.toFixed(1)}</p>
              <div className="mt-1 flex justify-center">
                <StarDisplay value={summary.avgRating} size={18} />
              </div>
              <p className="mt-1 text-xs text-[#263544]/60">จาก {summary.reviewCount} รีวิว</p>
            </div>

            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = summary.stars[star]
                const pct = summary.reviewCount ? (count / summary.reviewCount) * 100 : 0
                const active = starFilter === star
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setStarFilter(active ? null : star)}
                    disabled={count === 0}
                    className={`flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-xs transition disabled:cursor-default ${
                      active ? 'bg-[#FDE3EE]' : 'hover:bg-gray-50 disabled:hover:bg-transparent'
                    }`}
                  >
                    <span className="w-8 text-right font-medium text-[#263544]">{star} ดาว</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-[#F5B400]" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-6 text-left text-[#263544]/60">{count}</span>
                  </button>
                )
              })}
              {verdict && (
                <p className="flex items-center gap-1.5 pt-2 text-sm font-medium text-[#263544]">
                  <RulerIcon size={16} className="text-[#E5457F]" />
                  {verdict}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <FilterChip active={starFilter === null && !photosOnly} onClick={() => { setStarFilter(null); setPhotosOnly(false) }}>
              ทั้งหมด
            </FilterChip>
            {photoCount > 0 && (
              <FilterChip active={photosOnly} onClick={() => setPhotosOnly((v) => !v)}>
                มีรูป ({photoCount})
              </FilterChip>
            )}
            {starFilter !== null && (
              <FilterChip active onClick={() => setStarFilter(null)}>
                {starFilter} ดาว ✕
              </FilterChip>
            )}
          </div>

          <div className="mt-2 rounded-2xl bg-white px-5">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#263544]/50">ไม่มีรีวิวที่ตรงกับตัวกรองนี้</p>
            ) : (
              filtered.slice(0, shown).map((r) => <ReviewCard key={r.id} review={r} onImageClick={setLightbox} />)
            )}
          </div>

          {filtered.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="mx-auto mt-4 block rounded-full border-2 border-[#263544] px-5 py-2 text-sm font-semibold text-[#263544] transition hover:bg-white"
            >
              ดูรีวิวเพิ่มเติม ({filtered.length - shown})
            </button>
          )}
        </>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <button type="button" aria-label="ปิด" className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white">
            <XIcon size={22} weight="bold" />
          </button>
          <img src={lightbox} alt="รูปจากผู้รีวิว" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </section>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? 'border-[#263544] bg-[#263544] text-white' : 'border-[#263544]/30 bg-white text-[#263544] hover:border-[#263544]'
      }`}
    >
      {children}
    </button>
  )
}
