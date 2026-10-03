import type { ReactNode } from 'react'
import { TONE_CLASS, TONE_DOT, type Tone } from '@/utils/admin/statusTone'

// ชิ้นส่วนพื้นฐานของหลังร้าน — ทุกหน้าแอดมินใช้ชุดเดียวกันเพื่อให้หน้าตาสม่ำเสมอ
// กติกา: พื้นที่ข้อมูลเรียบ (ขาว + เส้นบาง) / กรอบหนา+เงาแข็งเฉพาะปุ่มหลักและจุดที่ต้องลงมือ

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-[#263544]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[#5B6472]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Panel({
  title,
  description,
  action,
  children,
  className = '',
  bodyClassName = 'p-5',
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`rounded-2xl border border-[#E4E3EA] bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-[#EEEDF2] px-5 py-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-[#263544]">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-[#6B7280]">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
      {children}
    </span>
  )
}

// ตัวเลขสรุปแบบเรียง 1 แถวในแผงเดียว คั่นด้วยเส้นตั้ง (ไม่ใช่การ์ดแยกเหมือนกันหมด)
export function MetricStrip({ children }: { children: ReactNode }) {
  return (
    // gap-px บนพื้นเทา = เส้นคั่นบาง 1px ระหว่างช่อง ทั้งแนวตั้งและแนวนอน (ไม่ต้องคำนวณ border ทีละช่อง)
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#E4E3EA] bg-[#EEEDF2] lg:grid-cols-4 [&>*]:bg-white">
      {children}
    </div>
  )
}

export function Metric({
  label,
  value,
  note,
  onClick,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  onClick?: () => void
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-[#6B7280]">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-[#263544]">{value}</p>
      {note && <p className="mt-1 text-xs text-[#6B7280]">{note}</p>}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="px-5 py-4 text-left transition hover:bg-[#FAFAFC]">
      {body}
    </button>
  ) : (
    <div className="px-5 py-4">{body}</div>
  )
}

// ปุ่มหลัก (ใช้ภาษาแบรนด์: ชมพู + กรอบกรมท่า + เงาแข็ง) — 1 ปุ่มต่อหน้า
export const primaryButtonClass =
  'inline-flex items-center gap-2 rounded-full border-2 border-[#263544] bg-[#E5457F] px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_0_#263544] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#263544] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'

// ปุ่มรอง (เรียบ)
export const secondaryButtonClass =
  'inline-flex items-center gap-2 rounded-full border border-[#D5D9E0] bg-white px-4 py-2 text-sm font-medium text-[#263544] transition hover:border-[#263544]'

// แท็บกรองแบบเรียบ: เลือกอยู่ = กรมท่าทึบ
export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  counts,
}: {
  tabs: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  counts?: Partial<Record<T, number>>
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {tabs.map((t) => {
        const active = t.value === value
        const count = counts?.[t.value]
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active ? 'bg-[#263544] text-white' : 'text-[#5B6472] hover:bg-white hover:text-[#263544]'
            }`}
          >
            {t.label}
            {count !== undefined && (
              <span
                className={`min-w-[20px] rounded-full px-1.5 text-center text-xs tabular-nums ${
                  active ? 'bg-white/20' : 'bg-[#E9E8EF] text-[#5B6472]'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ตัวเลือกแบบ segmented (ตัวเลือกน้อย ≤ 4 และใช้บ่อย → เห็นครบ กดครั้งเดียว)
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-[#D5D9E0] bg-white p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active ? 'bg-[#E5457F] text-white' : 'text-[#5B6472] hover:text-[#263544]'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`text-xs tabular-nums ${active ? 'text-white/70' : 'text-[#9AA3AF]'}`}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// dropdown กรองข้อมูล (ตัวเลือกเยอะ/ใช้นาน ๆ ครั้ง) — ใช้ select จริงของเบราว์เซอร์ จึงใช้คีย์บอร์ดและมือถือได้ดี
// เมื่อเลือกค่าอื่นที่ไม่ใช่ "ทั้งหมด" กรอบจะเข้มขึ้น ให้รู้ว่ามีตัวกรองค้างอยู่
export function SelectFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  allValue,
}: {
  label: string
  options: readonly { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  allValue: T
}) {
  const active = value !== allValue
  return (
    <label
      className={`relative inline-flex items-center rounded-full border bg-white transition focus-within:ring-2 focus-within:ring-[#263544]/10 ${
        active ? 'border-[#263544]' : 'border-[#D5D9E0] hover:border-[#9AA3AF]'
      }`}
    >
      <span className="pointer-events-none pl-4 text-xs text-[#6B7280]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`cursor-pointer appearance-none bg-transparent py-2 pl-1.5 pr-9 text-sm outline-none ${
          active ? 'font-semibold text-[#263544]' : 'font-medium text-[#263544]'
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.count !== undefined ? ` (${o.count})` : ''}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3.5 h-3.5 w-3.5 text-[#5B6472]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-[#6B7280]">{children}</p>
}
