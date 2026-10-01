'use client'

import { useRef } from 'react'
import { uploadProductImage } from '@/utils/uploadProductImage'
import type { ProductImage } from './types'

type Props = {
  image: ProductImage | null
  onChange: (image: ProductImage | null) => void
  size?: 'lg' | 'sm'
}

function makeId() {
  return crypto.randomUUID()
}

export default function ImageUploadTile({ image, onChange, size = 'sm' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dimension = size === 'lg' ? 'h-40 w-40' : 'h-28 w-28'

  async function handleFile(file: File) {
    const previewUrl = URL.createObjectURL(file)
    const draft: ProductImage = {
      id: makeId(),
      previewUrl,
      uploadedUrl: null,
      uploading: true,
      error: null,
    }
    onChange(draft)

    const result = await uploadProductImage(file)

    if ('error' in result) {
      onChange({ ...draft, uploading: false, error: result.error })
      return
    }

    onChange({ ...draft, uploading: false, uploadedUrl: result.url })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = '' // เลือกไฟล์เดิมซ้ำได้ (เผื่ออัปโหลดครั้งก่อน error)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-1.5">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`relative ${dimension} cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition ${
          image?.error
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 bg-gray-50 hover:border-[#E5457F] hover:bg-[#FCE7EF]/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleInputChange}
          className="hidden"
        />

        {image ? (
          <>
            {/* ตอนเพิ่งเลือกไฟล์ใช้ blob URL ในเครื่องแสดงก่อน พอมี uploadedUrl ค่อยสลับไปโชว์รูปจริงจาก Supabase */}
            <img
              src={image.uploadedUrl ?? image.previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            {image.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
                กำลังอัปโหลด...
              </div>
            )}
            {!image.uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(null)
                }}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                aria-label="ลบรูปนี้"
              >
                ×
              </button>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
            <span className="text-2xl">+</span>
            <span className="text-xs">เพิ่มรูป</span>
          </div>
        )}
      </div>
      {image?.error && <p className="max-w-[160px] text-xs text-red-600">{image.error}</p>}
    </div>
  )
}