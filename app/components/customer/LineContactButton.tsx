'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ChatCircleDotsIcon, XIcon } from '@phosphor-icons/react'

// TODO: เปลี่ยนเป็นลิงก์แอดเพื่อนของ LINE OA ร้านจริง (LINE OA Manager → เพิ่มเพื่อน → ลิงก์)
const LINE_ADD_FRIEND_URL = 'https://line.me/R/ti/p/@cosmate'
const LINE_ID = '@cosmate'
const LINE_GREEN = '#06C755'

// ปุ่มลอยมุมขวาล่าง กดแล้วเปิด QR แอดไลน์ติดต่อแอดมิน · z-40 ให้ modal อื่น (z-50) ทับได้
export default function LineContactButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ติดต่อแอดมินทาง LINE"
        className="lift focus-ring fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-line text-white sm:bottom-6 sm:right-6"
        style={{ backgroundColor: LINE_GREEN }}
      >
        <ChatCircleDotsIcon size={28} weight="fill" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="ติดต่อแอดมินทาง LINE"
        >
          <div className="absolute inset-0 bg-[#263544]/50" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-sm rounded-t-3xl border border-line bg-white p-6 text-center shadow-overlay sm:rounded-3xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิด"
              className="nudge absolute right-4 top-4 rounded-full p-1.5 text-[#263544]"
            >
              <XIcon size={20} weight="bold" />
            </button>

            <h2 className="text-xl font-bold text-[#263544]">ติดต่อแอดมินทาง LINE</h2>
            <p className="mt-1 text-sm text-[#263544]/70">สแกน QR เพื่อเพิ่มเพื่อน แล้วทักแชทได้เลย</p>

            <div className="mx-auto mt-5 w-fit rounded-2xl border border-line p-3">
              <QRCodeSVG value={LINE_ADD_FRIEND_URL} size={200} marginSize={0} />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#263544]">
              LINE ID: <span style={{ color: LINE_GREEN }}>{LINE_ID}</span>
            </p>

            {/* บนมือถือสแกนจอตัวเองไม่ได้ จึงมีปุ่มเปิดแอป LINE ตรง ๆ */}
            <a
              href={LINE_ADD_FRIEND_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lift focus-ring mt-5 inline-flex h-11 w-full items-center justify-center rounded-full border border-line font-bold text-white"
              style={{ backgroundColor: LINE_GREEN }}
            >
              เพิ่มเพื่อนใน LINE
            </a>
          </div>
        </div>
      )}
    </>
  )
}
