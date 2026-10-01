'use client'

import SectionCard from './Sectioncard'
import ImageUploadTile from './ImageUploadTile'
import type { ProductImage } from './types'

type Props = {
  coverImage: ProductImage | null
  onCoverImageChange: (image: ProductImage | null) => void
  images: ProductImage[]
  onImagesChange: (images: ProductImage[]) => void
}

function makeId() {
  return crypto.randomUUID()
}

// รูปหน้าปก (บังคับ) + รูปประกอบ (ไม่บังคับ) อยู่การ์ดเดียวกันฝั่งขวา แบบ "Upload Img" ในตัวอย่างดีไซน์
export default function ImagesCard({ coverImage, onCoverImageChange, images, onImagesChange }: Props) {
  function updateGalleryImage(id: string, image: ProductImage | null) {
    if (image === null) {
      onImagesChange(images.filter((img) => img.id !== id))
    } else {
      onImagesChange(images.map((img) => (img.id === id ? image : img)))
    }
  }

  function addGallerySlot() {
    onImagesChange([
      ...images,
      { id: makeId(), previewUrl: '', uploadedUrl: null, uploading: false, error: null },
    ])
  }

  return (
    <SectionCard title="รูปภาพ" subtitle="รูปหน้าปกแสดงในหน้ารายการ ส่วนรูปประกอบแสดงในแท็บรูปภาพ">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            รูปหน้าปก <span className="text-[#E5457F]">*</span>
          </p>
          <ImageUploadTile image={coverImage} onChange={onCoverImageChange} size="lg" />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">รูปประกอบ</p>
            <span className="text-xs text-gray-400">{images.length} รูป</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <ImageUploadTile
                key={img.id}
                image={img.previewUrl || img.uploadedUrl ? img : null}
                onChange={(updated) => updateGalleryImage(img.id, updated)}
              />
            ))}
            <button
              type="button"
              onClick={addGallerySlot}
              className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-[#E5457F] hover:bg-[#FCE7EF]/40"
            >
              <span className="text-2xl">+</span>
              <span className="text-xs">เพิ่มรูป</span>
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}