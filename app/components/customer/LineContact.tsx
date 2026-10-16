'use client'

// app/components/customer/LineContact.tsx
// ปุ่มติดต่อแอดมินผ่าน LINE + ป๊อปอัป (ไม่ทำห้องแชทในเว็บ — ดูเหตุผลใน session-handoff-2026-10-12)
//
// ใช้ 2 แบบ:
//   <LineContact />                       ปุ่มลอยมุมขวาล่าง วางครั้งเดียวใน CustomerLayout
//   <LineContact variant="inline"
//     message={`สอบถามออเดอร์ ${orderNumber}`}
//     label="ติดต่อร้านเรื่องออเดอร์นี้" />  ปุ่มในหน้า เปิดแชทพร้อมพิมพ์ข้อความไว้ให้
//
// ป๊อปอัปแสดง QR ใหญ่ตรงกลาง · คอมพิวเตอร์: สแกนด้วยมือถือ · มือถือ: แตะที่ QR เพื่อเปิดแอป LINE
// ต้องติดตั้ง: npm i qrcode.react

import { useEffect, useRef, useState } from 'react'
import { ChatCircleDotsIcon, XIcon } from '@phosphor-icons/react'
import { QRCodeSVG } from 'qrcode.react'
import { LINE_REPLY_HOURS, lineChatUrl } from '@/utils/contact'

// สีเขียว LINE · ตัวอักษรบนพื้นเขียวใช้สีเข้ม (ขาวบนเขียวได้แค่ ~2:1 ไม่ผ่าน WCAG AA)
const LINE_GREEN = '#06C755'

type Props = {
  variant?: 'fab' | 'inline'
  /** ข้อความที่พิมพ์ไว้ให้ในแชท เช่น เลขออเดอร์ */
  message?: string
  /** ข้อความบนปุ่มแบบ inline */
  label?: string
  className?: string
}

export default function LineContact({ variant = 'fab', message, label = 'ติดต่อแอดมินทาง LINE', className = '' }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const chatUrl = lineChatUrl(message)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const trigger =
    variant === 'fab' ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ติดต่อแอดมินทาง LINE"
        className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 items-center gap-2 rounded-full border border-[#E5E5E5] bg-white pl-2 pr-2 text-base font-semibold text-[#2E2E2E] shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4487D] focus-visible:ring-offset-2 sm:bottom-6 sm:right-6 sm:pr-5"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: LINE_GREEN }}>
          <ChatCircleDotsIcon size={24} weight="fill" className="text-white" aria-hidden="true" />
        </span>
        {/* มือถือแสดงแค่ไอคอน ไม่บังเนื้อหา */}
        <span className="hidden sm:inline">ติดต่อแอดมิน</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D4D4D4] bg-white px-4 text-base font-semibold text-[#2E2E2E] transition hover:bg-[#F0F0F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4487D] focus-visible:ring-offset-2 ${className}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: LINE_GREEN }}>
          <ChatCircleDotsIcon size={16} weight="fill" className="text-white" aria-hidden="true" />
        </span>
        {label}
      </button>
    )

  return (
    <>
      {trigger}

      <dialog
        ref={dialogRef}
        aria-labelledby="line-contact-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false)
        }}
        className="m-auto max-h-[90vh] w-[calc(100%-32px)] max-w-sm overflow-hidden rounded-card border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-black/50"
      >
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
            <h2 id="line-contact-title" className="text-h2 font-bold">
              คุยกับแอดมินทาง LINE
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิด"
              className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-secondary transition hover:bg-sunken"
            >
              <XIcon size={20} weight="bold" />
            </button>
          </div>

          {/* QR ใหญ่อยู่กลาง → คำอธิบายใต้ QR
              บนมือถือสแกนจอตัวเองไม่ได้ จึงให้แตะที่ QR เพื่อเปิดแชทในแอป LINE แทน */}
          <div className="flex flex-col items-center overflow-y-auto px-5 py-6 text-center sm:px-6">
            <a
              href={chatUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="QR code เปิดแชท LINE ของร้าน (แตะเพื่อเปิดในแอป LINE)"
              className="focus-ring rounded-card border border-line bg-surface p-4"
            >
              <QRCodeSVG value={chatUrl} size={224} level="M" className="h-auto w-[min(224px,60vw)]" />
            </a>

            <p className="mt-4 text-body font-semibold text-ink">สแกน QR ด้วยกล้องมือถือเพื่อเปิดแชทใน LINE</p>
            <p className="mt-1 max-w-xs text-body-sm text-secondary">
              ติดต่อสอบถามหรือส่งข้อความถึงแอดมิน
              <br />
              แอดมินตอบ{LINE_REPLY_HOURS}
            </p>
            <p className="mt-1 text-body-sm text-muted sm:hidden">เปิดเว็บบนมือถืออยู่? แตะที่ QR ได้เลย</p>

            {message && (
              <div className="mt-4 w-full rounded-control bg-canvas px-4 py-3 text-left">
                <p className="text-caption text-muted">ข้อความที่พิมพ์ไว้ให้ (แก้ไขได้ก่อนส่ง)</p>
                <p className="mt-0.5 text-body font-medium text-ink">{message}</p>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}