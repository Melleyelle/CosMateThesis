import { createClient } from '@/utils/client'

export type CostumeSizeChart = {
  chestIn: number | null
  waistIn: number | null
  hipIn: number | null
  lengthIn: number | null
  heightMin: number | null
  heightMax: number | null
}

export type CostumeVariant = {
  id: string
  size: string
  packagePrice: number
  packageDays: number
  depositAmount: number
  depositReturnHours: number
  laundryFee: number
  availableUnits: number
  chart: CostumeSizeChart | null
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
  description: string | null
  images: string[]
  inclusions: { id: string; name: string; imageUrl: string | null }[]
  variants: CostumeVariant[]
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
  package_days: number | string | null
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
  description: string | null
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
    waistIn: nullableNumber(chart.waist_in),
    hipIn: nullableNumber(chart.hip_in),
    lengthIn: nullableNumber(chart.length_in),
    heightMin: nullableNumber(chart.recommended_height_min),
    heightMax: nullableNumber(chart.recommended_height_max),
  }
}

export async function fetchCostumeDetail(productId: string): Promise<{
  data: CostumeDetail | null
  error: string | null
}> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id, name, character_name, series_name, franchise_type, costume_category,
      gender_tag, color_tags, crossplay_friendly, is_group_set, description, cover_image_url,
      product_images ( image_url, display_order ),
      product_inclusions ( id, name, image_url, display_order ),
      product_variants (
        id, size, package_price, package_days, deposit_amount, deposit_return_hours, laundry_fee,
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
  const galleryImages = (product.product_images ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((image) => image.image_url)
  const images = Array.from(new Set([product.cover_image_url, ...galleryImages].filter((url): url is string => !!url)))

  const variants = (product.product_variants ?? []).map((variant): CostumeVariant => ({
    id: variant.id,
    size: variant.size,
    packagePrice: Number(variant.package_price ?? 0),
    packageDays: Number(variant.package_days ?? 2),
    depositAmount: Number(variant.deposit_amount ?? 0),
    depositReturnHours: Number(variant.deposit_return_hours ?? 72),
    laundryFee: Number(variant.laundry_fee ?? 0),
    availableUnits: (variant.product_items ?? []).filter((item) => item.condition_status === 'available').length,
    chart: mapSizeChart(variant.size_charts),
  }))

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
      description: product.description,
      images,
      inclusions: (product.product_inclusions ?? [])
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((inclusion) => ({ id: inclusion.id, name: inclusion.name, imageUrl: inclusion.image_url })),
      variants,
    },
    error: null,
  }
}