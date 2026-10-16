'use client'

// app/components/customer/MeasureGuide.tsx
// ปุ่ม "วิธีวัดตัว" + ป๊อปอัปอธิบายการวัดสัดส่วน ใช้คู่กับตัวเลือกไซส์/ตารางไซส์ในหน้ารายละเอียดชุด
// ใช้ <dialog> ของเบราว์เซอร์: ล็อกโฟกัสในป๊อปอัป, ปิดด้วย Esc, คืนโฟกัสให้ปุ่มเดิมเมื่อปิด
// หน่วยตรงกับ size_charts: รอบอก/เอว/สะโพก/ความยาว = นิ้ว · ส่วนสูง = ซม.

import { useEffect, useRef, useState } from 'react'
import { RulerIcon, XIcon } from '@phosphor-icons/react'

const STEPS = [
  {
    no: 1,
    title: 'รอบอก',
    unit: 'นิ้ว',
    how: 'พันสายวัดรอบส่วนที่กว้างที่สุดของหน้าอก ผ่านใต้รักแร้ ให้สายวัดขนานกับพื้นทั้งด้านหน้าและด้านหลัง',
  },
  {
    no: 2,
    title: 'รอบเอว',
    unit: 'นิ้ว',
    how: 'วัดรอบส่วนที่คอดที่สุดของลำตัว (มักอยู่เหนือสะดือเล็กน้อย) หายใจตามปกติ ไม่แขม่วท้อง',
  },
  {
    no: 3,
    title: 'รอบสะโพก',
    unit: 'นิ้ว',
    how: 'ยืนเท้าชิด วัดรอบส่วนที่กว้างที่สุดของสะโพกและก้น',
  },
  {
    no: 4,
    title: 'ความยาวชุด',
    unit: 'นิ้ว',
    how: 'วัดจากจุดบนสุดของบ่า (ชิดโคนคอ) ลงมาถึงตำแหน่งที่อยากให้ชายชุดอยู่ แล้วเทียบกับความยาวในตารางไซส์',
  },
  {
    no: 5,
    title: 'ส่วนสูง',
    unit: 'ซม.',
    how: 'ยืนตัวตรงชิดผนัง ไม่ใส่รองเท้า วัดจากพื้นถึงกลางศีรษะ',
  },
]

const TIPS = [
  'ใช้สายวัดแบบนิ่ม และวัดทับเสื้อผ้าบาง ๆ หรือชุดชั้นในที่จะใส่จริง',
  'ทาบสายวัดให้แนบตัว แต่ไม่ดึงจนรัด — ควรสอดนิ้วเข้าได้ 1 นิ้ว',
  'ให้คนอื่นช่วยวัดจะแม่นกว่าวัดเอง',
  'ถ้าสัดส่วนอยู่ระหว่างสองไซส์ แนะนำให้เลือกไซส์ใหญ่กว่า หรือทักถามแอดมินก่อนจอง',
]

export default function MeasureGuideButton({ className = '' }: { className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    // กันหน้าหลังเลื่อนตามขณะเปิดป๊อปอัป
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-[#B8285D] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4487D] focus-visible:ring-offset-2 ${className}`}
      >
        <RulerIcon size={18} aria-hidden="true" />
        วิธีวัดตัว
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="measure-guide-title"
        // Esc หรือ dialog.close() → sync state
        onClose={() => setOpen(false)}
        // คลิกพื้นหลังนอกกล่องเพื่อปิด
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false)
        }}
        className="m-auto max-h-[90vh] w-[calc(100%-32px)] max-w-2xl overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-0 text-[#2E2E2E] shadow-xl backdrop:bg-black/50"
      >
        <div className="flex max-h-[90vh] flex-col">
          {/* หัวป๊อปอัป */}
          <div className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] px-4 py-3 sm:px-5">
            <h2 id="measure-guide-title" className="text-xl font-bold">
              วิธีวัดตัวเพื่อเลือกไซส์
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิด"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#5C5C5C] hover:bg-[#F0F0F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4487D]"
            >
              <XIcon size={20} weight="bold" />
            </button>
          </div>

          {/* เนื้อหา (เลื่อนได้เมื่อจอเตี้ย) */}
          <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
              <BodyFigure />
              <ol className="space-y-3">
                {STEPS.map((s) => (
                  <li key={s.no} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E4487D] text-sm font-bold text-white">
                      {s.no}
                    </span>
                    <div>
                      <p className="font-semibold leading-7">
                        {s.title} <span className="text-sm font-normal text-[#6E6E6E]">({s.unit})</span>
                      </p>
                      <p className="text-sm leading-relaxed text-[#5C5C5C]">{s.how}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-5 rounded-xl bg-[#F7F7F7] p-4">
              <p className="font-semibold">เคล็ดลับให้วัดแม่น</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[#5C5C5C]">
                {TIPS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>

            <CmToInch />
          </div>
        </div>
      </dialog>
    </>
  )
}

// ตัวแปลง ซม. → นิ้ว (ตารางไซส์ของร้านเป็นนิ้ว แต่สายวัดหลายบ้านเป็น ซม.)
function CmToInch() {
  const [cm, setCm] = useState('')
  const value = Number(cm)
  const valid = cm !== '' && Number.isFinite(value) && value > 0

  return (
    <div className="mt-4 rounded-xl border border-[#E5E5E5] p-4">
      <label htmlFor="cm-to-inch" className="font-semibold">
        มีแต่สายวัดเซนติเมตร?
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="relative">
          <input
            id="cm-to-inch"
            type="number"
            inputMode="decimal"
            min={0}
            value={cm}
            onChange={(e) => setCm(e.target.value)}
            placeholder="เช่น 86"
            className="h-11 w-32 rounded-xl border border-[#D4D4D4] px-3 pr-11 text-base outline-none focus-visible:border-[#E4487D] focus-visible:ring-2 focus-visible:ring-[#E4487D]/30"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6E6E6E]">
            ซม.
          </span>
        </div>
        <p aria-live="polite" className="text-base">
          = <span className="font-bold">{valid ? (value / 2.54).toFixed(1) : '—'}</span> นิ้ว
        </p>
      </div>
    </div>
  )
}

// ภาพประกอบตำแหน่งวัด — หุ่นเรียบ ๆ เลขตรงกับขั้นตอนด้านขวา
function BodyFigure() {
  return (
    <svg
      viewBox="0 0 160 300"
      className="mx-auto h-64 w-auto sm:h-auto sm:w-full"
      role="img"
      aria-label="ภาพตำแหน่งวัดรอบอก รอบเอว รอบสะโพก และความยาวชุด"
    >
      {/* หุ่น */}
      <g fill="#F0F0F0" stroke="#D4D4D4" strokeWidth="1.5">
        <circle cx="80" cy="28" r="18" />
        <path d="M70 46 h20 v8 h-20 z" />
        <path d="M44 62 Q80 50 116 62 L122 120 Q118 150 112 160 Q122 190 120 215 L106 290 H90 L82 220 H78 L70 290 H54 L40 215 Q38 190 48 160 Q42 150 38 120 Z" />
        <path d="M44 62 L28 140 L36 142 L50 84" />
        <path d="M116 62 L132 140 L124 142 L110 84" />
      </g>

      {/* เส้นวัด: อก เอว สะโพก */}
      <g stroke="#E4487D" strokeWidth="2.5" strokeDasharray="5 4" fill="none">
        <path d="M40 92 Q80 100 120 92" />
        <path d="M44 140 Q80 147 116 140" />
        <path d="M41 182 Q80 190 119 182" />
      </g>
      {/* ความยาวชุด: บ่าถึงชายชุด */}
      <g stroke="#2E2E2E" strokeWidth="2">
        <path d="M100 58 V232" />
        <path d="M95 58 H105 M95 232 H105" />
      </g>

      {/* ป้ายเลข */}
      {[
        { n: 1, x: 22, y: 92 },
        { n: 2, x: 26, y: 140 },
        { n: 3, x: 22, y: 182 },
        { n: 4, x: 100, y: 250 },
      ].map((p) => (
        <g key={p.n}>
          <circle cx={p.x} cy={p.y} r="10" fill="#E4487D" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
            {p.n}
          </text>
        </g>
      ))}
    </svg>
  )
}