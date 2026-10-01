import type { InputHTMLAttributes } from 'react'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
}

export default function AuthField({ id, label, className, ...inputProps }: AuthFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[#263544]">
        {label}
      </label>
      <input
        id={id}
        {...inputProps}
        className={`w-full rounded-lg border border-gray-300 px-4 py-3 text-[#263544] outline-none transition focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/20 ${className ?? ''}`}
      />
    </div>
  )
}