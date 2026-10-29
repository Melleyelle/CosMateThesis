import { createClient } from '@/utils/client'
import { EMPTY_PRICING, type CostumeFormData, type ProductPricing } from '@/app/components/admin/costume-form/types'
import { isAutoCost, suggestedPrices } from '@/utils/rentalTiers'

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

  // product_inclusions!product_id — ตารางนี้มี FK ไป products 2 เส้น (product_id + shoe_product_id ของ Step 19) ต้องระบุเส้น
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id, sku_prefix, name, character_name, series_name, franchise_type, costume_category,
      gender_tag, color_tags, theme_tags, crossplay_friendly, is_group_set, cover_image_url,
      product_images ( id, image_url, display_order ),
      product_inclusions!product_id ( id, name, image_url, display_order ),
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

  // ราคาแยกชิ้นดึงแยก — ถ้ายังไม่ได้รัน Step 16 คอลัมน์ยังไม่มี ฟอร์มยังเปิดได้ (ราคาว่าง)
  const { data: priceRows } = await supabase
    .from('product_inclusions')
    .select('id, rental_price, laundry_fee')
    .eq('product_id', productId)
  const priceById = new Map((priceRows ?? []).map((r) => [r.id, r.rental_price == null ? '' : String(Number(r.rental_price))]))
  const laundryById = new Map((priceRows ?? []).map((r) => [r.id, r.laundry_fee == null ? '' : String(Number(r.laundry_fee))]))
  // รองเท้าที่มากับชุด (Step 19) ดึงแยก — ยังไม่ได้รัน SQL ก็เปิดฟอร์มได้ (ไม่มีรองเท้า)
  const { data: shoeRows } = await supabase
    .from('product_inclusions')
    .select('id, shoe_product_id')
    .eq('product_id', productId)
  const shoeById = new Map((shoeRows ?? []).map((r) => [r.id, (r.shoe_product_id as string | null) ?? '']))

  const inclusions = (data.product_inclusions ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((inc) => ({
      id: inc.id,
      name: inc.name,
      imageUrl: inc.image_url ?? '',
      price: priceById.get(inc.id) ?? '',
      laundryFee: laundryById.get(inc.id) ?? '',
      shoeProductId: shoeById.get(inc.id) ?? '',
    }))

  // ช่วงไซส์ + ประเภทไซส์ (Step 18) ดึงแยก — ยังไม่ได้รัน SQL ก็เปิดฟอร์มได้ (ถือว่าเป็นค่าเดียว/เสื้อผ้า)
  const variantIds = (data.product_variants ?? []).map((v) => v.id)
  const [rangeRes, systemRes, pricingRes] = await Promise.all([
    variantIds.length > 0
      ? supabase
          .from('size_charts')
          .select('variant_id, chest_max_in, waist_max_in, hip_max_in, foot_min_cm, foot_max_cm')
          .in('variant_id', variantIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('products').select('size_system').eq('id', productId).maybeSingle(),
    // ต้นทุน ราคา 3 ช่วง มัดจำกำหนดเอง ล็อกราคา (Step 25) — ยังไม่ได้รัน SQL ก็เปิดฟอร์มได้ (ราคาว่าง)
    supabase
      .from('products')
      .select('cost_price, deposit_override, price_new, price_normal, price_old, price_locked')
      .eq('id', productId)
      .maybeSingle(),
  ])
  type RangeRow = {
    variant_id: string
    chest_max_in: number | null
    waist_max_in: number | null
    hip_max_in: number | null
    foot_min_cm: number | null
    foot_max_cm: number | null
  }
  const rangeByVariant = new Map(
    rangeRes.error ? [] : ((rangeRes.data ?? []) as RangeRow[]).map((r) => [r.variant_id, r]),
  )
  const sizeSystem: CostumeFormData['basicInfo']['sizeSystem'] =
    !systemRes.error && systemRes.data?.size_system === 'shoes' ? 'shoes' : 'clothing'
  const str = (n: number | string | null | undefined) => (n != null ? String(Number(n)) : '')

  const variants = (data.product_variants ?? []).map((v) => {
    const chart = Array.isArray(v.size_charts) ? v.size_charts[0] : v.size_charts
    const range = rangeByVariant.get(v.id)
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
      chestMaxIn: str(range?.chest_max_in),
      waistMaxIn: str(range?.waist_max_in),
      hipMaxIn: str(range?.hip_max_in),
      footMinCm: str(range?.foot_min_cm),
      footMaxCm: str(range?.foot_max_cm),
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
      sizeSystem,
    },
    pricing: pricingOf(pricingRes.error ? null : pricingRes.data),
    coverImage,
    images,
    inclusions,
    variants: variants as CostumeFormData['variants'],
    items,
  }

  return { data: formData, error: null }
}

type PricingRow = {
  cost_price: number | string | null
  deposit_override: number | string | null
  price_new: number | string | null
  price_normal: number | string | null
  price_old: number | string | null
  price_locked: boolean | null
}

// ราคาไม่ตรงกับที่ระบบแนะนำจากต้นทุน = แอดมินเคยแก้เอง → แก้ต้นทุนแล้วไม่เติมราคาทับ
function pricingOf(row: PricingRow | null): ProductPricing {
  if (!row) return EMPTY_PRICING
  const s = (v: number | string | null) => (v == null ? '' : String(Number(v)))
  const pricing: ProductPricing = {
    costPrice: s(row.cost_price),
    depositOverride: s(row.deposit_override),
    priceNew: s(row.price_new),
    priceNormal: s(row.price_normal),
    priceOld: s(row.price_old),
    priceLocked: row.price_locked ?? false,
    manual: true,
  }
  const cost = row.cost_price == null ? null : Number(row.cost_price)
  if (isAutoCost(cost)) {
    const suggested = suggestedPrices(cost)
    pricing.manual =
      Number(pricing.priceNew) !== suggested.new ||
      Number(pricing.priceNormal) !== suggested.normal ||
      Number(pricing.priceOld) !== suggested.old
  }
  return pricing
}