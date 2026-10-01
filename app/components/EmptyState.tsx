import Image from 'next/image'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

// ใช้ได้ทั้งฝั่งลูกค้าและแอดมิน — ส่ง className มาเพื่อกำหนดพื้นหลัง/กรอบตามหน้านั้น ๆ
export default function EmptyState({ title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <Image src="/images/EmptyState.png" alt="" width={144} height={144} className="h-36 w-36" />
      <p className="mt-4 font-semibold text-[#263544]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-[#263544]/60">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
