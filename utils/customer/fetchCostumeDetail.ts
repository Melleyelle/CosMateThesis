import { createClient } from '@/utils/client'
import { compareSize } from '@/utils/customer/labels'

export type SizeChart = {
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
  chart: SizeChart | null
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
  images: string[] // รูปหน้าปกก่อน ตามด้วย product_images ตาม display_order
  inclusions: { id: string; name: string; imageUrl: string | null }[]
  variants: CostumeVariant[]
}

type ChartRow = {
  chest_in: number | string | null
  waist_in: number | string | null
  hip_in: number | string | null
  length_in: number | string | null
  recommended_height_min: number | string | null
  recommended_height_max: number | string | null
}

type DetailRow = {
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
  product_images: { image_url: string; display_order: number }[] | null
  product_inclusions: { id: string; name: string; image_url: string | null; display_order: number }[] | null
  product_variants:
    | {
        id: string
        size: string
        package_price: number | string | null
        package_days: number | null
        deposit_amount: number | string | null
        deposit_return_hours: number | null
        laundry_fee: number | string | null
        size_charts: ChartRow | ChartRow[] | null
        product_items: { condition_status: string }[] | null
      }[]
    | null
}

const num = (v: number | string | null | undefined) => (v == null || v === '' ? null : Number(v))

// ดึงรายละเอียดชุดสำหรับหน้าลูกค้า — กรอง status='active' ซ้ำกับ RLS เหมือน fetchCatalog
export async function fetchCostumeDetail(
  productId: string,
): Promise<{ data: CostumeDetail | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) {
    return { data: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }
  }

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
  if (!data) return { data: null, error: 'ไม่พบชุดนี้ หรือชุดนี้ปิดให้เช่าแล้ว' }

  const p = data as unknown as DetailRow

  const gallery = (p.product_images ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((img) => img.image_url)
  const images = Array.from(new Set([p.cover_image_url, ...gallery].filter((u): u is string => !!u)))

  const inclusions = (p.product_inclusions ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((inc) => ({ id: inc.id, name: inc.name, imageUrl: inc.image_url }))

  const variants = (p.product_variants ?? [])
    .filter((v) => v.package_price != null)
    .map((v): CostumeVariant => {
      const c = Array.isArray(v.size_charts) ? v.size_charts[0] : v.size_charts
      const chart: SizeChart | null = c
        ? {
            chestIn: num(c.chest_in),
            waistIn: num(c.waist_in),
            hipIn: num(c.hip_in),
            lengthIn: num(c.length_in),
            heightMin: num(c.recommended_height_min),
            heightMax: num(c.recommended_height_max),
          }
        : null
      const hasChart = chart && Object.values(chart).some((x) => x != null)
      return {
        id: v.id,
        size: v.size,
        packagePrice: Number(v.package_price),
        packageDays: v.package_days ?? 2,
        depositAmount: Number(v.deposit_amount ?? 0),
        depositReturnHours: v.deposit_return_hours ?? 72,
        laundryFee: Number(v.laundry_fee ?? 0),
        availableUnits: (v.product_items ?? []).filter((i) => i.condition_status === 'available').length,
        chart: hasChart ? chart : null,
      }
    })
    .sort((a, b) => compareSize(a.size, b.size))

  return {
    data: {
      id: p.id,
      name: p.name,
      characterName: p.character_name,
      seriesName: p.series_name,
      franchiseType: p.franchise_type,
      costumeCategory: p.costume_category,
      genderTag: p.gender_tag,
      colorTags: p.color_tags ?? [],
      crossplayFriendly: !!p.crossplay_friendly,
      isGroupSet: !!p.is_group_set,
      description: p.description,
      images,
      inclusions,
      variants,
    },
    error: null,
  }
}
