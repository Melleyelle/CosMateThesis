'use client'

import { useState } from 'react'
import { addDays, formatBaht, formatThaiDate } from '@/utils/dateUtils'

type Week = { start: string; total: number; orders: number }

const HEIGHT = 168

function niceMax(v: number) {
  if (v <= 0) return 1000
  const pow = 10 ** Math.floor(Math.log10(v))
  const steps = [1, 2, 2.5, 5, 10]
  return (steps.find((s) => s * pow >= v) ?? 10) * pow
}

const short = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('th-TH', { maximumFractionDigits: 1 })}k` : `${n}`)

// แท่งรายได้รายสัปดาห์ (1 ชุดข้อมูล ไม่ต้องมี legend — หัวข้อแผงบอกแล้วว่าคืออะไร)
// สัปดาห์ปัจจุบันเป็นชมพูเพราะยังไม่จบสัปดาห์ และมีป้ายข้อความ "สัปดาห์นี้" กำกับ (ไม่ใช้สีอย่างเดียว)
export default function WeeklyRevenueChart({ weeks }: { weeks: Week[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = niceMax(Math.max(...weeks.map((w) => w.total)))
  const peak = weeks.reduce((best, w, i) => (w.total > weeks[best].total ? i : best), 0)
  const last = weeks.length - 1
  const hasData = weeks.some((w) => w.total > 0)

  return (
    <div className="px-5 pb-4 pt-5">
      <div className="relative" style={{ height: HEIGHT + 28 }} onMouseLeave={() => setHover(null)}>
        {/* เส้นกริด (จางมาก) */}
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2" style={{ bottom: 28 + f * HEIGHT }}>
            <span className="w-10 text-right text-[10px] tabular-nums text-[#9AA3AF]">{short(max * f)}</span>
            <span className={`h-px flex-1 ${f === 0 ? 'bg-[#D5D9E0]' : 'bg-[#EEEDF2]'}`} />
          </div>
        ))}

        <div className="absolute bottom-0 left-12 right-0 flex items-end justify-around" style={{ height: HEIGHT + 28 }}>
          {weeks.map((w, i) => {
            const h = Math.max(w.total > 0 ? 4 : 0, (w.total / max) * HEIGHT)
            const current = i === last
            const showValue = w.total > 0 && (current || i === peak || hover === i)
            return (
              <button
                key={w.start}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`สัปดาห์ ${formatThaiDate(w.start)}: ${formatBaht(w.total)} จาก ${w.orders} ออเดอร์`}
                className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
              >
                <span
                  className={`mb-1 text-[11px] font-semibold tabular-nums text-[#263544] transition-opacity ${
                    showValue ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {short(w.total)}
                </span>
                <span
                  className={`w-[60%] max-w-[30px] rounded-t-[4px] transition-colors ${
                    current ? 'bg-[#E5457F]' : hover === i ? 'bg-[#3D5068]' : 'bg-[#263544]'
                  } group-focus-visible:ring-2 group-focus-visible:ring-[#E5457F] group-focus-visible:ring-offset-2`}
                  style={{ height: h }}
                />
                <span className={`mt-2 h-[18px] text-[10px] tabular-nums ${current ? 'font-semibold text-[#C92D67]' : 'text-[#6B7280]'}`}>
                  {current ? 'สัปดาห์นี้' : formatThaiDate(w.start)}
                </span>
              </button>
            )
          })}
        </div>

        {hover !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 w-48 -translate-x-1/2 rounded-xl border border-[#E4E3EA] bg-white p-3 text-xs shadow-[0_8px_24px_rgba(38,53,68,0.14)]"
            style={{ left: `calc(3rem + (100% - 3rem) * ${(hover + 0.5) / weeks.length})`, top: 0 }}
          >
            <p className="text-[#6B7280]">
              {formatThaiDate(weeks[hover].start)} – {formatThaiDate(addDays(weeks[hover].start, 6))}
            </p>
            <p className="mt-1 text-base font-bold tabular-nums text-[#263544]">{formatBaht(weeks[hover].total)}</p>
            <p className="text-[#5B6472]">{weeks[hover].orders} ออเดอร์</p>
          </div>
        )}

        {!hasData && (
          <p className="absolute inset-x-12 top-1/3 text-center text-sm text-[#6B7280]">
            ยังไม่มีออเดอร์ที่ชำระเงินแล้วใน 8 สัปดาห์นี้
          </p>
        )}
      </div>

      {/* ตารางสำหรับโปรแกรมอ่านหน้าจอ */}
      <table className="sr-only">
        <caption>รายได้ค่าเช่าและค่าซักรายสัปดาห์</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <th>{formatThaiDate(w.start)}</th>
              <td>{formatBaht(w.total)}</td>
              <td>{w.orders} ออเดอร์</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
