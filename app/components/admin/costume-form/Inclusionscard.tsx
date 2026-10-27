'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/client'
import SectionCard from './Sectioncard'
import ImageUploadTile from './ImageUploadTile'
import type { ProductInclusion } from './types'

type Props = {
  inclusions: ProductInclusion[]
  onChange: (inclusions: ProductInclusion[]) => void
  excludeProductId?: string // หน้าแก้ไข: ไม่ให้เลือกตัวเองเป็นรองเท้า
}

// สินค้ารองเท้าในคลัง (size_system = shoes) ที่เลือกเป็น "รองเท้าที่มากับชุด" ได้
type ShoeOption = { id: string; name: string; coverImageUrl: string | null; minPrice: number | null; active: boolean }

function useShoeOptions(excludeProductId?: string): ShoeOption[] {
  const [options, setOptions] = useState<ShoeOption[]>([])
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase
      .from('products')
      .select('id, name, cover_image_url, status, product_variants ( package_price )')
      .eq('size_system', 'shoes')
      .order('name')
      .then(({ data, error }) => {
        // ยังไม่ได้รัน Step 18 (ไม่มี size_system) → ไม่มีตัวเลือกรองเท้า ฟอร์มยังใช้ได้ตามเดิม
        if (error) return
        type Row = {
          id: string
          name: string
          cover_image_url: string | null
          status: string
          product_variants: { package_price: number | string }[] | null
        }
        setOptions(
          ((data ?? []) as Row[])
            .filter((r) => r.id !== excludeProductId)
            .map((r) => {
              const prices = (r.product_variants ?? []).map((v) => Number(v.package_price))
              return {
                id: r.id,
                name: r.name,
                coverImageUrl: r.cover_image_url,
                minPrice: prices.length > 0 ? Math.min(...prices) : null,
                active: r.status === 'active',
              }
            }),
        )
      })
  }, [excludeProductId])
  return options
}

function makeId() {
  return crypto.randomUUID()
}

export default function InclusionsCard({ inclusions, onChange, excludeProductId }: Props) {
  const shoeOptions = useShoeOptions(excludeProductId)
  const shoeRowId = inclusions.find((inc) => inc.shoeProductId)?.id ?? null

  function addInclusion() {
    onChange([...inclusions, { id: makeId(), name: '', imageUrl: '', price: '', laundryFee: '', shoeProductId: '' }])
  }

  // เลือกรองเท้าจากคลัง → เติมชื่อ/รูป/ราคาจากสินค้ารองเท้าให้ในช่องที่ยังว่าง (แก้ต่อได้)
  function selectShoe(item: ProductInclusion, shoeProductId: string) {
    const shoe = shoeOptions.find((o) => o.id === shoeProductId)
    updateInclusion(item.id, {
      shoeProductId,
      ...(shoe && !item.name.trim() ? { name: shoe.name } : {}),
      ...(shoe && !item.imageUrl && shoe.coverImageUrl ? { imageUrl: shoe.coverImageUrl } : {}),
      ...(shoe && !item.price.trim() && shoe.minPrice != null ? { price: String(shoe.minPrice) } : {}),
    })
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
      subtitle="เช่น เสื้อคลุม, สายรัด, ปลอกแขน — แสดงเป็น Checklist ในหน้ารายละเอียดสินค้า ใส่ราคาแยกชิ้นเพื่อให้ลูกค้าเลือกเช่าทีละชิ้นได้ และใส่ค่าซักรีดของชิ้นนั้นได้ (ไม่บังคับ) · ชุดที่มีรองเท้า: เพิ่มรองเท้าเป็นสินค้ารองเท้าในคลังก่อน แล้วเลือกในช่อง &quot;เป็นรองเท้าจากคลัง&quot;"
      action={
        <button
          type="button"
          onClick={addInclusion}
          className="lift focus-ring whitespace-nowrap rounded-full border border-ink bg-white px-4 py-1.5 text-xs font-semibold text-ink"
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

                {(shoeOptions.length > 0 || item.shoeProductId) && (
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-gray-600">เป็นรองเท้าจากคลัง</span>
                    <select
                      value={item.shoeProductId}
                      onChange={(e) => selectShoe(item, e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
                    >
                      <option value="">ไม่ใช่ — ชิ้นส่วนทั่วไป</option>
                      {shoeOptions.map((o) => (
                        // ชุดหนึ่งมีรองเท้าได้รายการเดียว
                        <option key={o.id} value={o.id} disabled={!!shoeRowId && shoeRowId !== item.id}>
                          {o.name}
                          {o.active ? '' : ' (ปิดขายอยู่ — ลูกค้าจะเลือกรองเท้าไม่ได้)'}
                        </option>
                      ))}
                    </select>
                    {item.shoeProductId && (
                      <span className="mt-1 block text-xs text-gray-500">
                        ลูกค้าเลือกไซส์รองเท้าเองได้ หรือเลือกไม่รับรองเท้า แล้วระบบหักราคาเช่าแยกชิ้นด้านล่างออกจากราคาชุด
                      </span>
                    )}
                  </label>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MoneyField
                    label="ราคาเช่าแยกชิ้น"
                    hint={item.shoeProductId ? 'จำเป็น · ส่วนลดเมื่อไม่รับรองเท้า' : 'เว้นว่าง = ไม่เปิดเช่าแยก'}
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