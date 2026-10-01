'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CameraIcon, ImageIcon, SpinnerGapIcon, XIcon } from '@phosphor-icons/react'
import { StarInput } from './StarRating'
import { SIZE_FIT_LABEL, submitReview, uploadReviewImage, type SizeFit } from '@/utils/customer/reviews'
import { translateRpcError } from '@/utils/bookingErrors'

type Props = {
  orderItemId: string
  productName: string
  size: string | null
  coverImageUrl: string | null
  onClose: () => void
  onSubmitted: () => void
}

type Upload = { id: string; preview: string; url: string | null; error: string | null }

const MAX_IMAGES = 3
const MAX_COMMENT = 1000

// กล่องเขียนรีวิว (เปิดจากหน้าออเดอร์ที่จบการเช่าแล้ว)
export default function ReviewForm({ orderItemId, productName, size, coverImageUrl, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0)
  const [sizeFit, setSizeFit] = useState<SizeFit | null>(null)
  const [height, setHeight] = useState('')
  const [comment, setComment] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ปิดด้วยปุ่ม Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  const uploading = uploads.some((u) => !u.url && !u.error)

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const room = MAX_IMAGES - uploads.length
    const picked = Array.from(files).slice(0, room)
    const pending: Upload[] = picked.map((f) => ({
      id: crypto.randomUUID(),
      preview: URL.createObjectURL(f),
      url: null,
      error: null,
    }))
    setUploads((prev) => [...prev, ...pending])

    await Promise.all(
      picked.map(async (file, i) => {
        const res = await uploadReviewImage(file)
        setUploads((prev) =>
          prev.map((u) =>
            u.id === pending[i].id ? { ...u, ...('url' in res ? { url: res.url } : { error: res.error }) } : u,
          ),
        )
      }),
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (rating === 0) {
      setError('กรุณาให้คะแนนอย่างน้อย 1 ดาว')
      return
    }
    const h = height ? Number(height) : null
    if (h !== null && (h < 100 || h > 220)) {
      setError('ส่วนสูงต้องอยู่ระหว่าง 100–220 ซม.')
      return
    }

    setSubmitting(true)
    setError(null)
    const { error: rpcError } = await submitReview({
      orderItemId,
      rating,
      sizeFit,
      comment,
      imageUrls: uploads.filter((u) => u.url).map((u) => u.url as string),
      heightCm: h,
      anonymous,
    })
    setSubmitting(false)

    if (rpcError) {
      setError(translateRpcError(rpcError))
      return
    }
    onSubmitted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="เขียนรีวิว">
      <div className="absolute inset-0 bg-[#263544]/50" onClick={() => !submitting && onClose()} />

      <form
        onSubmit={handleSubmit}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-2 border-[#263544] bg-white p-6 shadow-[6px_6px_0_0_#263544] sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="ปิด"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#263544] hover:bg-gray-100"
        >
          <XIcon size={20} weight="bold" />
        </button>

        <h2 className="text-xl font-bold text-[#263544]">รีวิวชุดที่เช่า</h2>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#FFFAFC] p-3">
          <div className="h-16 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-[#FDE3EE]">
            {coverImageUrl ? (
              <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[#E5457F]/40">
                <ImageIcon size={20} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#263544]">{productName}</p>
            {size && <p className="text-xs text-[#263544]/60">ไซส์ที่เช่า: {size}</p>}
          </div>
        </div>

        <section className="mt-5">
          <p className="mb-2 text-sm font-semibold text-[#263544]">
            ความพึงพอใจโดยรวม <span className="text-[#E5457F]">*</span>
          </p>
          <StarInput value={rating} onChange={setRating} />
        </section>

        <section className="mt-5">
          <p className="mb-2 text-sm font-semibold text-[#263544]">ไซส์เป็นยังไงบ้าง?</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SIZE_FIT_LABEL) as SizeFit[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSizeFit(sizeFit === key ? null : key)}
                aria-pressed={sizeFit === key}
                className={`rounded-xl border-2 py-2 text-sm font-semibold transition ${
                  sizeFit === key
                    ? 'border-[#263544] bg-[#E5457F] text-white'
                    : 'border-[#263544]/20 text-[#263544] hover:border-[#263544]'
                }`}
              >
                {SIZE_FIT_LABEL[key]}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-[#263544]">
            ส่วนสูงของคุณ
            <input
              inputMode="numeric"
              maxLength={3}
              value={height}
              onChange={(e) => setHeight(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="เช่น 165"
              className="w-24 rounded-lg bg-[#EFEFEF] px-3 py-1.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#E5457F]/30"
            />
            ซม. <span className="text-xs text-[#263544]/50">(ไม่บังคับ ช่วยคนอื่นเลือกไซส์)</span>
          </label>
        </section>

        <section className="mt-5">
          <p className="mb-2 text-sm font-semibold text-[#263544]">เล่าประสบการณ์ (ไม่บังคับ)</p>
          <textarea
            rows={4}
            maxLength={MAX_COMMENT}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="สภาพชุด เนื้อผ้า ใส่ไปงานไหน ถ่ายรูปออกมาเป็นยังไง..."
            className="w-full rounded-xl bg-[#EFEFEF] px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#E5457F]/30"
          />
          <p className="text-right text-xs text-[#263544]/40">
            {comment.length}/{MAX_COMMENT}
          </p>
        </section>

        <section className="mt-2">
          <p className="mb-2 text-sm font-semibold text-[#263544]">
            รูปตอนใส่ชุด (ไม่บังคับ สูงสุด {MAX_IMAGES} รูป)
          </p>
          <div className="flex flex-wrap gap-2">
            {uploads.map((u) => (
              <div key={u.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-gray-200">
                <img src={u.preview} alt="" className="h-full w-full object-cover" />
                {!u.url && !u.error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <SpinnerGapIcon size={22} className="animate-spin text-[#E5457F]" />
                  </div>
                )}
                {u.error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-50/90 p-1 text-center text-[10px] text-red-600">
                    {u.error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setUploads((prev) => prev.filter((x) => x.id !== u.id))}
                  aria-label="เอารูปนี้ออก"
                  className="absolute right-1 top-1 rounded-full bg-[#263544]/80 p-0.5 text-white"
                >
                  <XIcon size={12} weight="bold" />
                </button>
              </div>
            ))}
            {uploads.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#263544]/30 text-xs text-[#263544]/60 transition hover:border-[#E5457F] hover:text-[#E5457F]"
              >
                <CameraIcon size={22} />
                เพิ่มรูป
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </section>

        <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-[#263544]">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 accent-[#263544]"
          />
          ไม่แสดงชื่อของฉัน (แสดงเป็น &quot;ลูกค้า CosMate&quot;)
        </label>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || uploading}
          className="mt-5 w-full rounded-full border-2 border-[#263544] bg-[#E5457F] py-3 text-sm font-bold text-white shadow-[3px_3px_0_0_#263544] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#263544] disabled:opacity-50"
        >
          {submitting ? 'กำลังส่งรีวิว...' : uploading ? 'กำลังอัปโหลดรูป...' : 'ส่งรีวิว'}
        </button>
        <p className="mt-2 text-center text-xs text-[#263544]/50">ส่งแล้วแก้ไขไม่ได้ รีวิวจะแสดงในหน้าชุดทันที</p>
      </form>
    </div>
  )
}
