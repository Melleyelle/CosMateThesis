import { createClient } from '@/utils/client'

// chestIn/waistIn/hipIn = ค่าต่ำสุดของช่วง · *MaxIn = ค่าสูงสุด (Step 18) · ช่วงเท่ากัน = ค่าเดียว
export type CostumeSizeChart = {
  chestIn: number | null
  chestMaxIn: number | null
  waistIn: number | null
  waistMaxIn: number | null
  hipIn: number | null
  hipMaxIn: number | null
  footMinCm: number | null
  footMaxCm: number | null
  lengthIn: number | null
  heightMin: number | null
  heightMax: number | null
}

export type CostumeVariant = {
  id: string
  size: string
  packagePrice: number // ราคาเช่า 1 วัน (v2)
  depositAmount: number
  depositReturnHours: number
  laundryFee: number
  availableUnits: number
  chart: CostumeSizeChart | null
}

// รองเท้าที่มากับชุด (Step 19) — สินค้ารองเท้าในคลังที่ผูกกับรายการหนึ่งใน "สิ่งที่ได้รับ"
export type SetShoeVariant = {
  id: string
  size: string
  availableUnits: number
  footMinCm: number | null
  footMaxCm: number | null
}

export type SetShoes = {
  inclusionId: string // รายการใน inclusions ที่เป็นรองเท้า
  productId: string
  productName: string
  price: number // ราคาแยกชิ้นของรองเท้า = ส่วนที่หักออกเมื่อไม่รับรองเท้า
  variants: SetShoeVariant[] // ว่าง = รองเท้าปิดขายอยู่ เลือกได้แค่ไม่รับรองเท้า
}

export type CostumeDetail = {
  id: string
  name: string
  characterName: string | null
  seriesName: string | null
  franchiseType: string | null
  costumeCategory: string | null
  genderTag: string | null
  colorTags: string[]
  crossplayFriendly: boolean
  isGroupSet: boolean
  sizeSystem: 'clothing' | 'shoes'
  images: string[]
  // price = ค่าเช่าเมื่อเลือกแยกชิ้น (null = ชิ้นนี้ไม่เปิดให้เช่าแยก)
  inclusions: { id: string; name: string; imageUrl: string | null; price: number | null; laundryFee: number }[]
  variants: CostumeVariant[]
  shoes: SetShoes | null
}

type SizeChartRow = {
  chest_in: number | string | null
  waist_in: number | string | null
  hip_in: number | string | null
  length_in: number | string | null
  recommended_height_min: number | string | null
  recommended_height_max: number | string | null
}

type CostumeVariantRow = {
  id: string
  size: string
  package_price: number | string | null
  deposit_amount: number | string | null
  deposit_return_hours: number | string | null
  laundry_fee: number | string | null
  size_charts: SizeChartRow | SizeChartRow[] | null
  product_items: { condition_status: string }[] | null
}

type CostumeRow = {
  id: string
  name: string
  character_name: string | null
  series_name: string | null
  franchise_type: string | null
  costume_category: string | null
  gender_tag: string | null
  color_tags: string[] | null
  crossplay_friendly: boolean | null
  is_group_set: boolean | null
  cover_image_url: string | null
  product_images: { image_url: string | null; display_order: number }[] | null
  product_inclusions: { id: string; name: string; image_url: string | null; display_order: number }[] | null
  product_variants: CostumeVariantRow[] | null
}

function nullableNumber(value: number | string | null): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapSizeChart(value: CostumeVariantRow['size_charts']): CostumeSizeChart | null {
  const chart = Array.isArray(value) ? value[0] : value
  if (!chart) return null
  return {
    chestIn: nullableNumber(chart.chest_in),
    chestMaxIn: null,
    waistIn: nullableNumber(chart.waist_in),
    waistMaxIn: null,
    hipIn: nullableNumber(chart.hip_in),
    hipMaxIn: null,
    footMinCm: null,
    footMaxCm: null,
    lengthIn: nullableNumber(chart.length_in),
    heightMin: nullableNumber(chart.recommended_height_min),
    heightMax: nullableNumber(chart.recommended_height_max),
  }
}

function withRange(
  chart: CostumeSizeChart | null,
  range:
    | {
        chest_max_in: number | string | null
        waist_max_in: number | string | null
        hip_max_in: number | string | null
        foot_min_cm: number | string | null
        foot_max_cm: number | string | null
      }
    | undefined,
): CostumeSizeChart | null {
  if (!range) return chart
  const merged: CostumeSizeChart = {
    ...(chart ?? {
      chestIn: null,
      chestMaxIn: null,
      waistIn: null,
      waistMaxIn: null,
      hipIn: null,
      hipMaxIn: null,
      footMinCm: null,
      footMaxCm: null,
      lengthIn: null,
      heightMin: null,
      heightMax: null,
    }),
    chestMaxIn: nullableNumber(range.chest_max_in),
    waistMaxIn: nullableNumber(range.waist_max_in),
    hipMaxIn: nullableNumber(range.hip_max_in),
    footMinCm: nullableNumber(range.foot_min_cm),
    footMaxCm: nullableNumber(range.foot_max_cm),
  }
  return merged
}

export async function fetchCostumeDetail(productId: string): Promise<{
  data: CostumeDetail | null
  error: string | null
}> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  // product_inclusions!product_id — ตารางนี้มี FK ไป products 2 เส้น (product_id + shoe_product_id ของ Step 19) ต้องระบุเส้น
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id, name, character_name, series_name, franchise_type, costume_category,
      gender_tag, color_tags, crossplay_friendly, is_group_set, cover_image_url,
      product_images ( image_url, display_order ),
      product_inclusions!product_id ( id, name, image_url, display_order ),
      product_variants (
        id, size, package_price, deposit_amount, deposit_return_hours, laundry_fee,
        size_charts ( chest_in, waist_in, hip_in, length_in, recommended_height_min, recommended_height_max ),
        product_items ( condition_status )
      )
    `,
    )
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'ไม่พบชุดนี้ในระบบ' }

  const product = data as unknown as CostumeRow

  // ราคาแยกชิ้นดึงแยก เพราะถ้ายังไม่ได้รัน Step 16 คอลัมน์ rental_price ยังไม่มี → ถือว่าเช่าแยกไม่ได้ หน้าไม่พัง
  const { data: priceRows, error: priceError } = await supabase
    .from('product_inclusions')
    .select('id, rental_price, laundry_fee')
    .eq('product_id', productId)
  const priceById = new Map<string, number>()
  const laundryById = new Map<string, number>()
  if (!priceError) {
    for (const r of priceRows ?? []) {
      if (r.rental_price != null) priceById.set(r.id, Number(r.rental_price))
      if (r.laundry_fee != null) laundryById.set(r.id, Number(r.laundry_fee))
    }
  }
  // ช่วงไซส์ + ประเภทไซส์ (Step 18) ดึงแยก — ยังไม่ได้รัน SQL หน้าชุดยังแสดงตารางไซส์ค่าเดียวได้
  const variantIds = (product.product_variants ?? []).map((v) => v.id)
  const [rangeRes, systemRes] = await Promise.all([
    variantIds.length > 0
      ? supabase
          .from('size_charts')
          .select('variant_id, chest_max_in, waist_max_in, hip_max_in, foot_min_cm, foot_max_cm')
          .in('variant_id', variantIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('products').select('size_system').eq('id', productId).maybeSingle(),
  ])
  type RangeRow = {
    variant_id: string
    chest_max_in: number | string | null
    waist_max_in: number | string | null
    hip_max_in: number | string | null
    foot_min_cm: number | string | null
    foot_max_cm: number | string | null
  }
  const rangeByVariant = new Map(
    rangeRes.error ? [] : ((rangeRes.data ?? []) as RangeRow[]).map((r) => [r.variant_id, r]),
  )
  const sizeSystem = !systemRes.error && systemRes.data?.size_system === 'shoes' ? 'shoes' : 'clothing'

  const galleryImages = (product.product_images ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((image) => image.image_url)
  const images = Array.from(new Set([product.cover_image_url, ...galleryImages].filter((url): url is string => !!url)))

  const variants = (product.product_variants ?? []).map((variant): CostumeVariant => ({
    id: variant.id,
    size: variant.size,
    packagePrice: Number(variant.package_price ?? 0),
    depositAmount: Number(variant.deposit_amount ?? 0),
    depositReturnHours: Number(variant.deposit_return_hours ?? 72),
    laundryFee: Number(variant.laundry_fee ?? 0),
    availableUnits: (variant.product_items ?? []).filter((item) => item.condition_status === 'available').length,
    chart: withRange(mapSizeChart(variant.size_charts), rangeByVariant.get(variant.id)),
  }))

  const shoes = await fetchSetShoes(productId, priceById)

  return {
    data: {
      id: product.id,
      name: product.name,
      characterName: product.character_name,
      seriesName: product.series_name,
      franchiseType: product.franchise_type,
      costumeCategory: product.costume_category,
      genderTag: product.gender_tag,
      colorTags: product.color_tags ?? [],
      crossplayFriendly: product.crossplay_friendly ?? false,
      isGroupSet: product.is_group_set ?? false,
      sizeSystem,
      images,
      inclusions: (product.product_inclusions ?? [])
        // ตัดแถวว่างที่แอดมินเพิ่มไว้แต่ไม่ได้กรอก — ถ้าไม่เหลือเลย หน้าชุดจะไม่แสดง section สิ่งที่ได้รับ
        .filter((inclusion) => inclusion.name?.trim() || inclusion.image_url)
        .sort((a, b) => a.display_order - b.display_order)
        .map((inclusion) => ({
          id: inclusion.id,
          name: inclusion.name,
          imageUrl: inclusion.image_url,
          price: priceById.get(inclusion.id) ?? null,
          laundryFee: laundryById.get(inclusion.id) ?? 0,
        })),
      variants,
      shoes,
    },
    error: null,
  }
}

// ยังไม่ได้รัน Step 19 (ไม่มี shoe_product_id) หรือชุดไม่มีรองเท้า → null หน้าชุดแสดงแบบเดิม
async function fetchSetShoes(productId: string, priceById: Map<string, number>): Promise<SetShoes | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data: link, error } = await supabase
    .from('product_inclusions')
    .select('id, shoe_product_id')
    .eq('product_id', productId)
    .not('shoe_product_id', 'is', null)
    .limit(1)
    .maybeSingle()
  if (error || !link?.shoe_product_id) return null

  const base = {
    inclusionId: link.id as string,
    productId: link.shoe_product_id as string,
    price: priceById.get(link.id) ?? 0,
  }

  // รองเท้าที่ปิดขาย RLS จะไม่คืนแถวมา → ยังหักราคาตอนไม่รับรองเท้าได้ แต่เลือกไซส์ไม่ได้
  const { data: shoe } = await supabase
    .from('products')
    .select('id, name, product_variants ( id, size, product_items ( condition_status ) )')
    .eq('id', base.productId)
    .eq('status', 'active')
    .maybeSingle()
  if (!shoe) return { ...base, productName: 'รองเท้า', variants: [] }

  type ShoeVariantRow = { id: string; size: string; product_items: { condition_status: string }[] | null }
  const rows = ((shoe as { product_variants: ShoeVariantRow[] | null }).product_variants ?? [])
  const { data: ranges } =
    rows.length > 0
      ? await supabase
          .from('size_charts')
          .select('variant_id, foot_min_cm, foot_max_cm')
          .in('variant_id', rows.map((r) => r.id))
      : { data: [] }
  const rangeById = new Map(
    ((ranges ?? []) as { variant_id: string; foot_min_cm: number | string | null; foot_max_cm: number | string | null }[]).map(
      (r) => [r.variant_id, r],
    ),
  )

  return {
    ...base,
    productName: (shoe as { name: string }).name,
    variants: rows.map((r) => ({
      id: r.id,
      size: r.size,
      availableUnits: (r.product_items ?? []).filter((i) => i.condition_status === 'available').length,
      footMinCm: nullableNumber(rangeById.get(r.id)?.foot_min_cm ?? null),
      footMaxCm: nullableNumber(rangeById.get(r.id)?.foot_max_cm ?? null),
    })),
  }
}