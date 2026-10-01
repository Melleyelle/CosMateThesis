'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChatCircleTextIcon, EyeIcon, EyeSlashIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import AdminLayout from '../../components/admin/AdminLayout'
import { EmptyState, FilterTabs, Metric, MetricStrip, PageHeader, StatusBadge } from '../../components/admin/ui'
import { StarDisplay } from '../../components/customer/StarRating'
import { createClient } from '@/utils/client'
import { fetchAllReviewsForAdmin, SIZE_FIT_LABEL, type Review } from '@/utils/customer/reviews'
import { formatDateTime } from '@/utils/dateUtils'

type AdminReview = Review & { productName: string }

const TABS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'low', label: '1–2 ดาว (ควรดู)' },
  { value: 'unreplied', label: 'ยังไม่ตอบ' },
  { value: 'hidden', label: 'ซ่อนอยู่' },
] as const
type Tab = (typeof TABS)[number]['value']

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({})
  const [replyOpen, setReplyOpen] = useState<string | null>(null)

  useEffect(() => {
    fetchAllReviewsForAdmin().then(({ data, error }) => {
      if (error) setLoadError(error)
      else setReviews(data)
      setLoading(false)
    })
  }, [])

  const counts = useMemo(
    () => ({
      all: reviews.length,
      low: reviews.filter((r) => r.rating <= 2).length,
      unreplied: reviews.filter((r) => !r.adminReply && !r.isHidden).length,
      hidden: reviews.filter((r) => r.isHidden).length,
    }),
    [reviews],
  )

  const visibleReviews = reviews.filter((r) => !r.isHidden)
  const avg = visibleReviews.length
    ? visibleReviews.reduce((sum, r) => sum + r.rating, 0) / visibleReviews.length
    : 0

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reviews.filter((r) => {
      if (tab === 'low' && r.rating > 2) return false
      if (tab === 'unreplied' && (r.adminReply || r.isHidden)) return false
      if (tab === 'hidden' && !r.isHidden) return false
      if (q && !`${r.productName} ${r.reviewerName} ${r.comment ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [reviews, tab, search])

  async function update(id: string, patch: Record<string, unknown>, local: Partial<AdminReview>) {
    const supabase = createClient()
    if (!supabase) return false
    setBusyId(id)
    const { error } = await supabase.from('product_reviews').update(patch).eq('id', id)
    setBusyId(null)
    if (error) {
      alert(`บันทึกไม่สำเร็จ: ${error.message}`)
      return false
    }
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...local } : r)))
    return true
  }

  function toggleHidden(r: AdminReview) {
    if (!r.isHidden && !confirm('ซ่อนรีวิวนี้จากหน้าร้าน? (ลูกค้ายังเห็นของตัวเอง และกดแสดงกลับได้ภายหลัง)')) return
    update(r.id, { is_hidden: !r.isHidden }, { isHidden: !r.isHidden })
  }

  async function saveReply(r: AdminReview) {
    const text = (replyDraft[r.id] ?? '').trim()
    const now = new Date().toISOString()
    const ok = await update(
      r.id,
      { admin_reply: text || null, admin_replied_at: text ? now : null },
      { adminReply: text || null, adminRepliedAt: text ? now : null },
    )
    if (ok) setReplyOpen(null)
  }

  return (
    <AdminLayout>
      <div className="px-5 py-7 sm:px-8">
        <PageHeader title="รีวิว" description="อ่านรีวิวจากผู้เช่า ตอบกลับ และซ่อนรีวิวที่ไม่เหมาะสม" />

        <div className="mb-6">
          <MetricStrip>
            <Metric
              label="คะแนนเฉลี่ยร้าน"
              value={
                visibleReviews.length ? (
                  <span className="inline-flex items-center gap-2">
                    {avg.toFixed(1)}
                    <StarDisplay value={avg} size={14} />
                  </span>
                ) : (
                  '—'
                )
              }
              note="นับเฉพาะรีวิวที่แสดงอยู่"
            />
            <Metric label="รีวิวทั้งหมด" value={counts.all} onClick={() => setTab('all')} />
            <Metric
              label="1–2 ดาว"
              value={<span className={counts.low ? 'text-[#B42318]' : ''}>{counts.low}</span>}
              note="ควรอ่านและตอบก่อน"
              onClick={() => setTab('low')}
            />
            <Metric label="ยังไม่ตอบ" value={counts.unreplied} onClick={() => setTab('unreplied')} />
          </MetricStrip>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <MagnifyingGlassIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9AA3AF]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อชุด ชื่อผู้รีวิว หรือข้อความ..."
              className="w-full rounded-full border border-[#D5D9E0] bg-white py-2.5 pl-11 pr-4 text-sm text-[#263544] outline-none placeholder:text-[#9AA3AF] focus:border-[#263544] focus:ring-2 focus:ring-[#263544]/10"
            />
          </div>
        </div>

        <div className="mb-5 overflow-x-auto">
          <FilterTabs tabs={TABS} value={tab} onChange={setTab} counts={counts} />
        </div>

        {loading && <div className="h-64 animate-pulse rounded-2xl bg-white" />}
        {!loading && loadError && (
          <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-6 text-center text-sm text-[#B42318]">
            {loadError.includes('product_reviews') ? 'ยังไม่ได้รัน cosmate_step11_reviews.sql' : loadError}
          </p>
        )}
        {!loading && !loadError && filtered.length === 0 && (
          <div className="rounded-2xl border border-[#E4E3EA] bg-white">
            <EmptyState>
              {reviews.length === 0 ? 'ยังไม่มีรีวิว ลูกค้ารีวิวได้หลังออเดอร์ "เสร็จสิ้น"' : 'ไม่มีรีวิวในกลุ่มนี้'}
            </EmptyState>
          </div>
        )}

        <div className="space-y-3">
          {!loading &&
            filtered.map((r) => (
              <article
                key={r.id}
                className={`rounded-2xl border bg-white p-5 ${r.isHidden ? 'border-dashed border-[#D5D9E0] opacity-70' : 'border-[#E4E3EA]'}`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/costumes/${r.productId}#reviews`} target="_blank" className="font-semibold text-[#263544] hover:text-[#C92D67]">
                      {r.productName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                      <StarDisplay value={r.rating} size={14} />
                      <span className="font-medium text-[#263544]">{r.reviewerName}</span>
                      <span>{formatDateTime(r.createdAt)}</span>
                      {r.size && <span className="rounded bg-[#EDE6FA] px-1.5 text-[#263544]">ไซส์ {r.size}</span>}
                      {r.sizeFit && <span className="rounded bg-[#EDE6FA] px-1.5 text-[#263544]">{SIZE_FIT_LABEL[r.sizeFit]}</span>}
                      {r.heightCm && <span className="rounded bg-[#EDE6FA] px-1.5 text-[#263544]">{r.heightCm} ซม.</span>}
                      {r.isHidden && <StatusBadge tone="closed">ซ่อนอยู่</StatusBadge>}
                      {!r.isHidden && r.rating <= 2 && !r.adminReply && <StatusBadge tone="problem">ควรตอบ</StatusBadge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyOpen(replyOpen === r.id ? null : r.id)
                        setReplyDraft((d) => ({ ...d, [r.id]: d[r.id] ?? r.adminReply ?? '' }))
                      }}
                      className="flex items-center gap-1 rounded-full border border-[#D5D9E0] px-3 py-1 text-xs font-semibold text-[#263544] transition hover:border-[#263544]"
                    >
                      <ChatCircleTextIcon size={14} />
                      {r.adminReply ? 'แก้คำตอบ' : 'ตอบกลับ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHidden(r)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1 rounded-full border border-[#D5D9E0] px-3 py-1 text-xs font-semibold text-[#263544] transition hover:border-[#263544] disabled:opacity-50"
                    >
                      {r.isHidden ? <EyeIcon size={14} /> : <EyeSlashIcon size={14} />}
                      {r.isHidden ? 'แสดง' : 'ซ่อน'}
                    </button>
                  </div>
                </div>

                {r.comment && <p className="mt-3 whitespace-pre-line text-sm text-[#5B6472]">{r.comment}</p>}
                {r.imageUrls.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {r.imageUrls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="h-20 w-16 overflow-hidden rounded-lg border border-[#E4E3EA]">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}

                {r.adminReply && replyOpen !== r.id && (
                  <div className="mt-3 rounded-xl border-l-4 border-[#E5457F] bg-[#FFFAFC] px-3 py-2 text-sm text-[#5B6472]">
                    <span className="text-xs font-bold text-[#E5457F]">ร้านตอบกลับ: </span>
                    {r.adminReply}
                  </div>
                )}

                {replyOpen === r.id && (
                  <div className="mt-3">
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={replyDraft[r.id] ?? ''}
                      onChange={(e) => setReplyDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      placeholder="ขอบคุณลูกค้า หรือชี้แจงปัญหาอย่างสุภาพ (ลบข้อความทั้งหมดแล้วบันทึก = ลบคำตอบ)"
                      className="w-full rounded-xl border border-[#D5D9E0] px-3 py-2 text-sm outline-none focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveReply(r)}
                        disabled={busyId === r.id}
                        className="rounded-full border-2 border-[#263544] bg-[#E5457F] px-4 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0_0_#263544] disabled:opacity-50"
                      >
                        บันทึกคำตอบ
                      </button>
                      <button type="button" onClick={() => setReplyOpen(null)} className="px-3 text-xs font-semibold text-[#6B7280] hover:text-[#5B6472]">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
        </div>
      </div>
    </AdminLayout>
  )
}
