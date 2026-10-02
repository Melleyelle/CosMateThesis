'use client'

import SectionCard from './Sectioncard'
import ImageUploadTile from './ImageUploadTile'
import type { ProductInclusion } from './types'

type Props = {
  inclusions: ProductInclusion[]
  onChange: (inclusions: ProductInclusion[]) => void
}

function makeId() {
  return crypto.randomUUID()
}

export default function InclusionsCard({ inclusions, onChange }: Props) {
  function addInclusion() {
    onChange([...inclusions, { id: makeId(), name: '', imageUrl: '', price: '' }])
  }

  function updateInclusion(id: string, patch: Partial<ProductInclusion>) {
    onChange(inclusions.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeInclusion(id: string) {
    onChange(inclusions.filter((item) => item.id !== id))
  }

  return (
    <SectionCard
      title="สิ่งที่รวมอยู่ในชุดนี้"
      subtitle="เช่น เสื้อคลุม, สายรัด, ปลอกแขน — แสดงเป็น Checklist ในหน้ารายละเอียดสินค้า ใส่ราคาแยกชิ้นเพื่อให้ลูกค้าเลือกเช่าทีละชิ้นได้"
      action={
        <button
          type="button"
          onClick={addInclusion}
          className="whitespace-nowrap rounded-full border-2 border-[#E5457F] px-4 py-1.5 text-xs font-semibold text-[#E5457F] hover:bg-[#FCE7EF]"
        >
          + เพิ่มรายการ
        </button>
      }
    >
      {inclusions.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
          ยังไม่มีรายการ กด &quot;เพิ่มรายการ&quot; เพื่อเริ่มใส่ชิ้นส่วนของชุด
        </p>
      ) : (
        <div className="space-y-3">
          {inclusions.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
              <ImageUploadTile
                image={
                  item.imageUrl
                    ? { id: item.id, previewUrl: item.imageUrl, uploadedUrl: item.imageUrl, uploading: false, error: null }
                    : null
                }
                onChange={(img) => updateInclusion(item.id, { imageUrl: img?.uploadedUrl ?? '' })}
              />
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateInclusion(item.id, { name: e.target.value })}
                placeholder={`ชื่อชิ้นส่วนที่ ${index + 1} เช่น เสื้อคลุม`}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
              />
              <label className="flex items-center gap-1.5 text-sm text-gray-500">
                ฿
                <input
                  type="text"
                  inputMode="decimal"
                  value={item.price}
                  onChange={(e) => updateInclusion(item.id, { price: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder="ราคาแยกชิ้น"
                  aria-label={`ราคาเช่าแยกชิ้นของ ${item.name || `ชิ้นส่วนที่ ${index + 1}`}`}
                  className="w-28 rounded-xl border border-gray-300 px-3 py-2.5 text-right text-sm text-gray-900 outline-none placeholder:text-left placeholder:text-gray-400 focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
                />
              </label>
              <button
                type="button"
                onClick={() => removeInclusion(item.id)}
                className="text-sm text-gray-400 hover:text-red-500"
                aria-label="ลบรายการนี้"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}