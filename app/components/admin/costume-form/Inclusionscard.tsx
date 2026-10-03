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
    onChange([...inclusions, { id: makeId(), name: '', imageUrl: '', price: '', laundryFee: '' }])
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
      subtitle="เช่น เสื้อคลุม, สายรัด, ปลอกแขน — แสดงเป็น Checklist ในหน้ารายละเอียดสินค้า ใส่ราคาแยกชิ้นเพื่อให้ลูกค้าเลือกเช่าทีละชิ้นได้ และใส่ค่าซักรีดของชิ้นนั้นได้ (ไม่บังคับ)"
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
            <div key={item.id} className="flex items-start gap-4 rounded-xl border border-gray-200 p-3">
              <div className="flex-shrink-0">
                <ImageUploadTile
                  image={
                    item.imageUrl
                      ? { id: item.id, previewUrl: item.imageUrl, uploadedUrl: item.imageUrl, uploading: false, error: null }
                      : null
                  }
                  onChange={(img) => updateInclusion(item.id, { imageUrl: img?.uploadedUrl ?? '' })}
                />
              </div>

              {/* ชื่อแถวบน / ราคา + ค่าซักแถวล่าง — ไม่ล้นการ์ดแม้จอแคบ */}
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateInclusion(item.id, { name: e.target.value })}
                    placeholder={`ชื่อชิ้นส่วนที่ ${index + 1} เช่น เสื้อคลุม`}
                    aria-label={`ชื่อชิ้นส่วนที่ ${index + 1}`}
                    className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
                  />
                  <button
                    type="button"
                    onClick={() => removeInclusion(item.id)}
                    className="flex-shrink-0 text-sm text-gray-400 hover:text-red-500"
                    aria-label="ลบรายการนี้"
                  >
                    ลบ
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MoneyField
                    label="ราคาเช่าแยกชิ้น"
                    hint="เว้นว่าง = ไม่เปิดเช่าแยก"
                    value={item.price}
                    onChange={(v) => updateInclusion(item.id, { price: v })}
                  />
                  <MoneyField
                    label="ค่าซักรีด"
                    hint={item.price.trim() ? 'ไม่บังคับ' : 'ใส่ราคาแยกชิ้นก่อน'}
                    value={item.laundryFee}
                    onChange={(v) => updateInclusion(item.id, { laundryFee: v })}
                    disabled={!item.price.trim()}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function MoneyField({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-gray-600">{label}</span>
        <span className="truncate text-gray-400">{hint}</span>
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">฿</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          disabled={disabled}
          placeholder="0"
          className="w-full rounded-xl border border-gray-300 py-2.5 pl-7 pr-3 text-right text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15 disabled:bg-gray-50 disabled:text-gray-300"
        />
      </span>
    </label>
  )
}