'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowCounterClockwiseIcon, CaretDownIcon } from '@phosphor-icons/react'
import SectionCard from './Sectioncard'
import { FormField } from './FormFields'
import { Segmented } from '@/app/components/admin/ui'
import {
  CLOTHING_SIZES,
  SHOE_SIZES,
  type ProductItem,
  type ProductVariant,
  type SizeOption,
  type SizeSystem,
} from './types'
import {
  EMPTY_SIZE_DEFAULTS,
  defaultMeasurementsFor,
  fetchSizeDefaults,
  matchesDefault,
  type SizeDefaults,
} from '@/utils/sizeDefaults'

type Props = {
  skuPrefix: string
  sizeSystem: SizeSystem
  onSizeSystemChange: (sizeSystem: SizeSystem) => void
  variants: ProductVariant[]
  onVariantsChange: (variants: ProductVariant[]) => void
  items: ProductItem[]
  onItemsChange: (items: ProductItem[]) => void
  // ต้นทุนอยู่ในเทียร์ / มีมัดจำกำหนดเอง (Step 21) → ไม่ต้องกรอกมัดจำรายไซส์
  autoDeposit?: boolean
  // ค่าเช่าแนะนำจากต้นทุน เติมให้ไซส์ที่เพิ่งเลือก
  suggestedPrice?: number | null
}

const SYSTEM_OPTIONS = [
  { value: 'clothing', label: 'เสื้อผ้า XS–XXL' },
  { value: 'shoes', label: 'รองเท้า EU 35–45' },
] as const

function makeId() {
  return crypto.randomUUID()
}

// ช่องช่วงตัวเลข ต่ำสุด–สูงสุด ในแถวเดียว
function RangeField({
  id,
  label,
  min,
  max,
  step,
  onChange,
}: {
  id: string
  label: string
  min: string
  max: string
  step: string
  onChange: (patch: { min?: string; max?: string }) => void
}) {
  const invalid = min.trim() !== '' && max.trim() !== '' && Number(min) > Number(max)
  const inputClass = `w-full min-w-0 rounded-xl border bg-white px-3 py-2.5 text-center text-sm tabular-nums text-gray-900 outline-none focus:ring-2 ${
    invalid
      ? 'border-[#D92D20] focus:border-[#D92D20] focus:ring-[#D92D20]/15'
      : 'border-gray-300 focus:border-[#E5457F] focus:ring-[#E5457F]/15'
  }`
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-sm font-medium text-gray-700">{label}</legend>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-min`}
          aria-label={`${label} ต่ำสุด`}
          type="number"
          min="0"
          step={step}
          placeholder="ต่ำสุด"
          value={min}
          onChange={(e) => onChange({ min: e.target.value })}
          className={inputClass}
        />
        <span aria-hidden className="text-gray-400">–</span>
        <input
          id={`${id}-max`}
          aria-label={`${label} สูงสุด`}
          type="number"
          min="0"
          step={step}
          placeholder="สูงสุด"
          value={max}
          onChange={(e) => onChange({ max: e.target.value })}
          className={inputClass}
        />
      </div>
      {invalid && <p className="text-xs text-[#B42318]">ต่ำสุดมากกว่าสูงสุด</p>}
    </fieldset>
  )
}

function emptyVariant(size: SizeOption): ProductVariant {
  return {
    id: makeId(),
    size,
    packagePrice: '',
    packageDays: '1', // เลิกใช้แล้ว (v2) — บันทึกไว้เผื่อคอลัมน์ package_days ห้ามว่าง
    depositAmount: '',
    depositReturnHours: '72',
    laundryFee: '',
    chestIn: '',
    chestMaxIn: '',
    waistIn: '',
    waistMaxIn: '',
    hipIn: '',
    hipMaxIn: '',
    lengthIn: '',
    recommendedHeightMin: '',
    recommendedHeightMax: '',
    footMinCm: '',
    footMaxCm: '',
  }
}

// รหัสชุดจริง: <SKU_PREFIX>-<ไซส์>-<ลำดับ 2 หลัก> เช่น NEZUKO-M-01
function nextItemCode(skuPrefix: string, size: string, existingCodes: string[]) {
  const prefix = `${skuPrefix || 'ITEM'}-${size.replace(/\s+/g, '')}-`
  const usedNumbers = existingCodes
    .filter((code) => code.startsWith(prefix))
    .map((code) => parseInt(code.slice(prefix.length), 10))
    .filter((n) => !isNaN(n))
  const next = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1
  return `${prefix}${String(next).padStart(2, '0')}`
}

// เลือกไซส์แบบกดชิป (เหมือนตัวอย่างดีไซน์) แล้วค่อยกรอกราคา/มัดจำ/จำนวนของแต่ละไซส์ที่เลือก
// ฟิลด์หลัก (ราคา มัดจำ จำนวน) เห็นตลอด ไม่ซ่อน — ส่วนที่ซ่อนมีแค่รายละเอียดปลีกย่อยจริง ๆ
// (จำนวนวัน/ค่าซัก/ตารางไซส์) กับรหัสชุดรายตัวที่ระบบตั้งให้อัตโนมัติอยู่แล้ว
export default function SizesStockCard({
  skuPrefix,
  sizeSystem,
  onSizeSystemChange,
  variants,
  onVariantsChange,
  items,
  onItemsChange,
  autoDeposit = false,
  suggestedPrice = null,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({})
  const [defaults, setDefaults] = useState<SizeDefaults>(EMPTY_SIZE_DEFAULTS)
  const [defaultsError, setDefaultsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSizeDefaults().then(({ data, error }) => {
      if (cancelled) return
      setDefaults(data)
      setDefaultsError(error)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const usedSizes = new Set(variants.map((v) => v.size))
  const sizeOptions: SizeOption[] = sizeSystem === 'shoes' ? SHOE_SIZES : CLOTHING_SIZES
  const isShoes = sizeSystem === 'shoes'

  const defaultFor = (size: string) => defaultMeasurementsFor(defaults, sizeSystem, size)

  function changeSizeSystem(next: SizeSystem) {
    if (next === sizeSystem) return
    if (variants.length > 0) {
      const ok = window.confirm('เปลี่ยนประเภทไซส์จะล้างไซส์ ราคา และจำนวนชุดที่กรอกไว้ทั้งหมด ต้องการเปลี่ยนไหม')
      if (!ok) return
      onVariantsChange([])
      onItemsChange([])
    }
    onSizeSystemChange(next)
  }

  function itemsForVariant(variantId: string) {
    return items.filter((item) => item.variantId === variantId)
  }

  function toggleSize(size: SizeOption) {
    const existing = variants.find((v) => v.size === size)
    if (existing) {
      onVariantsChange(variants.filter((v) => v.id !== existing.id))
      onItemsChange(items.filter((item) => item.variantId !== existing.id))
    } else {
      // เติมสัดส่วนจากไซส์มาตรฐานของร้านให้ทันที แอดมินแก้ต่อได้
      const variant = { ...emptyVariant(size), ...(defaultFor(size) ?? {}) }
      if (suggestedPrice != null) variant.packagePrice = String(suggestedPrice)
      onVariantsChange([...variants, variant])
    }
  }

  function updateVariant(id: string, patch: Partial<ProductVariant>) {
    onVariantsChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  function setQuantity(variant: ProductVariant, quantity: number) {
    const current = itemsForVariant(variant.id)
    const safeQty = Math.max(0, Math.min(999, quantity))
    if (safeQty === current.length) return

    if (safeQty > current.length) {
      const toAdd = safeQty - current.length
      const allCodes = items.map((i) => i.itemCode)
      const newItems: ProductItem[] = []
      for (let i = 0; i < toAdd; i++) {
        const code = nextItemCode(skuPrefix, variant.size, [...allCodes, ...newItems.map((n) => n.itemCode)])
        newItems.push({ id: makeId(), variantId: variant.id, itemCode: code })
      }
      onItemsChange([...items, ...newItems])
    } else {
      const keep = current.slice(0, safeQty)
      const keepIds = new Set(keep.map((i) => i.id))
      onItemsChange(items.filter((item) => item.variantId !== variant.id || keepIds.has(item.id)))
    }
  }

  function updateItemCode(id: string, itemCode: string) {
    onItemsChange(items.map((item) => (item.id === id ? { ...item, itemCode } : item)))
  }

  const totalItems = items.length

  return (
    <SectionCard
      title="ไซส์ ราคา และสต็อก"
      subtitle="กดเลือกไซส์ที่มีชุดนี้ ระบบเติมสัดส่วนจากไซส์มาตรฐานของร้านให้ แล้วกรอกราคา มัดจำ และจำนวน"
      action={
        totalItems > 0 ? (
          <span className="whitespace-nowrap rounded-full bg-[#FCE7EF] px-4 py-1 text-sm font-semibold text-[#E5457F]">
            รวม {totalItems} ตัว
          </span>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="ประเภทไซส์"
            options={SYSTEM_OPTIONS}
            value={sizeSystem}
            onChange={changeSizeSystem}
          />
          <Link
            href="/admin/size-defaults"
            target="_blank"
            className="text-xs font-medium text-[#5B6472] underline decoration-[#D5D9E0] underline-offset-4 hover:text-[#263544]"
          >
            แก้ไซส์มาตรฐานของร้าน
          </Link>
        </div>

        {defaultsError && (
          <p className="rounded-xl bg-[#FFF8EB] px-4 py-2.5 text-xs text-[#875200]">
            โหลดไซส์มาตรฐานไม่ได้ ({defaultsError}) — กรอกสัดส่วนเองได้ตามปกติ
          </p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            ไซส์ที่มี
          </p>
          <div className="flex flex-wrap gap-2">
            {sizeOptions.map((size) => {
              const selected = usedSizes.has(size)
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition ${
                    selected
                      ? 'border-[#E5457F] bg-[#E5457F] text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-[#E5457F] hover:text-[#E5457F]'
                  }`}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </div>

        {variants.length === 0 && (
          <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            ยังไม่ได้เลือกไซส์ กดชิปไซส์ด้านบนเพื่อเริ่มตั้งราคา
          </p>
        )}

        <div className="space-y-4">
          {variants.map((variant) => {
            const variantItems = itemsForVariant(variant.id)
            const def = defaultFor(variant.size)
            const isDefault = matchesDefault(variant, def)
            return (
              <div key={variant.id} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-block rounded-full bg-[#FCE7EF] px-4 py-1 text-sm font-semibold text-[#E5457F]">
                    ไซส์ {variant.size}
                  </span>
                  {def && isDefault && (
                    <span className="text-xs text-[#5B6472]">สัดส่วนตามไซส์มาตรฐาน</span>
                  )}
                  {def && !isDefault && (
                    <>
                      <span className="rounded-full bg-[#FFF1D6] px-2.5 py-0.5 text-xs font-medium text-[#875200]">
                        ปรับสัดส่วนเอง
                      </span>
                      <button
                        type="button"
                        onClick={() => updateVariant(variant.id, def)}
                        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[#5B6472] hover:text-[#263544]"
                      >
                        <ArrowCounterClockwiseIcon size={14} />
                        ใช้ค่ามาตรฐาน
                      </button>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    id={`price-${variant.id}`}
                    label="ราคาเช่า 1 วัน (บาท)"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={variant.packagePrice}
                    onChange={(e) => updateVariant(variant.id, { packagePrice: e.target.value })}
                  />
                  {autoDeposit ? (
                    <div className="space-y-1.5">
                      <p className="block text-sm font-medium text-gray-700">มัดจำ (บาท)</p>
                      <p className="rounded-xl border border-dashed border-gray-300 bg-[#FAFAFB] px-4 py-2.5 text-sm text-gray-500">
                        อัตโนมัติตามรอบ
                      </p>
                    </div>
                  ) : (
                    <FormField
                      id={`deposit-${variant.id}`}
                      label="มัดจำ (บาท)"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={variant.depositAmount}
                      onChange={(e) => updateVariant(variant.id, { depositAmount: e.target.value })}
                    />
                  )}
                  <FormField
                    id={`qty-${variant.id}`}
                    label="จำนวนชุดที่มี (ตัว)"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={String(variantItems.length)}
                    onChange={(e) => setQuantity(variant, parseInt(e.target.value || '0', 10))}
                  />
                </div>

                {/* สัดส่วนที่ใส่ได้ — เห็นตลอด เพราะลูกค้าใช้เลือกไซส์ และระบบเติมค่าให้อยู่แล้ว */}
                <div className="mt-4 rounded-xl bg-[#FAFAFB] p-3">
                  <p className="mb-2 text-xs font-semibold text-[#5B6472]">
                    {isShoes ? 'ความยาวเท้าที่ใส่ได้' : 'สัดส่วนร่างกายที่ใส่ได้'}
                  </p>
                  {isShoes ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <RangeField
                        id={`foot-${variant.id}`}
                        label="ความยาวเท้า (ซม.)"
                        step="0.1"
                        min={variant.footMinCm}
                        max={variant.footMaxCm}
                        onChange={(p) =>
                          updateVariant(variant.id, {
                            ...(p.min !== undefined && { footMinCm: p.min }),
                            ...(p.max !== undefined && { footMaxCm: p.max }),
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <RangeField
                        id={`chest-${variant.id}`}
                        label="รอบอก (นิ้ว)"
                        step="0.5"
                        min={variant.chestIn}
                        max={variant.chestMaxIn}
                        onChange={(p) =>
                          updateVariant(variant.id, {
                            ...(p.min !== undefined && { chestIn: p.min }),
                            ...(p.max !== undefined && { chestMaxIn: p.max }),
                          })
                        }
                      />
                      <RangeField
                        id={`waist-${variant.id}`}
                        label="รอบเอว (นิ้ว)"
                        step="0.5"
                        min={variant.waistIn}
                        max={variant.waistMaxIn}
                        onChange={(p) =>
                          updateVariant(variant.id, {
                            ...(p.min !== undefined && { waistIn: p.min }),
                            ...(p.max !== undefined && { waistMaxIn: p.max }),
                          })
                        }
                      />
                      <RangeField
                        id={`hip-${variant.id}`}
                        label="รอบสะโพก (นิ้ว)"
                        step="0.5"
                        min={variant.hipIn}
                        max={variant.hipMaxIn}
                        onChange={(p) =>
                          updateVariant(variant.id, {
                            ...(p.min !== undefined && { hipIn: p.min }),
                            ...(p.max !== undefined && { hipMaxIn: p.max }),
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [variant.id]: !s[variant.id] }))}
                  className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  <CaretDownIcon
                    size={14}
                    className={`transition-transform ${expanded[variant.id] ? 'rotate-180' : ''}`}
                  />
                  {isShoes ? 'คืนมัดจำ และค่าซัก (ไม่บังคับ)' : 'คืนมัดจำ, ค่าซัก, ความยาวชุด และส่วนสูง (ไม่บังคับ)'}
                </button>

                {expanded[variant.id] && (
                  <div className="mt-3 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
                    {/* จำนวนวันในแพ็กเกจเลิกใช้แล้ว (v2): ลูกค้าเลือกจำนวนวันเองตอนจอง วันที่ 2 เป็นต้นไปคิดตาม extra_day_rate */}
                    <FormField
                      id={`deposit-hours-${variant.id}`}
                      label="คืนมัดจำภายใน (ชั่วโมง)"
                      type="number"
                      min="0"
                      step="1"
                      value={variant.depositReturnHours}
                      onChange={(e) => updateVariant(variant.id, { depositReturnHours: e.target.value })}
                    />
                    <FormField
                      id={`laundry-${variant.id}`}
                      label="ค่าซักรีด (บาท)"
                      type="number"
                      min="0"
                      step="1"
                      value={variant.laundryFee}
                      onChange={(e) => updateVariant(variant.id, { laundryFee: e.target.value })}
                    />
                    {!isShoes && (
                      <>
                    <FormField
                      id={`length-${variant.id}`}
                      label="ความยาวชุด (นิ้ว)"
                      type="number"
                      step="0.1"
                      value={variant.lengthIn}
                      onChange={(e) => updateVariant(variant.id, { lengthIn: e.target.value })}
                    />
                    <FormField
                      id={`height-min-${variant.id}`}
                      label="ส่วนสูงแนะนำ ต่ำสุด (ซม.)"
                      type="number"
                      step="1"
                      value={variant.recommendedHeightMin}
                      onChange={(e) => updateVariant(variant.id, { recommendedHeightMin: e.target.value })}
                    />
                    <FormField
                      id={`height-max-${variant.id}`}
                      label="ส่วนสูงแนะนำ สูงสุด (ซม.)"
                      type="number"
                      step="1"
                      value={variant.recommendedHeightMax}
                      onChange={(e) => updateVariant(variant.id, { recommendedHeightMax: e.target.value })}
                    />
                      </>
                    )}
                  </div>
                )}

                {variantItems.length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowCodes((s) => ({ ...s, [variant.id]: !s[variant.id] }))}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      <CaretDownIcon
                        size={14}
                        className={`transition-transform ${showCodes[variant.id] ? 'rotate-180' : ''}`}
                      />
                      ดู/แก้รหัสชุดแต่ละตัว ({variantItems.length})
                    </button>

                    {showCodes[variant.id] && (
                      <div className="mt-2 space-y-2">
                        {variantItems.map((item) => (
                          <input
                            key={item.id}
                            type="text"
                            value={item.itemCode}
                            onChange={(e) => updateItemCode(item.id, e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
                          />
                        ))}
                        <p className="text-xs text-gray-400">แต่ละรหัสต้องไม่ซ้ำกัน ระบบจะตรวจอีกครั้งตอนบันทึก</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </SectionCard>
  )
}