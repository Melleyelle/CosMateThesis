import { CheckIcon } from '@phosphor-icons/react'

// แถบขั้นตอนแนวนอน: ขั้นก่อนหน้า = ติ๊กถูกสีชมพู, ขั้นปัจจุบัน = วงเหลือง, ขั้นถัดไป = สีเทา
// current = -1 คือยังไม่เริ่มขั้นไหนเลย
export default function StepProgress({
  steps,
  current,
  className = '',
}: {
  steps: string[]
  current: number
  className?: string
}) {
  return (
    <ol className={`flex overflow-x-auto rounded-2xl border-2 border-[#263544] bg-white p-4 ${className}`}>
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className="flex min-w-[88px] flex-1 flex-col items-center text-center"
          >
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done || active ? 'bg-[#E5457F]' : 'bg-gray-200'}`} />
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  done
                    ? 'border-[#E5457F] bg-[#E5457F] text-white'
                    : active
                      ? 'border-[#263544] bg-[#FFF3B0] text-[#263544]'
                      : 'border-gray-200 bg-white text-gray-300'
                }`}
              >
                {done ? <CheckIcon size={14} weight="bold" /> : i + 1}
              </span>
              <span
                className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'invisible' : done ? 'bg-[#E5457F]' : 'bg-gray-200'}`}
              />
            </div>
            <span className={`mt-1.5 text-[11px] ${active ? 'font-bold text-[#263544]' : 'text-[#263544]/50'}`}>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
