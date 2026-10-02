import type { InputHTMLAttributes } from 'react'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
}

export default function AuthField({ id, label, className, ...inputProps }: AuthFieldProps) {
  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-base font-medium text-[#263544]">
        {label}
      </label>
      <input
        id={id}
        {...inputProps}
        className={`w-full rounded-xl border-2 border-[#EEEDF2] px-5 py-3 text-base text-[#263544] outline-none transition placeholder:text-[#263544]/40 focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/20 ${className ?? ''}`}
      />
    </div>
  )
}