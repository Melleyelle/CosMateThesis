'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
}

export default function AuthField({ id, label, className, type, ...inputProps }: AuthFieldProps) {
  const isPassword = type === 'password'
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-base font-medium text-[#263544]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && showPassword ? 'text' : type}
          {...inputProps}
          className={`w-full rounded-xl border-2 border-[#EEEDF2] px-5 py-3 text-base text-[#263544] outline-none transition placeholder:text-[#263544]/40 focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/20 ${
            isPassword ? 'pr-14' : ''
          } ${className ?? ''}`}
        />
        {/* ช่องรหัสผ่าน: ปุ่มตาสลับเปิด/ปิดดูรหัสผ่าน */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            aria-pressed={showPassword}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#263544]/50 transition hover:text-[#E5457F] focus-visible:text-[#E5457F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5457F]/30"
          >
            {showPassword ? <EyeSlashIcon size={22} /> : <EyeIcon size={22} />}
          </button>
        )}
      </div>
    </div>
  )
}
