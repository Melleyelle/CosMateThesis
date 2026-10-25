'use client'

import { useState } from 'react'
import { formatBaht } from '@/utils/dateUtils'
import type { rentalDaysStats } from '@/utils/admin/fetchDashboard'

type Stats = ReturnType<typeof rentalDaysStats>

// การกระจายจำนวนวันเช่า: แท่งแนวนอนหนึ่งแถวต่อจำนวนวัน (1 ชุดข้อมูล ไม่ต้องมี legend — หัวข้อแผงบอกแล้ว)
// ตัวเลขสรุป 3 ตัวอยู่บนสุด เพราะเป็นคำตอบที่แอดมินอยากรู้ก่อนดูรูปร่างการกระจาย
export default function RentalDaysChart({ stats }: { stats: Stats }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...stats.byDays.map((b) => b.items))

  return (
    <div className="px-5 pb-5 pt-4">
      <dl className="grid grid-cols-3 gap-3 border-b border-[#EEEDF2] pb-4">
        <Stat label="ค่าเช่าวันแรก" value={formatBaht(stats.baseRevenue)} />
        <Stat label="ค่าวันเพิ่ม" value={formatBaht(stats.extraRevenue)} />
        <Stat label="เช่าเฉลี่ย" value={stats.avgDays != null ? `${stats.avgDays.toFixed(1)} วัน` : '—'} />
      </dl>

      {stats.items === 0 ? (
        <p className="py-8 text-center text-sm text-[#6B7280]">ยังไม่มีรายการเช่าที่ชำระเงินแล้วในช่วงนี้</p>
      ) : (
        <ul className="mt-3 space-y-[2px]" onMouseLeave={() => setHover(null)}>
          {stats.byDays.map((b, i) => {
            const pct = Math.round((b.items / stats.items) * 100)
            const active = hover === i
            return (
              <li key={b.days}>
                <button
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`เช่า ${b.days} วัน: ${b.items} รายการ (${pct}%) ค่าวันเพิ่ม ${formatBaht(b.extraFee)}`}
                  className={`grid w-full grid-cols-[3.25rem_1fr_4.5rem] items-center gap-2 rounded-lg px-1 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#E5457F] ${
                    active ? 'bg-[#F7F6FA]' : ''
                  }`}
                >
                  <span className="text-xs tabular-nums text-[#6B7280]">{b.days} วัน</span>
                  <span className="h-3">
                    {b.items > 0 && (
                      <span
                        className={`block h-full rounded-r-[4px] transition-colors ${active ? 'bg-[#3D5068]' : 'bg-[#263544]'}`}
                        style={{ width: `max(4px, ${(b.items / max) * 100}%)` }}
                      />
                    )}
                  </span>
                  <span className="text-right text-xs tabular-nums text-[#263544]">
                    {active && b.extraFee > 0 ? formatBaht(b.extraFee) : b.items > 0 ? `${b.items} · ${pct}%` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-[#6B7280]">ชี้ที่แถวเพื่อดูค่าวันเพิ่มของกลุ่มนั้น</p>

      {/* ตารางสำหรับโปรแกรมอ่านหน้าจอ */}
      <table className="sr-only">
        <caption>จำนวนรายการเช่าแยกตามจำนวนวัน</caption>
        <tbody>
          {stats.byDays.map((b) => (
            <tr key={b.days}>
              <th>{b.days} วัน</th>
              <td>{b.items} รายการ</td>
              <td>ค่าวันเพิ่ม {formatBaht(b.extraFee)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-[#6B7280]">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-bold tabular-nums text-[#263544]">{value}</dd>
    </div>
  )
}
