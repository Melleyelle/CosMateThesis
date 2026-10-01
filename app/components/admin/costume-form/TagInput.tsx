'use client'

import { useState } from 'react'

type Props = {
  label: string
  placeholder: string
  tags: string[]
  onChange: (tags: string[]) => void
}

// พิมพ์แล้วกด Enter หรือ , เพื่อเพิ่มแท็ก คลิก x เพื่อลบ ใช้กับ color_tags และ theme_tags
export default function TagInput({ label, placeholder, tags, onChange }: Props) {
  const [draft, setDraft] = useState('')

  function addTag(raw: string) {
    const value = raw.trim().toLowerCase()
    if (value && !tags.includes(value)) {
      onChange([...tags, value])
    }
    setDraft('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 focus-within:border-[#E5457F] focus-within:ring-2 focus-within:ring-[#E5457F]/15">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-[#FCE7EF] px-3 py-1 text-xs font-medium text-[#E5457F]"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-[#E5457F]/70 hover:text-[#E5457F]"
              aria-label={`ลบแท็ก ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && addTag(draft)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="min-w-[80px] flex-1 border-none bg-transparent p-1 text-sm text-gray-900 outline-none placeholder:text-gray-400"
        />
      </div>
    </div>
  )
}