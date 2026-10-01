'use client'

import { useState } from 'react'
import { CaretDownIcon } from '@phosphor-icons/react'
import SectionCard from './Sectioncard'
import { FormField } from './FormFields'
import type { ProductItem, ProductVariant, SizeOption } from './types'

type Props = {
  skuPrefix: string
  variants: ProductVariant[]
  onVariantsChange: (variants: ProductVariant[]) => void
  items: ProductItem[]
  onItemsChange: (items: ProductItem[]) => void
}

const SIZE_OPTIONS: SizeOption[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size']

function makeId() {
  return crypto.randomUUID()
}

function emptyVariant(size: SizeOption): ProductVariant {
  return {
    id: makeId(),
    size,
    packagePrice: '',
    packageDays: '7',
    depositAmount: '',
    depositReturnHours: '72',
    laundryFee: '',
    chestIn: '',
    waistIn: '',
    hipIn: '',
    lengthIn: '',
    recommendedHeightMin: '',
    recommendedHeightMax: '',
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
  variants,
  onVariantsChange,
  items,
  onItemsChange,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({})

  const usedSizes = new Set(variants.map((v) => v.size))

  function itemsForVariant(variantId: string) {
    return items.filter((item) => item.variantId === variantId)
  }

  function toggleSize(size: SizeOption) {
    const existing = variants.find((v) => v.size === size)
    if (existing) {
      onVariantsChange(variants.filter((v) => v.id !== existing.id))
      onItemsChange(items.filter((item) => item.variantId !== existing.id))
    } else {
      onVariantsChange([...variants, emptyVariant(size)])
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
      subtitle="กดเลือกไซส์ที่มีชุดนี้ แล้วกรอกราคา มัดจำ และจำนวนที่มีของแต่ละไซส์"
      action={
        totalItems > 0 ? (
          <span className="whitespace-nowrap rounded-full bg-[#FCE7EF] px-4 py-1 text-sm font-semibold text-[#E5457F]">
            รวม {totalItems} ตัว
          </span>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">ไซส์ที่มี</p>
          <div className="flex flex-wrap gap-2">
            {SIZE_OPTIONS.map((size) => {
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
            return (
              <div key={variant.id} className="rounded-xl border border-gray-200 p-4">
                <span className="mb-3 inline-block rounded-full bg-[#FCE7EF] px-4 py-1 text-sm font-semibold text-[#E5457F]">
                  ไซส์ {variant.size}
                </span>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    id={`price-${variant.id}`}
                    label="ราคาเช่าเหมา (บาท)"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={variant.packagePrice}
                    onChange={(e) => updateVariant(variant.id, { packagePrice: e.target.value })}
                  />
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

                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [variant.id]: !s[variant.id] }))}
                  className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  <CaretDownIcon
                    size={14}
                    className={`transition-transform ${expanded[variant.id] ? 'rotate-180' : ''}`}
                  />
                  จำนวนวันเช่า, ค่าซัก และตารางไซส์ (ไม่บังคับ)
                </button>

                {expanded[variant.id] && (
                  <div className="mt-3 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
                    <FormField
                      id={`days-${variant.id}`}
                      label="จำนวนวันในแพ็กเกจ"
                      type="number"
                      min="1"
                      step="1"
                      value={variant.packageDays}
                      onChange={(e) => updateVariant(variant.id, { packageDays: e.target.value })}
                    />
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
                    <FormField
                      id={`chest-${variant.id}`}
                      label="รอบอก (นิ้ว)"
                      type="number"
                      step="0.1"
                      value={variant.chestIn}
                      onChange={(e) => updateVariant(variant.id, { chestIn: e.target.value })}
                    />
                    <FormField
                      id={`waist-${variant.id}`}
                      label="รอบเอว (นิ้ว)"
                      type="number"
                      step="0.1"
                      value={variant.waistIn}
                      onChange={(e) => updateVariant(variant.id, { waistIn: e.target.value })}
                    />
                    <FormField
                      id={`hip-${variant.id}`}
                      label="รอบสะโพก (นิ้ว)"
                      type="number"
                      step="0.1"
                      value={variant.hipIn}
                      onChange={(e) => updateVariant(variant.id, { hipIn: e.target.value })}
                    />
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