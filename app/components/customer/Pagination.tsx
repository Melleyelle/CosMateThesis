import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'

// เลขหน้าแบบ 1 2 3 … 45 ตามดีไซน์
function pageList(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p))
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const result: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap')
    result.push(p)
  })
  return result
}

// design v2: ปุ่มรองเส้น 1px ยก + เงาแข็งตอน hover (.lift) · หน้าปัจจุบันพื้น brand-soft เส้นดำ (ไม่ใช้พื้นดำ)
const stepClass =
  'lift focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink disabled:cursor-not-allowed disabled:opacity-40'

export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="เปลี่ยนหน้า" className="mt-10 flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="หน้าก่อนหน้า"
        className={stepClass}
      >
        <CaretLeftIcon size={18} weight="bold" />
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-body text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`focus-ring h-11 min-w-11 rounded-full border px-3 text-body tabular-nums transition ${
              p === page ? 'border-line bg-brand-soft font-bold text-ink' : 'border-transparent font-semibold text-ink hover:border-line'
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="หน้าถัดไป"
        className={stepClass}
      >
        <CaretRightIcon size={18} weight="bold" />
      </button>
    </nav>
  )
}
