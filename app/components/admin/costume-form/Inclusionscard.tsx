'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/client'
import SectionCard from './Sectioncard'
import ImageUploadTile from './ImageUploadTile'
import { PIECE_WEIGHTS, type PieceRentMode, type PieceWeight, type ProductInclusion, type ProductPricing } from './types'
import { piecePrices, type PieceSettings } from '@/utils/customer/rentalPrice'
import { PHASE_LABEL, type PricePhase } from '@/utils/rentalTiers'
import { isPieceOpen, pieceRulesOf } from '@/utils/saveInclusionPrices'
import { formatBaht } from '@/utils/dateUtils'

type Props = {
  inclusions: ProductInclusion[]
  onChange: (inclusions: ProductInclusion[]) => void
  pricing: ProductPricing // ค่าเช่า 3 ช่วงของชุด ใช้พรีวิวราคาชิ้น
  pieceSettings: PieceSettings
  excludeProductId?: string // หน้าแก้ไข: ไม่ให้เลือกตัวเองเป็นรองเท้า
}

const RENT_MODES: { value: PieceRentMode; label: string }[] = [
  { value: 'off', label: 'ไม่เปิดเช่าแยก' },
  { value: 'auto', label: 'ระบบคำนวณตามระดับ' },
  { value: 'manual', label: 'กำหนดราคาเอง' },
]

const selectClass =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15'

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

export default function InclusionsCard({ inclusions, onChange, pricing, pieceSettings, excludeProductId }: Props) {
  const shoeOptions = useShoeOptions(excludeProductId)
  const shoeRowId = inclusions.find((inc) => inc.shoeProductId)?.id ?? null

  // พรีวิวราคาชิ้นตามค่าเช่า 3 ช่วงที่กรอกใน "ต้นทุน ค่าเช่า และมัดจำ"
  const rules = pieceRulesOf(inclusions)
  const phasePrices = (['new', 'normal', 'old'] as const).flatMap((phase: PricePhase) => {
    const unitPrice = { new: pricing.priceNew, normal: pricing.priceNormal, old: pricing.priceOld }[phase]
    return unitPrice.trim() ? [{ phase, prices: piecePrices(rules, Number(unitPrice), pieceSettings) }] : []
  })
  const hasAuto = inclusions.some((inc) => inc.rentMode === 'auto')
  const manualRows = inclusions.filter((inc) => inc.rentMode === 'manual' && !inc.shoeProductId)
  const unweighted = inclusions.filter(
    (inc) => inc.rentMode === 'off' && !inc.weight && (inc.name.trim() || inc.imageUrl),
  ).length

  function addInclusion() {
    // รายการใหม่อยู่บนสุด ไม่ต้องเลื่อนลงไปกรอกท้ายรายการ
    onChange([
      { id: makeId(), name: '', imageUrl: '', rentMode: 'off', weight: 2, price: '', laundryFee: '', shoeProductId: '' },
      ...inclusions,
    ])
  }

  function applySuggestedAll() {
    onChange(
      inclusions.map((inc) =>
        inc.rentMode === 'manual' && !inc.shoeProductId ? { ...inc, rentMode: 'auto', weight: inc.weight ?? 2 } : inc,
      ),
    )
  }

  // เลือกรองเท้าจากคลัง → เติมชื่อ/รูป/ราคาจากสินค้ารองเท้าให้ในช่องที่ยังว่าง (แก้ต่อได้)
  function selectShoe(item: ProductInclusion, shoeProductId: string) {
    const shoe = shoeOptions.find((o) => o.id === shoeProductId)
    updateInclusion(item.id, {
      shoeProductId,
      // รองเท้าเป็นราคาตายตัวเสมอ เพราะเป็นส่วนลดตอนไม่รับรองเท้าด้วย
      ...(shoeProductId ? { rentMode: 'manual' as const, weight: null } : {}),
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
      subtitle="เช่น เสื้อคลุม, สายรัด, ปลอกแขน — แสดงเป็น Checklist ในหน้ารายละเอียดสินค้า เลือกระดับของแต่ละชิ้น แล้วเปิดเช่าแยกเฉพาะชิ้นที่ต้องการ ระบบแบ่งราคาจากค่าเช่าทั้งชุดและลดตามช่วงของชุดจริงให้เอง · ชุดที่มีรองเท้า: เพิ่มรองเท้าเป็นสินค้ารองเท้าในคลังก่อน แล้วเลือกในช่อง &quot;เป็นรองเท้าจากคลัง&quot;"
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
          {manualRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FAFAFB] px-4 py-2.5">
              <p className="text-xs text-gray-600">{manualRows.length} ชิ้นกำหนดราคาเอง ราคาคงที่ ไม่ลดตามช่วงของชุด</p>
              <button
                type="button"
                onClick={applySuggestedAll}
                className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-400"
              >
                ให้ระบบคำนวณทุกชิ้น
              </button>
            </div>
          )}
          {hasAuto && phasePrices.length < 3 && (
            <p className="rounded-xl bg-[#FFF8EB] px-4 py-2.5 text-xs text-[#875200]">
              กรอกค่าเช่าทั้ง 3 ช่วงก่อน ระบบจึงจะแสดงราคาชิ้นครบ
            </p>
          )}
          {hasAuto && unweighted > 0 && (
            <p className="rounded-xl bg-[#FFF8EB] px-4 py-2.5 text-xs text-[#875200]">
              ยังมี {unweighted} ชิ้นที่ไม่เปิดเช่าแยกและไม่ได้เลือกระดับ ชิ้นอื่นจึงได้สัดส่วนราคาสูงเกินจริง
            </p>
          )}
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
                      className={selectClass}
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
                  {!item.shoeProductId && (
                    <SelectField
                      label="การเช่าแยก"
                      value={item.rentMode}
                      onChange={(rentMode) =>
                        updateInclusion(item.id, {
                          rentMode: rentMode as PieceRentMode,
                          ...(rentMode === 'auto' && !item.weight ? { weight: 2 as const } : {}),
                        })
                      }
                      options={RENT_MODES.map((m) => ({ value: m.value, label: m.label }))}
                    />
                  )}
                  {item.rentMode !== 'manual' && (
                    <SelectField
                      label="ระดับชิ้น"
                      value={String(item.weight ?? '')}
                      onChange={(v) => updateInclusion(item.id, { weight: v ? (Number(v) as PieceWeight) : null })}
                      options={[
                        ...(item.weight ? [] : [{ value: '', label: 'เลือกระดับ' }]),
                        ...PIECE_WEIGHTS.map((w) => ({ value: String(w.value), label: w.label })),
                      ]}
                    />
                  )}
                  {item.rentMode === 'manual' && (
                    <MoneyField
                      label="ราคาเช่าแยกชิ้น"
                      hint={item.shoeProductId ? 'จำเป็น · ส่วนลดเมื่อไม่รับรองเท้า' : 'คงที่ทุกช่วง'}
                      value={item.price}
                      onChange={(v) => updateInclusion(item.id, { price: v })}
                    />
                  )}
                  <MoneyField
                    label="ค่าซักรีด"
                    hint={isPieceOpen(item) ? 'ไม่บังคับ' : 'เปิดเช่าแยกก่อน'}
                    value={item.laundryFee}
                    onChange={(v) => updateInclusion(item.id, { laundryFee: v })}
                    disabled={!isPieceOpen(item)}
                  />
                </div>

                {item.rentMode === 'auto' && phasePrices.length > 0 && (
                  <p className="text-xs tabular-nums text-gray-600">
                    {phasePrices.map(({ phase, prices }) => `${PHASE_LABEL[phase]} ${formatBaht(prices[item.id] ?? 0)}`).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
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