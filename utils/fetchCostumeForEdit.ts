import { createClient } from '@/utils/client'
import type { CostumeFormData } from '@/app/components/admin/costume-form/types'

// โหลดข้อมูลชุดเดิมทั้งหมดมาใส่ในฟอร์มเดียวกับหน้า "เพิ่มชุดใหม่" เพื่อแก้ไข
// id ของ variant/item ที่ได้จากตรงนี้เป็น id จริงจากฐานข้อมูล (ใช้แยกของเดิม/ของใหม่ตอนบันทึก)
export async function fetchCostumeForEdit(productId: string): Promise<{
  data: CostumeFormData | null
  error: string | null
}> {
  const supabase = createClient()
  if (!supabase) {
    return { data: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }
  }

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id, sku_prefix, name, character_name, series_name, franchise_type, costume_category,
      gender_tag, color_tags, theme_tags, crossplay_friendly, is_group_set, description, cover_image_url,
      product_images ( id, image_url, display_order ),
      product_inclusions ( id, name, image_url, display_order ),
      product_variants (
        id, size, package_price, package_days, deposit_amount, deposit_return_hours, laundry_fee,
        size_charts ( chest_in, waist_in, hip_in, length_in, recommended_height_min, recommended_height_max ),
        product_items ( id, item_code )
      )
    `,
    )
    .eq('id', productId)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }
  if (!data) {
    return { data: null, error: 'ไม่พบชุดนี้ในระบบ' }
  }

  const images = (data.product_images ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((img) => ({
      id: img.id,
      previewUrl: img.image_url,
      uploadedUrl: img.image_url as string | null,
      uploading: false,
      error: null,
    }))

  const inclusions = (data.product_inclusions ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((inc) => ({ id: inc.id, name: inc.name, imageUrl: inc.image_url ?? '' }))

  const variants = (data.product_variants ?? []).map((v) => {
    const chart = Array.isArray(v.size_charts) ? v.size_charts[0] : v.size_charts
    return {
      id: v.id,
      size: v.size,
      packagePrice: v.package_price != null ? String(v.package_price) : '',
      packageDays: v.package_days != null ? String(v.package_days) : '2',
      depositAmount: v.deposit_amount != null ? String(v.deposit_amount) : '',
      depositReturnHours: v.deposit_return_hours != null ? String(v.deposit_return_hours) : '72',
      laundryFee: v.laundry_fee != null ? String(v.laundry_fee) : '',
      chestIn: chart?.chest_in != null ? String(chart.chest_in) : '',
      waistIn: chart?.waist_in != null ? String(chart.waist_in) : '',
      hipIn: chart?.hip_in != null ? String(chart.hip_in) : '',
      lengthIn: chart?.length_in != null ? String(chart.length_in) : '',
      recommendedHeightMin: chart?.recommended_height_min != null ? String(chart.recommended_height_min) : '',
      recommendedHeightMax: chart?.recommended_height_max != null ? String(chart.recommended_height_max) : '',
    }
  })

  const items = (data.product_variants ?? []).flatMap((v) =>
    (v.product_items ?? []).map((item) => ({
      id: item.id,
      variantId: v.id,
      itemCode: item.item_code,
    })),
  )

  // รูปหน้าปกไม่ได้อยู่ใน product_images แยกต่างหาก เก็บเป็น url เดียวบน products.cover_image_url
  const coverImage = data.cover_image_url
    ? {
        id: 'cover',
        previewUrl: data.cover_image_url as string,
        uploadedUrl: data.cover_image_url as string | null,
        uploading: false,
        error: null,
      }
    : null

  const formData: CostumeFormData = {
    basicInfo: {
      skuPrefix: data.sku_prefix ?? '',
      name: data.name ?? '',
      characterName: data.character_name ?? '',
      seriesName: data.series_name ?? '',
      franchiseType: (data.franchise_type as CostumeFormData['basicInfo']['franchiseType']) ?? '',
      costumeCategory: (data.costume_category as CostumeFormData['basicInfo']['costumeCategory']) ?? 'cosplay',
      genderTag: (data.gender_tag as CostumeFormData['basicInfo']['genderTag']) ?? 'unisex',
      colorTags: data.color_tags ?? [],
      themeTags: data.theme_tags ?? [],
      crossplayFriendly: data.crossplay_friendly ?? false,
      isGroupSet: data.is_group_set ?? false,
      description: data.description ?? '',
    },
    coverImage,
    images,
    inclusions,
    variants: variants as CostumeFormData['variants'],
    items,
  }

  return { data: formData, error: null }
}