import Link from 'next/link'
import { StatusBadge } from '../ui'
import type { DamageSummary, IdleCostume, SizeUtilization } from '@/utils/admin/dashboardInsights'
import { DEDUCTION_LABEL } from '@/utils/admin/orderOps'
import { dayDiff } from '@/utils/admin/fetchDashboard'
import { formatBaht, formatThaiDateLong } from '@/utils/dateUtils'

// เกณฑ์ "เต็ม" ที่ควรซื้อเพิ่มไซส์นั้น / "ว่าง" ที่ควรโปรโมต
export const UTIL_FULL = 0.75
const UTIL_LOW = 0.2

const empty = (text: string) => <p className="px-5 py-10 text-center text-sm text-[#6B7280]">{text}</p>

// อัตราการใช้งานรายชุด×ไซส์: แท่งแนวนอน มีเส้นเกณฑ์ 75% ให้เห็นว่าแถวไหนข้ามเส้น
export function UtilizationBySize({ rows, max = 8 }: { rows: SizeUtilization[]; max?: number }) {
  if (rows.length === 0) return empty('ยังไม่มีชุดที่เปิดให้เช่า')
  // แถวที่เต็มแสดงทั้งหมด ที่เหลือเติมจนครบ max
  const full = rows.filter((r) => r.rate >= UTIL_FULL)
  const shown = full.length >= max ? full : rows.slice(0, max)
  return (
    <ul className="space-y-3 px-5 py-5">
      {shown.map((r) => {
        const pct = Math.round(r.rate * 100)
        return (
          <li key={`${r.productId}|${r.size}`}>
            <Link href={`/admin/inventory/${r.productId}/edit`} className="group block">
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm text-[#263544] group-hover:text-[#C92D67]">
                  <span className="font-medium">{r.productName}</span>
                  <span className="text-[#6B7280]"> · ไซส์ {r.size} · {r.units} ตัว</span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-2">
                  {r.rate >= UTIL_FULL && <StatusBadge tone="action">ควรซื้อเพิ่ม</StatusBadge>}
                  {r.rate < UTIL_LOW && <StatusBadge tone="waiting">ว่างมาก</StatusBadge>}
                  <span className="w-10 text-right text-sm font-semibold tabular-nums text-[#263544]">{pct}%</span>
                </span>
              </span>
              <span className="relative mt-1.5 block h-1.5 rounded-full bg-[#F0EFF4]">
                <span
                  className={`block h-full rounded-full ${r.rate >= UTIL_FULL ? 'bg-[#E59A00]' : 'bg-[#263544]'}`}
                  style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                />
                <span aria-hidden className="absolute -top-0.5 h-2.5 w-px bg-[#9AA3AF]" style={{ left: `${UTIL_FULL * 100}%` }} />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function IdleCostumes({ rows, today, max = 6 }: { rows: IdleCostume[]; today: string; max?: number }) {
  if (rows.length === 0) return empty('ทุกชุดถูกเช่าหรือมีคิวจองใน 60 วันที่ผ่านมา')
  return (
    <>
      <ul className="divide-y divide-[#EEEDF2]">
        {rows.slice(0, max).map((r) => (
          <li key={r.productId}>
            <Link
              href={`/admin/inventory/${r.productId}/edit`}
              className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-[#FAFAFC]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[#263544]">{r.productName}</span>
                <span className="block text-xs text-[#6B7280]">
                  {r.lastRentedEnd ? `เช่าครั้งล่าสุด ${formatThaiDateLong(r.lastRentedEnd)}` : 'ยังไม่เคยถูกเช่า'} · {r.units} ตัว
                </span>
              </span>
              <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-[#263544]">
                {r.lastRentedEnd ? `${dayDiff(r.lastRentedEnd, today)} วัน` : '—'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > max && (
        <p className="border-t border-[#EEEDF2] px-5 py-2.5 text-xs text-[#6B7280]">และอีก {rows.length - max} ชุด</p>
      )}
    </>
  )
}

// สาเหตุความเสียหาย (แท่ง) + ชุดที่เสียซ้ำ (≥ 2 ครั้ง ขึ้นป้าย)
export function DamageByCause({ summary }: { summary: DamageSummary }) {
  if (summary.byType.length === 0) return empty('ไม่มีการหักมัดจำจากชุดเสียหายใน 90 วันที่ผ่านมา')
  const max = Math.max(...summary.byType.map((t) => t.count))
  return (
    <div className="px-5 py-5">
      <ul className="space-y-3">
        {summary.byType.map((t) => (
          <li key={t.type}>
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-[#263544]">{DEDUCTION_LABEL[t.type] ?? t.type}</span>
              <span className="tabular-nums text-[#5B6472]">
                <span className="font-semibold text-[#263544]">{t.count} ครั้ง</span> · {formatBaht(t.amount)}
              </span>
            </span>
            <span className="mt-1.5 block h-1.5 rounded-full bg-[#F0EFF4]">
              <span className="block h-full rounded-full bg-[#263544]" style={{ width: `${Math.max(6, (t.count / max) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>

      <p className="mb-2 mt-5 text-xs font-medium text-[#6B7280]">ชุดที่เกิดเรื่องบ่อย</p>
      <ul className="space-y-1.5">
        {summary.byCostume.slice(0, 4).map((c) => (
          <li key={c.productId ?? c.productName} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-[#263544]">
              {c.productName}
              <span className="text-xs text-[#6B7280]"> · {c.types.map((t) => DEDUCTION_LABEL[t] ?? t).join(', ')}</span>
            </span>
            {c.count >= 2 ? (
              <StatusBadge tone="problem">{c.count} ครั้ง</StatusBadge>
            ) : (
              <span className="text-xs tabular-nums text-[#6B7280]">1 ครั้ง</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
