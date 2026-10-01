import { createClient } from '@/utils/client'
import type { InventoryCostume } from '@/app/components/admin/inventory/CostumeCard'
import type { DateRange } from '@/app/components/admin/inventory/DateRangeFilter'

// ดึงรายการชุดทั้งหมดสำหรับหน้าคลังชุด พร้อมสรุปสต็อกและราคาเริ่มต้นต่อชุด
// ต้องเรียกจากฝั่งแอดมินเท่านั้น (RLS ยอมให้แอดมินเห็นชุด inactive ด้วย ผู้ใช้ทั่วไปจะเห็นแค่ active)
export async function fetchInventoryCostumes(dateRange: DateRange): Promise<{
  data: InventoryCostume[]
  error: string | null
}> {
  const supabase = createClient()
  if (!supabase) {
    return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }
  }

  let query = supabase
    .from('products')
    .select(
      `
      id, name, character_name, series_name, franchise_type, costume_category,
      cover_image_url, status, created_at,
      product_variants (
        package_price,
        product_items ( condition_status )
      )
    `,
    )
    .order('created_at', { ascending: false })

  // กรองตามวันที่อัปโหลด (created_at) — to ต้องบวก 1 วันเพื่อให้รวมทั้งวันสุดท้ายที่เลือก
  if (dateRange.from) {
    query = query.gte('created_at', dateRange.from)
  }
  if (dateRange.to) {
    const toExclusive = new Date(dateRange.to)
    toExclusive.setDate(toExclusive.getDate() + 1)
    query = query.lt('created_at', toExclusive.toISOString().slice(0, 10))
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error: error.message }
  }

  const mapped: InventoryCostume[] = (data ?? []).map((p) => {
    const variants = p.product_variants ?? []
    const allItems = variants.flatMap((v) => v.product_items ?? [])
    const prices = variants.map((v) => v.package_price).filter((n): n is number => n !== null)

    return {
      id: p.id,
      name: p.name,
      characterName: p.character_name,
      seriesName: p.series_name,
      franchiseType: p.franchise_type,
      costumeCategory: p.costume_category,
      coverImageUrl: p.cover_image_url,
      status: p.status,
      createdAt: p.created_at,
      totalUnits: allItems.length,
      availableUnits: allItems.filter((i) => i.condition_status === 'available').length,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
    }
  })

  return { data: mapped, error: null }
}