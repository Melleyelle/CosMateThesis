'use client'

// app/components/customer/MeasureGuide.tsx
// ปุ่ม "วิธีวัดตัว" + ป๊อปอัปอธิบายการวัดสัดส่วน ใช้คู่กับตัวเลือกไซส์/ตารางไซส์ในหน้ารายละเอียดชุด
// ใช้ <dialog> ของเบราว์เซอร์: ล็อกโฟกัสในป๊อปอัป, ปิดด้วย Esc, คืนโฟกัสให้ปุ่มเดิมเมื่อปิด
// หน่วยตรงกับ size_charts: รอบอก/เอว/สะโพก/ความยาว = นิ้ว
// kind="shoes" (ชุดที่ size_system = shoes) แสดงวิธีวัดความยาวเท้าแทน หน่วย ซม. ตรงกับ foot_min_cm/foot_max_cm

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { RulerIcon, XIcon } from '@phosphor-icons/react'

type Step = { no: number; title: string; unit?: string; how: string }

const STEPS: Step[] = [
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
]

const TIPS = [
  'ใช้สายวัดแบบนิ่ม และวัดทับเสื้อผ้าบาง ๆ หรือชุดชั้นในที่จะใส่จริง',
  'ทาบสายวัดให้แนบตัว แต่ไม่ดึงจนรัด — ควรสอดนิ้วเข้าได้ 1 นิ้ว',
  'ให้คนอื่นช่วยวัดจะแม่นกว่าวัดเอง',
  'ถ้าสัดส่วนอยู่ระหว่างสองไซส์ แนะนำให้เลือกไซส์ใหญ่กว่า หรือทักถามแอดมินก่อนจอง',
]

const FOOT_STEPS: Step[] = [
  {
    no: 1,
    title: 'วางเท้าลงบนกระดาษ',
    how: 'วางกระดาษบนพื้นเรียบ ใส่ถุงเท้าที่จะใส่จริง แล้ววางเท้าลงบนกระดาษ ลงน้ำหนักเต็มเท้า (ยืน ไม่ใช่นั่ง เพราะเท้าจะยาวขึ้นเมื่อรับน้ำหนัก)',
  },
  {
    no: 2,
    title: 'วาดรูปเท้า',
    how: 'ใช้ดินสอหรือปากกาลากเส้นรอบเท้า จับปากกาตั้งตรง ไม่เอียงเข้าหาเท้า ให้คนอื่นช่วยวาดจะแม่นกว่า',
  },
  {
    no: 3,
    title: 'วัดขนาด',
    unit: 'ซม.',
    how: 'ใช้ไม้บรรทัดวัดความยาวจากปลายนิ้วที่ยาวที่สุดถึงส้นเท้า (เส้นประในภาพ) แล้วเทียบกับช่วงความยาวเท้าในตารางไซส์รองเท้า',
  },
]

const FOOT_TIPS = [
  'วัดทั้งสองข้าง แล้วใช้ค่าของเท้าข้างที่ยาวกว่า',
  'วัดช่วงเย็น เท้าจะขยายกว่าตอนเช้าเล็กน้อย ได้ไซส์ที่ใส่สบายตลอดงาน',
  'ถ้าความยาวเท้าอยู่ระหว่างสองไซส์ แนะนำให้เลือกไซส์ใหญ่กว่า',
]

export default function MeasureGuideButton({
  className = '',
  kind = 'clothing',
}: {
  className?: string
  kind?: 'clothing' | 'shoes'
}) {
  const shoes = kind === 'shoes'
  const steps = shoes ? FOOT_STEPS : STEPS
  const tips = shoes ? FOOT_TIPS : TIPS
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
        {shoes ? 'วิธีวัดเท้า' : 'วิธีวัดตัว'}
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
        className="m-auto max-h-[90vh] w-[calc(100%-32px)] max-w-3xl overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-0 text-[#2E2E2E] shadow-xl backdrop:bg-black/50"
      >
        <div className="flex max-h-[90vh] flex-col">
          {/* หัวป๊อปอัป */}
          <div className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] px-4 py-3 sm:px-5">
            <h2 id="measure-guide-title" className="text-xl font-bold">
              {shoes ? 'วิธีวัดเท้าเพื่อเลือกไซส์รองเท้า' : 'วิธีวัดตัวเพื่อเลือกไซส์'}
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
            <div className="grid items-start gap-5 sm:grid-cols-[260px_1fr]">
              <MeasureFigure shoes={shoes} />
              <div>
                {shoes && (
                  <p className="mb-4 rounded-xl bg-[#FDEEF3] px-4 py-2.5 text-sm text-[#2E2E2E]">
                    <span className="font-semibold">อุปกรณ์:</span> กระดาษ · ดินสอหรือปากกา · ไม้บรรทัด
                  </p>
                )}
                <ol className="space-y-3">
                  {steps.map((s) => (
                    <li key={s.no} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E4487D] text-sm font-bold text-white">
                        {s.no}
                      </span>
                      <div>
                        <p className="font-semibold leading-7">
                          {s.title}
                          {s.unit && <span className="text-sm font-normal text-[#6E6E6E]"> ({s.unit})</span>}
                        </p>
                        <p className="text-sm leading-relaxed text-[#5C5C5C]">{s.how}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-[#F7F7F7] p-4">
              <p className="font-semibold">เคล็ดลับให้วัดแม่น</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[#5C5C5C]">
                {tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>

            {/* ตารางรองเท้าเป็น ซม. อยู่แล้ว ไม่ต้องแปลงหน่วย */}
            {!shoes && <CmToInch />}
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

// ภาพตำแหน่งวัด (public/images) — ภาพตัว: เลข 1–4 ตรงกับขั้นตอน (อก/เอว/สะโพก/ความยาวชุด)
// ภาพเท้า: เส้นประคือความยาวเท้าที่ใช้เลือกไซส์
// ภาพต้นฉบับจัตุรัสมีขอบโปร่งใสด้านข้างเยอะ → ครอปเป็น 3:4 ให้ตัวภาพใหญ่ขึ้น (เลขกำกับยังอยู่ในกรอบ)
function MeasureFigure({ shoes }: { shoes: boolean }) {
  return (
    <figure className="mx-auto w-full max-w-72 sm:max-w-none">
      <Image
        src={shoes ? '/images/Foot-measurement01.png' : '/images/Body-measurement01.png'}
        alt={
          shoes
            ? 'ภาพฝ่าเท้า: เส้นประจากปลายนิ้วที่ยาวที่สุดถึงส้นเท้าคือความยาวเท้า'
            : 'ภาพตำแหน่งวัด 1 รอบอก 2 รอบเอว 3 รอบสะโพก 4 ความยาวชุดจากบ่า'
        }
        width={2000}
        height={2000}
        sizes="(min-width: 640px) 260px, 288px"
        className="aspect-[3/4] w-full object-cover"
      />
    </figure>
  )
}
