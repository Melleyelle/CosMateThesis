'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import { CheckCircleIcon, HourglassIcon, IdentificationCardIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { formatDateTime } from '@/utils/dateUtils'
import {
  ID_CARD_WATERMARK,
  deleteMyIdCard,
  fetchMyIdCard,
  idCardFileProblem,
  submitMyIdCard,
  type MyIdCard,
} from '@/utils/customer/idCard'

const primaryButtonClass =
  'lift focus-ring rounded-full border border-line bg-brand px-6 py-2.5 text-base font-bold text-white active:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40'

type Props = {
  // หน้าชำระเงิน: ไม่มีปุ่มลบ และข้อความบอกว่าส่งแล้วจองต่อได้เลย
  context: 'account' | 'checkout'
  onChange?: (card: MyIdCard) => void
}

// ส่งรูปบัตรประชาชนครั้งแรก / ดูสถานะ / ขอลบ — ใช้ทั้งหน้า "บัญชีของฉัน" และหน้าชำระเงิน
export default function IdCardForm({ context, onChange }: Props) {
  const [card, setCard] = useState<MyIdCard | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [file, setFile] = useState<{ file: File; url: string } | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<'submit' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchMyIdCard().then(({ data, error: err }) => {
      if (!alive) return
      setCard(data)
      setLoadError(err)
      onChange?.(data)
    })
    return () => {
      alive = false
    }
    // โหลดครั้งเดียวตอนเปิดหน้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (file) URL.revokeObjectURL(file.url)
    }
  }, [file])

  function update(next: MyIdCard) {
    setCard(next)
    onChange?.(next)
  }

  function pick(f: File | undefined) {
    if (!f) return
    const problem = idCardFileProblem(f)
    if (problem) return setError(problem)
    setError(null)
    setFile({ file: f, url: URL.createObjectURL(f) })
  }

  async function submit() {
    if (!file) return
    setBusy('submit')
    setError(null)
    const err = await submitMyIdCard(file.file, consent)
    setBusy(null)
    if (err) return setError(err)
    setFile(null)
    setReplacing(false)
    update({ status: 'pending', submittedAt: new Date().toISOString(), verifiedAt: null, rejectReason: null })
  }

  async function remove() {
    if (!confirm('ลบรูปบัตรประชาชน? ครั้งต่อไปที่เช่าต้องส่งรูปใหม่และรอร้านตรวจอีกครั้ง')) return
    setBusy('delete')
    setError(null)
    const err = await deleteMyIdCard()
    setBusy(null)
    if (err) return setError(err)
    update({ status: 'none', submittedAt: null, verifiedAt: null, rejectReason: null })
  }

  if (!card) {
    return loadError ? (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-600">{loadError}</p>
    ) : (
      <div className="h-24 animate-pulse rounded-card bg-gray-100" />
    )
  }

  const showForm = card.status === 'none' || card.status === 'rejected' || replacing

  return (
    <div className="space-y-4">
      {card.status === 'verified' && (
        <StatusBox tone="done" icon={<CheckCircleIcon size={22} weight="fill" />} title="ยืนยันตัวตนแล้ว">
          ร้านตรวจบัตรเรียบร้อย{card.verifiedAt ? ` เมื่อ ${formatDateTime(card.verifiedAt)}` : ''} ครั้งต่อไปจองและชำระเงินได้เลย
        </StatusBox>
      )}
      {card.status === 'pending' && !replacing && (
        <StatusBox tone="waiting" icon={<HourglassIcon size={22} />} title="ส่งรูปบัตรแล้ว รอร้านตรวจ">
          {context === 'checkout'
            ? 'จองต่อได้เลย ร้านจะตรวจบัตรแล้วส่งอีเมลแจ้งให้ชำระเงิน (ภายใน 24 ชม.) ระหว่างนี้ชุดถูกกันไว้ให้คุณ'
            : `ส่งเมื่อ ${card.submittedAt ? formatDateTime(card.submittedAt) : '—'} · ร้านจะแจ้งผลทางอีเมล`}
        </StatusBox>
      )}
      {card.status === 'rejected' && (
        <StatusBox tone="problem" icon={<WarningCircleIcon size={22} />} title="ร้านไม่อนุมัติรูปบัตร">
          {card.rejectReason ?? 'กรุณาถ่ายรูปใหม่'} · ร้านลบรูปเดิมแล้ว ส่งรูปใหม่ด้านล่างได้เลย
        </StatusBox>
      )}

      {showForm && (
        <div className="space-y-4 rounded-card border border-line-subtle bg-[#FAFAFB] p-4">
          <div className="flex items-start gap-3">
            <IdentificationCardIcon size={26} weight="fill" className="mt-0.5 flex-shrink-0 text-brand" />
            <div className="text-base text-[#263544]">
              <p className="font-semibold">ส่งรูปบัตรประชาชนครั้งเดียว ตอนเช่าครั้งแรก</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[#263544]/80">
                <li>ถ่ายด้านหน้าบัตรให้เห็นรูปหน้าและชื่อชัด ไม่มีแสงสะท้อน</li>
                <li>
                  เขียนว่า <b className="font-semibold text-[#263544]">“{ID_CARD_WATERMARK}”</b> พร้อมวันที่
                  ลงบนสำเนาบัตร หรือบนกระดาษวางข้างบัตร ไม่ทับรูปหน้าและชื่อ
                </li>
              </ol>
              <p className="mt-2 text-[#263544]/60">ร้านเก็บแค่รูป ไม่บันทึกเลขบัตรลงระบบ</p>
            </div>
          </div>

          {file ? (
            <div className="flex items-center gap-4">
              <img src={file.url} alt="รูปบัตรที่เลือก" className="h-24 w-36 flex-shrink-0 rounded-lg border border-line-subtle bg-white object-cover" />
              <label className="cursor-pointer text-base font-semibold text-brand hover:underline">
                เปลี่ยนรูป
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
            </div>
          ) : (
            <label className="lift focus-ring flex min-h-[44px] cursor-pointer items-center justify-center rounded-card border border-dashed border-line bg-white px-4 py-4 text-base font-semibold text-[#263544]">
              เลือกรูปหรือถ่ายรูปบัตร
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          )}

          <label className="flex cursor-pointer gap-2.5 text-base leading-relaxed text-[#263544]/80">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 flex-shrink-0 accent-[#E5457F]"
            />
            <span>
              ยินยอมให้ CosMate เก็บรูปบัตรนี้เพื่อยืนยันตัวตนในการเช่าชุดเท่านั้น เฉพาะแอดมินร้านเปิดดูได้
              ระบบลบรูปเองเมื่อไม่ได้เช่าเกิน 1 ปี และลบได้ทุกเมื่อในหน้าบัญชีของฉัน (ยกเว้นระหว่างมีออเดอร์ที่ยังไม่จบ)
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-base text-red-600">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={submit} disabled={!file || !consent || busy !== null} className={primaryButtonClass}>
              {busy === 'submit' ? 'กำลังส่งรูป…' : 'ส่งรูปให้ร้านตรวจ'}
            </button>
            {replacing && (
              <button type="button" onClick={() => setReplacing(false)} className="text-base font-medium text-[#263544]/60 hover:text-[#263544]">
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      )}

      {!showForm && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {card.status === 'pending' && (
            <button type="button" onClick={() => setReplacing(true)} className="min-h-[44px] text-base font-semibold text-brand hover:underline">
              ส่งรูปใหม่แทนรูปเดิม
            </button>
          )}
          {context === 'account' && (
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="min-h-[44px] text-base font-medium text-red-600 hover:underline disabled:opacity-40"
            >
              {busy === 'delete' ? 'กำลังลบ…' : 'ขอลบรูปบัตร'}
            </button>
          )}
          {error && <p role="alert" className="w-full rounded-xl bg-red-50 px-3 py-2.5 text-base text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}

function StatusBox({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'done' | 'waiting' | 'problem'
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  const cls = {
    done: 'border-[#B8E2C8] bg-[#E3F5EA] text-[#1B6E45]',
    waiting: 'border-line bg-[#FFF3B0] text-[#263544]',
    problem: 'border-[#F5C2C0] bg-[#FDE8E8] text-[#B42318]',
  }[tone]
  return (
    <div className={`flex items-start gap-3 rounded-card border px-4 py-3 text-base ${cls}`}>
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  )
}
