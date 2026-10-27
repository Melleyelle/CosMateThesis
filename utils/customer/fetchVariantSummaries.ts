import { createClient } from '@/utils/client'
import type { DeliveryMethod } from '@/utils/customer/bookingSettings'

// ข้อมูลไซส์ + ชุด ที่หน้าตะกร้าและหน้าชำระเงินต้องใช้ (ราคา/รูป/ชื่อ)
// ไซส์ของชุดที่ถูกปิดเช่าจะไม่ถูกส่งกลับมา (RLS) → ถือว่า "ไม่เปิดให้เช่าแล้ว"
export type VariantSummary = {
  id: string
  size: string
  packagePrice: number // ราคาเช่า 1 วัน (v2) — วันที่ 2 เป็นต้นไปคิดตาม calcRentalPrice()
  depositAmount: number
  laundryFee: number
  depositReturnHours: number
  productId: string
  productName: string
  characterName: string | null
  seriesName: string | null
  coverImageUrl: string | null
  availableUnits: number
}

type Row = {
  id: string
  size: string
  package_price: number | string
  deposit_amount: number | string
  laundry_fee: number | string | null
  deposit_return_hours: number | null
  product_items: { condition_status: string }[] | null
  products: {
    id: string
    name: string
    character_name: string | null
    series_name: string | null
    cover_image_url: string | null
    status: string
  } | null
}

export async function fetchVariantSummaries(
  variantIds: string[],
): Promise<{ data: Record<string, VariantSummary>; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: {}, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const ids = Array.from(new Set(variantIds))
  if (ids.length === 0) return { data: {}, error: null }

  const { data, error } = await supabase
    .from('product_variants')
    .select(
      `id, size, package_price, deposit_amount, laundry_fee, deposit_return_hours,
       product_items ( condition_status ),
       products ( id, name, character_name, series_name, cover_image_url, status )`,
    )
    .in('id', ids)

  if (error) return { data: {}, error: error.message }

  const result: Record<string, VariantSummary> = {}
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.products || row.products.status !== 'active') continue
    result[row.id] = {
      id: row.id,
      size: row.size,
      packagePrice: Number(row.package_price),
      depositAmount: Number(row.deposit_amount),
      laundryFee: Number(row.laundry_fee ?? 0),
      depositReturnHours: row.deposit_return_hours ?? 72,
      productId: row.products.id,
      productName: row.products.name,
      characterName: row.products.character_name,
      seriesName: row.products.series_name,
      coverImageUrl: row.products.cover_image_url,
      availableUnits: (row.product_items ?? []).filter((i) => i.condition_status === 'available').length,
    }
  }
  return { data: result, error: null }
}

// มีรองเท้าที่มากับชุด → ต่อท้ายไซส์ชุดด้วย "~ไซส์รองเท้า" (ว่างต้องคนละรายการกับแบบไม่รับรองเท้า)
export const unavailableKey = (variantId: string, rentalDays: number, delivery: DeliveryMethod, shoeVariantId?: string) =>
  `${shoeVariantId ? `${variantId}~${shoeVariantId}` : variantId}:${rentalDays}:${delivery}`

// วันที่เริ่มใช้งานไม่ได้ของหลาย (ไซส์, รองเท้า, จำนวนวัน, วิธีรับ) พร้อมกัน (ใช้ตรวจของในตะกร้าว่ายังว่างอยู่ไหม)
// ผลเก็บตาม unavailableKey() เพราะวันที่เริ่มไม่ได้ขึ้นกับจำนวนวันที่เช่า วิธีรับชุด และรองเท้าที่เลือก
export async function fetchUnavailableDates(
  requests: { variantId: string; rentalDays: number; delivery: DeliveryMethod; shoeVariantId?: string }[],
  daysAhead = 180,
): Promise<Record<string, Set<string>>> {
  const supabase = createClient()
  const result: Record<string, Set<string>> = {}
  if (!supabase) return result

  const unique = new Map(
    requests.map((r) => [unavailableKey(r.variantId, r.rentalDays, r.delivery, r.shoeVariantId), r]),
  )
  await Promise.all(
    Array.from(unique.entries()).map(async ([key, r]) => {
      const { data } = await supabase.rpc('get_unavailable_start_dates', {
        p_variant_id: r.variantId,
        p_days_ahead: daysAhead,
        p_rental_days: r.rentalDays,
        p_delivery_method: r.delivery,
        ...(r.shoeVariantId ? { p_shoe_variant_id: r.shoeVariantId } : {}),
      })
      result[key] = new Set(((data ?? []) as string[]).map((d) => String(d).slice(0, 10)))
    }),
  )
  return result
}
