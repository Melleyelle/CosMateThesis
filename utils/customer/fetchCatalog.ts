import { createClient } from '@/utils/client'
import { colorKeysOf } from '@/utils/customer/filterOptions'

export type CatalogCostume = {
  id: string
  name: string
  characterName: string | null
  seriesName: string | null
  franchiseType: string | null
  costumeCategory: string | null
  genderTag: string | null
  coverImageUrl: string | null
  createdAt: string
  sizes: string[]
  /** ไซส์ที่มีชุดพร้อมเช่าอย่างน้อย 1 ตัว — ใช้เช็กวันว่างรายไซส์ */
  rentableVariants: { id: string; size: string }[]
  colorKeys: string[]
  themeKeys: string[]
  minPrice: number | null
  minPricePackageDays: number | null
  avgRating: number | null
  reviewCount: number
}

type ProductVariantRow = {
  id: string
  size: string | null
  package_price: number | string | null
  package_days: number | string | null
  product_items: { condition_status: string }[] | null
}

type ProductRow = {
  id: string
  name: string
  character_name: string | null
  series_name: string | null
  franchise_type: string | null
  costume_category: string | null
  gender_tag: string | null
  color_tags: string[] | null
  theme_tags: string[] | null
  cover_image_url: string | null
  created_at: string
  product_variants: ProductVariantRow[] | null
}

type ReviewRow = { product_id: string; rating: number | string }

function stringArray(values: string[] | null): string[] {
  return Array.isArray(values) ? Array.from(new Set(values.filter((value) => typeof value === 'string' && value))) : []
}

export async function fetchCatalog(limit?: number): Promise<{ data: CatalogCostume[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  let query = supabase
    .from('products')
    .select(
      `
      id, name, character_name, series_name, franchise_type, costume_category, gender_tag,
      color_tags, theme_tags, cover_image_url, created_at,
      product_variants ( id, size, package_price, package_days, product_items ( condition_status ) )
    `,
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (limit != null && Number.isFinite(limit) && limit > 0) query = query.limit(Math.floor(limit))

  const { data, error } = await query
  if (error) return { data: [], error: error.message }

  const products = (data ?? []) as unknown as ProductRow[]
  const ratings = new Map<string, { sum: number; count: number }>()
  if (products.length > 0) {
    const { data: reviews, error: reviewError } = await supabase
      .from('product_reviews')
      .select('product_id, rating')
      .in('product_id', products.map((product) => product.id))
      .eq('is_hidden', false)

    if (!reviewError) {
      for (const review of (reviews ?? []) as ReviewRow[]) {
        const rating = Number(review.rating)
        if (!Number.isFinite(rating)) continue
        const summary = ratings.get(review.product_id) ?? { sum: 0, count: 0 }
        summary.sum += rating
        summary.count += 1
        ratings.set(review.product_id, summary)
      }
    }
  }

  const mapped = products.map((product): CatalogCostume => {
    const variants = product.product_variants ?? []
    const pricedVariants = variants
      .filter((variant) => variant.package_price != null)
      .map((variant) => ({
        price: Number(variant.package_price),
        days: variant.package_days == null ? null : Number(variant.package_days),
      }))
      .filter((variant) => Number.isFinite(variant.price))
      .sort((a, b) => a.price - b.price)
    const rating = ratings.get(product.id)
    const rentableVariants = variants
      .filter((variant) => (variant.product_items ?? []).some((item) => item.condition_status === 'available'))
      .filter((variant): variant is ProductVariantRow & { size: string } => !!variant.size)
      .map((variant) => ({ id: variant.id, size: variant.size }))

    return {
      id: product.id,
      name: product.name,
      characterName: product.character_name,
      seriesName: product.series_name,
      franchiseType: product.franchise_type,
      costumeCategory: product.costume_category,
      genderTag: product.gender_tag,
      coverImageUrl: product.cover_image_url,
      createdAt: product.created_at,
      sizes: Array.from(new Set(rentableVariants.map((variant) => variant.size))),
      rentableVariants,
      colorKeys: colorKeysOf(product.color_tags), // รองรับทั้งคีย์ (pink) และชื่อไทย (ชมพู) ที่บันทึกไว้แบบเก่า
      themeKeys: stringArray(product.theme_tags),
      minPrice: pricedVariants[0]?.price ?? null,
      minPricePackageDays: pricedVariants[0]?.days ?? null,
      avgRating: rating && rating.count > 0 ? rating.sum / rating.count : null,
      reviewCount: rating?.count ?? 0,
    }
  })

  return { data: mapped, error: null }
}

/**
 * วันเริ่มใช้งาน (วันใส่ชุด) ที่จองไม่ได้ของหลายไซส์ — RPC เดียวกับปฏิทินหน้ารายละเอียดชุด
 * จึงคิด buffer ขนส่ง/ซัก และจำนวนชุดจริงเหมือนกันทุกจุด
 * ยิงทีละกลุ่มเพื่อไม่ให้ส่งคำขอพร้อมกันมากเกินไปเมื่อแคตตาล็อกใหญ่
 */
export async function fetchUnavailableStartDates(
  variantIds: string[],
  daysAhead: number,
): Promise<{ data: Map<string, Set<string>>; error: string | null }> {
  const result = new Map<string, Set<string>>()
  const supabase = createClient()
  if (!supabase) return { data: result, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const ids = Array.from(new Set(variantIds))
  const BATCH = 8
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const responses = await Promise.all(
      batch.map((id) => supabase.rpc('get_unavailable_start_dates', { p_variant_id: id, p_days_ahead: daysAhead })),
    )
    for (const [j, { data, error }] of responses.entries()) {
      if (error) return { data: new Map(), error: error.message }
      result.set(batch[j], new Set(((data ?? []) as string[]).map((d) => String(d).slice(0, 10))))
    }
  }
  return { data: result, error: null }
}