import { createClient } from '@/utils/client'
import type { ProductInclusion } from '@/app/components/admin/costume-form/types'

// บันทึกราคาเช่าแยกชิ้นหลัง create_costume / update_costume (RPC สองตัวนั้นไม่รู้จักราคา)
// จับคู่ด้วย display_order = ลำดับในฟอร์ม เพราะ RPC บันทึกชิ้นส่วนตามลำดับนั้น
export async function saveInclusionPrices(productId: string, inclusions: ProductInclusion[]): Promise<string | null> {
  // ไม่มีชิ้นไหนใส่ราคา → ไม่ต้องเรียก (ชุดที่ไม่เปิดเช่าแยกบันทึกได้แม้ยังไม่ได้รัน Step 16)
  if (!inclusions.some((inc) => inc.price.trim())) return null

  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'

  const { error } = await supabase.rpc('admin_set_inclusion_prices', {
    p_product_id: productId,
    p_prices: inclusions.map((inc, index) => ({
      display_order: index,
      price: inc.price.trim() ? Number(inc.price) : null,
    })),
  })
  if (!error) return null
  return /admin_set_inclusion_prices|rental_price/.test(error.message)
    ? 'บันทึกราคาแยกชิ้นไม่สำเร็จ: ยังไม่ได้รัน SQL Step 16'
    : `บันทึกราคาแยกชิ้นไม่สำเร็จ: ${error.message}`
}

// create_costume อาจไม่คืน id → หาจากรหัส SKU ที่เพิ่งบันทึก
export async function findProductIdBySku(skuPrefix: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase.from('products').select('id').eq('sku_prefix', skuPrefix).limit(1).maybeSingle()
  return data?.id ?? null
}
