'use client'

import { useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
}

// ช่องกรอกพร้อม label รับ props ของ <input> ได้ทุกอย่าง (type, value, onChange, required ฯลฯ)
export default function AuthField({ id, label, ...inputProps }: Props) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const isPasswordField = inputProps.type === 'password'

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-lg font-medium text-gray-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...inputProps}
          type={isPasswordField && isPasswordVisible ? 'text' : inputProps.type}
          className={`w-full rounded-2xl border-2 border-gray-200 bg-white py-3 pl-5 ${isPasswordField ? 'pr-14' : 'pr-5'} text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#E5457F] focus:ring-4 focus:ring-[#E5457F]/15`}
        />
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            aria-label={isPasswordVisible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            aria-pressed={isPasswordVisible}
            className="absolute inset-y-0 right-3 flex items-center px-2 text-gray-500 transition hover:text-[#E5457F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5457F]"
          >
            {isPasswordVisible ? <EyeSlash size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
    </div>
  )
}
