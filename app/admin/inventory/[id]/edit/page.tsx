'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, ArrowSquareOutIcon } from '@phosphor-icons/react'
import { createClient } from '@/utils/client'
import AdminLayout from '@/app/components/admin/AdminLayout'
import GeneralInfoCard from '@/app/components/admin/costume-form/Generalinfocard'
import CategoryCard from '@/app/components/admin/costume-form/Categorycard'
import ImagesCard from '@/app/components/admin/costume-form/Imagescard'
import InclusionsCard from '@/app/components/admin/costume-form/Inclusionscard'
import SizesStockCard from '@/app/components/admin/costume-form/Sizesstockcard'
import ItemConditionCard from '@/app/components/admin/costume-form/ItemConditionCard'
import { PageHeader, primaryButtonClass, secondaryButtonClass } from '@/app/components/admin/ui'
import { EMPTY_FORM_DATA, type CostumeFormData } from '@/app/components/admin/costume-form/types'
import { fetchCostumeForEdit } from '@/utils/fetchCostumeForEdit'

// แก้ไขชุดเดิม — ใช้การ์ดฟอร์มชุดเดียวกับหน้า "เพิ่มชุดใหม่" ทั้งหมด ต่างกันแค่:
// 1) โหลดข้อมูลเดิมมาใส่ฟอร์มก่อน (id ของไซส์/ตัวชุดเป็น id จริงจาก DB)
// 2) ตอนบันทึกจะแยกว่าอันไหน "เดิม" (มี id อยู่ในฐานข้อมูลตั้งแต่โหลดมา) กับอันไหน "ใหม่ที่เพิ่งเพิ่ม"
//    แล้วส่งไปให้ update_costume() จัดการ อัปเดต/เพิ่ม/ลบ ให้ตรงกับที่กรอกในฟอร์ม
// 3) มีการ์ด "สภาพชุดแต่ละตัว" เพิ่ม — บันทึกทันทีแยกจากฟอร์ม (admin_set_item_condition)
function translateSaveError(message: string) {
  if (message.includes('NOT_ADMIN')) return 'บัญชีนี้ไม่มีสิทธิ์แอดมิน'
  if (message.includes('PRODUCT_NOT_FOUND')) return 'ไม่พบชุดนี้ในระบบแล้ว อาจถูกลบไปก่อนหน้านี้'
  if (message.includes('NAME_REQUIRED')) return 'กรุณากรอกชื่อชุด'
  if (message.includes('SKU_PREFIX_REQUIRED')) return 'กรุณากรอกรหัสอ้างอิงชุด'
  if (message.includes('AT_LEAST_ONE_VARIANT')) return 'กรุณาเลือกอย่างน้อย 1 ไซส์'
  if (message.includes('foreign key') || message.includes('23503')) {
    return 'ไม่สามารถลบไซส์/ตัวชุดนี้ได้ เพราะมีประวัติการเช่าผูกอยู่ ถ้าไม่ใช้ตัวนั้นแล้ว ให้ตั้งสภาพเป็น "ปลดระวาง" แทนการลบ'
  }
  if (message.includes('duplicate key') && message.includes('item_code')) {
    return 'มีรหัสชุดจริงซ้ำกับที่มีอยู่แล้วในระบบ กรุณาแก้รหัสในส่วนไซส์และสต็อก'
  }
  if (message.includes('duplicate key') && message.includes('sku_prefix')) {
    return 'รหัสอ้างอิงชุด (SKU Prefix) นี้ถูกใช้แล้ว กรุณาตั้งชื่ออื่น'
  }
  return message
}

export default function EditCostumePage() {
  const params = useParams<{ id: string }>()
  const productId = params.id
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState<CostumeFormData>(EMPTY_FORM_DATA)
  const [originalVariantIds, setOriginalVariantIds] = useState<Set<string>>(new Set())
  const [originalItemIds, setOriginalItemIds] = useState<Set<string>>(new Set())

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchCostumeForEdit(productId).then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) {
        setLoadError(error ?? 'ไม่พบชุดนี้ในระบบ')
      } else {
        setFormData(data)
        setOriginalVariantIds(new Set(data.variants.map((v) => v.id)))
        setOriginalItemIds(new Set(data.items.map((i) => i.id)))
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [productId])

  function validate(): string | null {
    if (!formData.basicInfo.name.trim() || !formData.basicInfo.skuPrefix.trim()) {
      return 'กรุณากรอกชื่อชุดและรหัสอ้างอิงชุดก่อน'
    }
    if (!formData.coverImage?.uploadedUrl) {
      return 'กรุณาอัปโหลดรูปหน้าปกให้เสร็จก่อน'
    }
    if (formData.images.some((img) => img.uploading)) {
      return 'กรุณารอให้รูปประกอบอัปโหลดเสร็จก่อน'
    }
    if (formData.variants.length === 0) {
      return 'กรุณาเลือกอย่างน้อย 1 ไซส์'
    }
    if (formData.variants.some((v) => !v.packagePrice || !v.depositAmount)) {
      return 'กรุณากรอกราคาและมัดจำให้ครบทุกไซส์'
    }
    if (formData.items.length === 0) {
      return 'กรุณาใส่จำนวนชุดที่มีอย่างน้อย 1 ตัว'
    }
    const codes = formData.items.map((i) => i.itemCode.trim())
    if (codes.some((c) => !c) || new Set(codes).size !== codes.length) {
      return 'รหัสชุดจริงต้องไม่ว่างและต้องไม่ซ้ำกัน'
    }
    return null
  }

  async function handleSave() {
    setSaveError(null)

    const validationError = validate()
    if (validationError) {
      setSaveError(validationError)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (!supabase) {
      setSaveError('Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค')
      return
    }

    setSaving(true)

    const { basicInfo, coverImage, images, inclusions, variants, items } = formData

    const payload = {
      p_product_id: productId,
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
        description: basicInfo.description,
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
        id: originalVariantIds.has(v.id) ? v.id : null,
        size: v.size,
        package_price: v.packagePrice,
        package_days: v.packageDays,
        deposit_amount: v.depositAmount,
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
          .map((item) => ({
            id: originalItemIds.has(item.id) ? item.id : null,
            item_code: item.itemCode.trim(),
          })),
      })),
    }

    const { error } = await supabase.rpc('update_costume', payload)
    setSaving(false)

    if (error) {
      setSaveError(translateSaveError(error.message))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    router.push('/admin/inventory')
    router.refresh()
  }

  const backLink = (
    <Link
      href="/admin/inventory"
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#5B6472] transition hover:text-[#263544]"
    >
      <ArrowLeftIcon size={16} />
      คลังชุด
    </Link>
  )

  if (loading) {
    return (
      <AdminLayout>
        <div className="px-5 py-7 sm:px-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white" />
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-96 animate-pulse rounded-2xl bg-white lg:col-span-2" />
            <div className="h-96 animate-pulse rounded-2xl bg-white" />
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (loadError) {
    return (
      <AdminLayout>
        <div className="px-5 py-7 sm:px-8">
          {backLink}
          <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-6 text-center text-sm text-[#B42318]">
            {loadError}
          </p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="px-5 pb-28 pt-7 sm:px-8">
        {backLink}
        <PageHeader
          title={formData.basicInfo.name || 'แก้ไขชุด'}
          description="แก้ข้อมูลแล้วกด “บันทึกการแก้ไข” ด้านล่าง ส่วนสภาพชุดแต่ละตัวบันทึกทันทีที่เปลี่ยน"
          actions={
            <Link href={`/costumes/${productId}`} target="_blank" className={secondaryButtonClass}>
              <ArrowSquareOutIcon size={16} />
              ดูหน้าชุดบนหน้าร้าน
            </Link>
          }
        />

        {saveError && (
          <p role="alert" className="mb-6 rounded-xl bg-[#FDE8E8] px-4 py-3 text-sm text-[#B42318]">
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
            <SizesStockCard
              skuPrefix={formData.basicInfo.skuPrefix}
              variants={formData.variants}
              onVariantsChange={(variants) => setFormData((f) => ({ ...f, variants }))}
              items={formData.items}
              onItemsChange={(items) => setFormData((f) => ({ ...f, items }))}
            />
            <ItemConditionCard productId={productId} />
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
      </div>

      {/* แถบบันทึกติดล่างจอ — ฟอร์มยาว ไม่ต้องเลื่อนลงไปหาปุ่ม */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E4E3EA] bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-3 px-5 py-3 sm:px-8">
          <Link href="/admin/inventory" className={secondaryButtonClass}>
            ยกเลิก
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`${primaryButtonClass} disabled:pointer-events-none disabled:opacity-60`}
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
