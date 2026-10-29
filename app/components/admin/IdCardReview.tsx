'use client'
/* eslint-disable @next/next/no-img-element */

// ตรวจรูปบัตรประชาชนของลูกค้า (Step 25) — ใช้ทั้งแผงออเดอร์ awaiting_id และหน้าสมาชิก
// อนุมัติ = ออเดอร์ที่รอตรวจบัตรทุกใบของลูกค้าคนนี้ไปรอชำระ · ไม่อนุมัติ = ยกเลิกออเดอร์เหล่านั้นและลบรูป

import { useEffect, useState, type ReactNode } from 'react'
import { MagnifyingGlassPlusIcon } from '@phosphor-icons/react'
import { StatusBadge, primaryButtonClass, secondaryButtonClass } from '@/app/components/admin/ui'
import { createClient } from '@/utils/client'
import { translateRpcError } from '@/utils/bookingErrors'
import { formatDateTime } from '@/utils/dateUtils'
import { ID_CARD_WATERMARK, type IdCardStatus } from '@/utils/customer/idCard'
import type { Tone } from '@/utils/admin/statusTone'

export const ID_STATUS_BADGE: Record<IdCardStatus, { label: string; tone: Tone }> = {
  none: { label: 'ยังไม่ส่งบัตร', tone: 'closed' },
  pending: { label: 'รอตรวจบัตร', tone: 'action' },
  verified: { label: 'ยืนยันตัวตนแล้ว', tone: 'done' },
  rejected: { label: 'บัตรไม่ผ่าน', tone: 'problem' },
}

const REJECT_REASONS = [
  'รูปไม่ชัด อ่านชื่อหรือรูปหน้าไม่ได้',
  `ไม่มีข้อความ “${ID_CARD_WATERMARK}” และวันที่`,
  'ชื่อบนบัตรไม่ตรงกับชื่อผู้จอง',
  'ไม่ใช่บัตรประชาชน หรือบัตรหมดอายุ',
]

// ข้อที่ต้องดูก่อนอนุมัติ — ติ๊กครบก่อนถึงกดอนุมัติได้ กันกดผ่านโดยไม่ได้ดูรูป
const CHECKS = [
  'เห็นรูปหน้าและชื่อชัด ชื่อตรงกับผู้จอง',
  `มีข้อความ “${ID_CARD_WATERMARK}” พร้อมวันที่`,
  'เป็นบัตรประชาชนที่ยังไม่หมดอายุ',
]

type Card = { status: IdCardStatus; submittedAt: string | null; filePath: string | null; rejectReason: string | null }

type Props = {
  userId: string
  // ชื่อที่ใช้จอง ไว้เทียบกับชื่อบนบัตร
  bookerName?: string | null
  // ข้อความเพิ่มเหนือปุ่ม เช่น เส้นตายของออเดอร์
  note?: ReactNode
  onDone: (message: string) => void
}

export default function IdCardReview({ userId, bookerName, note, onDone }: Props) {
  const [card, setCard] = useState<Card | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checked, setChecked] = useState<boolean[]>(() => CHECKS.map(() => false))
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const supabase = createClient()
    if (!supabase) return
    supabase
      .from('customer_id_cards')
      .select('status, submitted_at, file_path, reject_reason')
      .eq('user_id', userId)
      .maybeSingle()
      .then(async ({ data, error: err }) => {
        if (!alive) return
        if (err) return setLoadError(err.message)
        const c: Card = {
          status: (data?.status as IdCardStatus) ?? 'none',
          submittedAt: data?.submitted_at ?? null,
          filePath: data?.file_path ?? null,
          rejectReason: data?.reject_reason ?? null,
        }
        setCard(c)
        if (c.filePath) {
          const { data: signed } = await supabase.storage.from('id-cards').createSignedUrl(c.filePath, 60 * 10)
          if (alive) setUrl(signed?.signedUrl ?? null)
        }
      })
    return () => {
      alive = false
    }
  }, [userId])

  async function decide(approve: boolean) {
    if (!approve && !reason.trim()) return setError('เลือกหรือพิมพ์เหตุผลก่อน ลูกค้าจะได้ถ่ายใหม่ให้ถูก')
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/id-cards/${userId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve, reason: approve ? null : reason.trim() }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string; mailed?: boolean; orders?: unknown[] }
    setSaving(false)
    if (!res.ok) return setError(translateRpcError(json.error))
    const n = json.orders?.length ?? 0
    const mail = json.mailed ? 'ส่งอีเมลแจ้งลูกค้าแล้ว' : 'ส่งอีเมลไม่สำเร็จ แจ้งลูกค้าเอง'
    onDone(
      approve
        ? `อนุมัติบัตรแล้ว${n ? ` · ${n} ออเดอร์ไปรอชำระ` : ''} · ${mail}`
        : `ไม่อนุมัติบัตร${n ? ` · ยกเลิก ${n} ออเดอร์` : ''} · ${mail}`,
    )
  }

  if (loadError) return <p className="px-5 py-5 text-sm text-[#B42318]">{loadError}</p>
  if (!card) return <div className="m-5 h-40 animate-pulse rounded-xl bg-[#F3F4F6]" />

  const badge = ID_STATUS_BADGE[card.status]
  const left = checked.filter((c) => !c).length

  return (
    <>
      <div className="flex flex-wrap gap-5 p-5">
        <div className="w-[360px] max-w-full flex-none">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" title="เปิดรูปเต็ม" className="group relative block">
              <img src={url} alt="รูปบัตรประชาชน" className="aspect-[3/2] w-full rounded-xl border border-[#E4E3EA] bg-[#F3F4F6] object-contain" />
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white transition group-hover:bg-black/75">
                <MagnifyingGlassPlusIcon size={14} weight="bold" />
                เปิดรูปเต็ม
              </span>
            </a>
          ) : (
            <div className="flex aspect-[3/2] items-center justify-center rounded-xl border border-dashed border-[#D5D9E0] p-4 text-center text-sm text-[#6B7280]">
              {card.filePath ? 'กำลังโหลดรูป…' : 'ไม่มีรูปบัตร'}
            </div>
          )}
        </div>
        <div className="flex min-w-[240px] flex-1 flex-col gap-2 text-sm text-[#263544]">
          <p className="flex items-center gap-2">
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            {card.submittedAt && <span className="text-[#6B7280]">ส่งเมื่อ {formatDateTime(card.submittedAt)}</span>}
          </p>
          {bookerName && (
            <p className="rounded-lg bg-[#F5F4F8] px-3 py-2">
              <span className="text-[#6B7280]">ชื่อที่ต้องตรงกับบัตร</span> <b className="text-base">{bookerName}</b>
            </p>
          )}
          <p className="font-semibold">ตรวจก่อนอนุมัติ</p>
          <div className="flex flex-col gap-1.5">
            {CHECKS.map((c, i) => (
              <label key={c} className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg border border-[#E4E3EA] px-3 hover:border-[#9AA3AF]">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  disabled={card.status !== 'pending'}
                  onChange={() => setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                  className="h-[18px] w-[18px] accent-[#E5457F]"
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-[#6B7280]">ไม่ต้องจดเลขบัตร ระบบเก็บแค่รูป</p>
          {card.status === 'rejected' && card.rejectReason && (
            <p className="text-[#B42318]">ไม่อนุมัติครั้งก่อน: {card.rejectReason}</p>
          )}
          {note}
          {rejecting && (
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      reason === r ? 'border-[#263544] bg-[#263544] text-white' : 'border-[#D5D9E0] bg-white text-[#263544]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder="เหตุผลที่ลูกค้าจะเห็นในอีเมล"
                className="w-full rounded-xl border border-[#D5D9E0] px-3 py-2 text-sm outline-none focus:border-[#263544]"
              />
            </div>
          )}
          {error && <p role="alert" className="rounded-lg bg-[#FDE8E8] px-3 py-2 text-[#B42318]">{error}</p>}
        </div>
      </div>
      {card.status === 'pending' && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#EEEDF2] bg-[#FAFAFC] px-5 py-3">
          {!rejecting && left > 0 && <p className="mr-auto text-sm text-[#5B6472]">ติ๊กอีก {left} ข้อ ถึงกดอนุมัติได้</p>}
          {rejecting ? (
            <>
              <button type="button" onClick={() => setRejecting(false)} disabled={saving} className={secondaryButtonClass}>
                กลับ
              </button>
              <button
                type="button"
                onClick={() => decide(false)}
                disabled={saving}
                className="rounded-full bg-[#B42318] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {saving ? 'กำลังบันทึก…' : 'ยืนยันไม่อนุมัติ'}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setRejecting(true)} disabled={saving} className={secondaryButtonClass}>
                ไม่อนุมัติ
              </button>
              <button type="button" onClick={() => decide(true)} disabled={saving || !url || left > 0} className={primaryButtonClass}>
                {saving ? 'กำลังบันทึก…' : 'อนุมัติบัตร'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
