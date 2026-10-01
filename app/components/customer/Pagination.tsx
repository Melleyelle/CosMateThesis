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
    <nav aria-label="เปลี่ยนหน้า" className="mt-10 flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="หน้าก่อนหน้า"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-[#263544] transition hover:bg-[#FDE3EE] disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <CaretLeftIcon size={20} weight="bold" />
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-2 text-[#263544]/50">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`h-10 min-w-[40px] rounded-lg px-2 text-sm font-semibold transition ${
              p === page ? 'bg-[#263544] text-white' : 'text-[#263544] hover:bg-[#FDE3EE]'
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
        className="flex h-10 w-10 items-center justify-center rounded-lg text-[#263544] transition hover:bg-[#FDE3EE] disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <CaretRightIcon size={20} weight="bold" />
      </button>
    </nav>
  )
}
