import type { ReactNode } from 'react'

interface EmptyStateProps {
  className?: string
  title: string
  description?: ReactNode
  action?: ReactNode
}

export default function EmptyState({ className, title, description, action }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className ?? ''}`}>
      <h2 className="text-lg font-semibold text-[#263544]">{title}</h2>
      {description && <p className="mt-2 max-w-lg text-sm text-[#263544]/65">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}