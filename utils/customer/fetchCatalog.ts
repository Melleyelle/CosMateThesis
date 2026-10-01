import { createClient } from '@/utils/client'
import { compareSize } from '@/utils/customer/labels'
import { colorKeysOf, themeKeysOf } from '@/utils/customer/filterOptions'
import { fetchRatingSummaries } from '@/utils/customer/reviews'

export type CatalogCostume = {
  id: string
  name: string
  characterName: string | null
  seriesName: string | null
  franchiseType: string | null
  costumeCategory: string | null
  genderTag: string | null
  crossplayFriendly: boolean
  coverImageUrl: string | null
  createdAt: string
  minPrice: number | null
  minPricePackageDays: number // จำนวนวันแพ็กเกจของไซส์ที่ถูกที่สุด (ใช้แสดง "/ N วัน")
  sizes: string[]
  colorTags: string[]
  colorKeys: string[] // แปลงเป็นคีย์มาตรฐานแล้ว เช่น 'pink', 'white' (ใช้กรอง + จุดสีบนการ์ด)
  themeKeys: string[]
  availableUnits: number
  totalUnits: number
  avgRating: number | null // null = ยังไม่มีรีวิว
  reviewCount: number
}

type CatalogRow = {
  id: string
  name: string
  character_name: string | null
  series_name: string | null
  franchise_type: string | null
  costume_category: string | null
  gender_tag: string | null
  crossplay_friendly: boolean | null
  cover_image_url: string | null
  color_tags: string[] | null
  theme_tags: string[] | null
  created_at: string
  product_variants:
    | {
        size: string
        package_price: number | string | null
        package_days: number | null
        product_items: { condition_status: string }[] | null
      }[]
    | null
}

// ดึงรายการชุดที่เปิดให้เช่าสำหรับหน้าลูกค้า
// ใส่ .eq('status','active') ซ้ำกับ RLS โดยตั้งใจ: แอดมินที่ล็อกอินอยู่แล้วเปิดหน้าร้าน
// จะเห็นชุดฉบับร่างด้วย (RLS ให้แอดมินเห็นทุกชุด) ถ้าไม่กรองตรงนี้
export async function fetchCatalog(limit?: number): Promise<{ data: CatalogCostume[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) {
    return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }
  }

  let query = supabase
    .from('products')
    .select(
      `
      id, name, character_name, series_name, franchise_type, costume_category,
      gender_tag, crossplay_friendly, cover_image_url, color_tags, theme_tags, created_at,
      product_variants ( size, package_price, package_days, product_items ( condition_status ) )
    `,
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (limit) query = query.limit(limit)

  const [{ data, error }, ratings] = await Promise.all([query, fetchRatingSummaries()])
  if (error) return { data: [], error: error.message }

  const rows = (data ?? []) as unknown as CatalogRow[]
  const mapped = rows.map((p): CatalogCostume => {
    const variants = p.product_variants ?? []
    const items = variants.flatMap((v) => v.product_items ?? [])
    const priced = variants
      .filter((v) => v.package_price != null)
      .map((v) => ({ price: Number(v.package_price), days: v.package_days ?? 2 }))
      .sort((a, b) => a.price - b.price)
    const colorTags = p.color_tags ?? []

    return {
      id: p.id,
      name: p.name,
      characterName: p.character_name,
      seriesName: p.series_name,
      franchiseType: p.franchise_type,
      costumeCategory: p.costume_category,
      genderTag: p.gender_tag,
      crossplayFriendly: !!p.crossplay_friendly,
      coverImageUrl: p.cover_image_url,
      createdAt: p.created_at,
      minPrice: priced.length > 0 ? priced[0].price : null,
      minPricePackageDays: priced.length > 0 ? priced[0].days : 2,
      sizes: Array.from(new Set(variants.map((v) => v.size))).sort(compareSize),
      colorTags,
      colorKeys: colorKeysOf(colorTags),
      themeKeys: themeKeysOf(p.theme_tags ?? [], p.franchise_type),
      availableUnits: items.filter((i) => i.condition_status === 'available').length,
      totalUnits: items.length,
      avgRating: ratings[p.id]?.avgRating ?? null,
      reviewCount: ratings[p.id]?.reviewCount ?? 0,
    }
  })

  return { data: mapped, error: null }
}
