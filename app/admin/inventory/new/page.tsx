'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/client'
import AdminLayout from '@/app/components/admin/AdminLayout'
import GeneralInfoCard from '@/app/components/admin/costume-form/Generalinfocard'
import CategoryCard from '@/app/components/admin/costume-form/Categorycard'
import ImagesCard from '@/app/components/admin/costume-form/Imagescard'
import InclusionsCard from '@/app/components/admin/costume-form/Inclusionscard'
import SizesStockCard from '@/app/components/admin/costume-form/Sizesstockcard'
import PricingCard from '@/app/components/admin/costume-form/PricingCard'
import { pricingProblem, saveProductPricing, usePricingConfig, variantDepositOf } from '@/utils/rentalTiers'
import { EMPTY_FORM_DATA, type CostumeFormData } from '@/app/components/admin/costume-form/types'
import { findProductIdBySku, saveInclusionPrices, validateShoeInclusion } from '@/utils/saveInclusionPrices'
import { validateSkuPrefix } from '@/utils/skuPrefix'
import { saveSizeDetails, validateSizeRanges } from '@/utils/sizeDefaults'

// หน้าเดียวจบ ไม่ใช้สเตปแล้ว — จัดเป็น 2 คอลัมน์แบบฟอร์มเพิ่มสินค้าทั่วไป:
// ซ้าย = เนื้อหาหลัก (ชื่อ/คำอธิบาย, ไซส์-ราคา-สต็อก, สิ่งที่รวมในชุด)
// ขวา = รูปภาพ + การจัดหมวดหมู่/แท็ก
function translateSaveError(message: string) {
  if (message.includes('NOT_ADMIN')) return 'บัญชีนี้ไม่มีสิทธิ์แอดมิน'
  if (message.includes('NAME_REQUIRED')) return 'กรุณากรอกชื่อชุด'
  if (message.includes('SKU_PREFIX_REQUIRED')) return 'กรุณากรอกรหัสอ้างอิงชุด'
  if (message.includes('products_sku_prefix_format')) {
    return 'รหัสอ้างอิงชุดต้องเป็นตัวอักษรอังกฤษ A–Z หรือตัวเลข 0–9 ยาว 2–12 ตัว'
  }
  if (message.includes('AT_LEAST_ONE_VARIANT')) return 'กรุณาเลือกอย่างน้อย 1 ไซส์'
  if (message.includes('duplicate key') && message.includes('item_code')) {
    return 'มีรหัสชุดจริงซ้ำกับที่มีอยู่แล้วในระบบ กรุณาแก้รหัสในส่วนไซส์และสต็อก'
  }
  if (message.includes('duplicate key') && message.includes('sku_prefix')) {
    return 'รหัสอ้างอิงชุด (SKU Prefix) นี้ถูกใช้แล้ว กรุณาตั้งชื่ออื่น'
  }
  return message
}

export default function NewCostumePage() {
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState<CostumeFormData>(EMPTY_FORM_DATA)
  const [{ tiers, phase, error: pricingConfigError }, setPhase] = usePricingConfig()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function validate(): string | null {
    if (!formData.basicInfo.name.trim() || !formData.basicInfo.skuPrefix.trim()) {
      return 'กรุณากรอกชื่อชุดและรหัสอ้างอิงชุดก่อน'
    }
    const skuError = validateSkuPrefix(formData.basicInfo.skuPrefix)
    if (skuError) return skuError
    if (!formData.coverImage?.uploadedUrl) {
      return 'กรุณาอัปโหลดรูปหน้าปกให้เสร็จก่อน'
    }
    if (formData.images.some((img) => img.uploading)) {
      return 'กรุณารอให้รูปประกอบอัปโหลดเสร็จก่อน'
    }
    if (formData.variants.length === 0) {
      return 'กรุณาเลือกอย่างน้อย 1 ไซส์'
    }
    if (pricingConfigError) return 'ยังไม่ได้รัน SQL Step 25 จึงบันทึกค่าเช่าแบบใหม่ไม่ได้'
    const pricingError = pricingProblem(formData.pricing)
    if (pricingError) return pricingError
    const rangeError = validateSizeRanges(formData.variants)
    if (rangeError) return rangeError
    if (formData.items.length === 0) {
      return 'กรุณาใส่จำนวนชุดที่มีอย่างน้อย 1 ตัว'
    }
    const codes = formData.items.map((i) => i.itemCode.trim())
    if (codes.some((c) => !c) || new Set(codes).size !== codes.length) {
      return 'รหัสชุดจริงต้องไม่ว่างและต้องไม่ซ้ำกัน'
    }
    const shoeError = validateShoeInclusion(formData.inclusions)
    if (shoeError) return shoeError
    return null
  }

  async function handleSave() {
    setSaveError(null)

    const validationError = validate()
    if (validationError) {
      alert(validationError)
      return
    }

    if (!supabase) {
      setSaveError('Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค')
      return
    }

    setSaving(true)

    const { basicInfo, coverImage, images, inclusions, variants, items } = formData

    const payload = {
      p_product: {
        sku_prefix: basicInfo.skuPrefix,
        name: basicInfo.name,
        character_name: basicInfo.characterName,
        series_name: basicInfo.seriesName,
        franchise_type: basicInfo.franchiseType,
        costume_category: basicInfo.costumeCategory,
        gender_tag: basicInfo.genderTag,
        color_tags: basicInfo.colorTags,
        theme_tags: basicInfo.themeTags,
        crossplay_friendly: basicInfo.crossplayFriendly,
        is_group_set: basicInfo.isGroupSet,
        cover_image_url: coverImage?.uploadedUrl ?? '',
      },
      p_images: images
        .filter((img) => img.uploadedUrl)
        .map((img, index) => ({ url: img.uploadedUrl, display_order: index })),
      p_inclusions: inclusions.map((inc, index) => ({
        name: inc.name,
        image_url: inc.imageUrl,
        display_order: index,
      })),
      p_variants: variants.map((v) => ({
        size: v.size,
        // ราคาเท่ากันทุกไซส์ (Step 25) — ระบบเปลี่ยนเป็นราคาเริ่มต้นของตัวที่ถูกสุดให้เองหลังบันทึกราคา
        package_price: formData.pricing.priceNormal,
        package_days: v.packageDays || 1, // เลิกใช้แล้ว (v2) ลูกค้าเลือกจำนวนวันเอง
        deposit_amount: variantDepositOf(formData.pricing, tiers),
        deposit_return_hours: v.depositReturnHours,
        laundry_fee: v.laundryFee || '0',
        chest_in: v.chestIn,
        waist_in: v.waistIn,
        hip_in: v.hipIn,
        length_in: v.lengthIn,
        recommended_height_min: v.recommendedHeightMin,
        recommended_height_max: v.recommendedHeightMax,
        items: items
          .filter((item) => item.variantId === v.id)
          .map((item) => ({ item_code: item.itemCode.trim() })),
      })),
    }

    const { data: created, error } = await supabase.rpc('create_costume', payload)

    if (error) {
      setSaving(false)
      setSaveError(translateSaveError(error.message))
      return
    }

    const productId = typeof created === 'string' ? created : await findProductIdBySku(basicInfo.skuPrefix)
    const followUpErrors: string[] = []

    // ประเภทไซส์ + ค่าสูงสุดของช่วง + ความยาวเท้า (Step 18) — create_costume รู้จักแค่ค่าต่ำสุด
    const sizeError = productId
      ? await saveSizeDetails(productId, basicInfo.sizeSystem, variants)
      : 'บันทึกช่วงไซส์ไม่สำเร็จ: หาชุดที่เพิ่งสร้างไม่พบ'
    if (sizeError) followUpErrors.push(sizeError)

    // ต้นทุน ราคา 3 ช่วง มัดจำกำหนดเอง ล็อกราคา (Step 25)
    const pricingError = productId
      ? await saveProductPricing(productId, formData.pricing)
      : 'บันทึกราคาไม่สำเร็จ: หาชุดที่เพิ่งสร้างไม่พบ'
    if (pricingError) followUpErrors.push(pricingError)

    if (inclusions.some((inc) => inc.price.trim())) {
      const priceError = productId ? await saveInclusionPrices(productId, inclusions) : 'บันทึกราคาแยกชิ้นไม่สำเร็จ: หาชุดที่เพิ่งสร้างไม่พบ'
      if (priceError) followUpErrors.push(priceError)
    }
    if (followUpErrors.length > 0) {
      // ชุดถูกสร้างแล้ว อย่าให้กดบันทึกซ้ำ (จะได้ชุดซ้ำ) → แจ้งแล้วไปหน้าคลัง ให้แก้ในหน้าแก้ไขชุด
      window.alert(`สร้างชุดแล้ว แต่${followUpErrors.join('\n')}\nแก้ได้ในหน้าแก้ไขชุด`)
    }
    setSaving(false)

    router.push('/admin/inventory')
    router.refresh()
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="mb-6">
          <Link
            href="/admin/inventory"
            className="mb-2 inline-block text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            ← กลับไปคลังชุด
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">เพิ่มชุดใหม่</h1>
          <p className="text-sm text-gray-500">กรอกข้อมูลแล้วกดบันทึกได้เลย ระบบจะเก็บเป็นฉบับร่างก่อน</p>
        </div>

        {saveError && (
          <p role="alert" className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {saveError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* คอลัมน์หลัก */}
          <div className="space-y-6 lg:col-span-2">
            <GeneralInfoCard
              value={formData.basicInfo}
              onChange={(basicInfo) => setFormData((f) => ({ ...f, basicInfo }))}
            />
            <PricingCard
              pricing={formData.pricing}
              onChange={(p) => setFormData((f) => ({ ...f, pricing: p }))}
              tiers={tiers}
              phase={phase}
              onPhaseChange={setPhase}
              configError={pricingConfigError}
            />
            <SizesStockCard
              skuPrefix={formData.basicInfo.skuPrefix}
              sizeSystem={formData.basicInfo.sizeSystem}
              onSizeSystemChange={(sizeSystem) =>
                setFormData((f) => ({ ...f, basicInfo: { ...f.basicInfo, sizeSystem } }))
              }
              variants={formData.variants}
              onVariantsChange={(variants) => setFormData((f) => ({ ...f, variants }))}
              items={formData.items}
              onItemsChange={(items) => setFormData((f) => ({ ...f, items }))}
            />
            <InclusionsCard
              inclusions={formData.inclusions}
              onChange={(inclusions) => setFormData((f) => ({ ...f, inclusions }))}
            />
          </div>

          {/* คอลัมน์ข้าง */}
          <div className="space-y-6">
            <ImagesCard
              coverImage={formData.coverImage}
              onCoverImageChange={(coverImage) => setFormData((f) => ({ ...f, coverImage }))}
              images={formData.images}
              onImagesChange={(images) => setFormData((f) => ({ ...f, images }))}
            />
            <CategoryCard
              value={formData.basicInfo}
              onChange={(basicInfo) => setFormData((f) => ({ ...f, basicInfo }))}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="lift focus-ring rounded-full border border-ink bg-brand px-8 py-2.5 text-sm font-bold text-white active:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกชุดนี้'}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}