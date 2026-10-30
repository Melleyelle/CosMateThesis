import Image from 'next/image'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  className?: string
  title: string
  description?: ReactNode
  action?: ReactNode
  illustration?: boolean // false = ไม่มีภาพ (โหลดไม่สำเร็จ / หน้าแอดมิน)
}

// ภาพประกอบตกแต่ง ข้อความข้าง ๆ บอกสถานะอยู่แล้ว จึงไม่ต้องมี alt
export function EmptyIllustration({ className }: { className?: string }) {
  return (
    <Image
      src="/images/EmptyState.png"
      alt=""
      width={176}
      height={176}
      className={`mx-auto h-36 w-36 sm:h-44 sm:w-44 ${className ?? ''}`}
    />
  )
}

export default function EmptyState({ className, title, description, action, illustration = true }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className ?? ''}`}>
      {illustration && <EmptyIllustration className="mb-4" />}
      <h2 className="text-lg font-semibold text-[#263544]">{title}</h2>
      {description && <p className="mt-2 max-w-lg text-base text-[#263544]/65">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
