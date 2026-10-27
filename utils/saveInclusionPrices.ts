import { createClient } from '@/utils/client'
import type { ProductInclusion } from '@/app/components/admin/costume-form/types'

// บันทึกราคาเช่าแยกชิ้นหลัง create_costume / update_costume (RPC สองตัวนั้นไม่รู้จักราคา)
// จับคู่ด้วย display_order = ลำดับในฟอร์ม เพราะ RPC บันทึกชิ้นส่วนตามลำดับนั้น
export async function saveInclusionPrices(productId: string, inclusions: ProductInclusion[]): Promise<string | null> {
  // ไม่มีชิ้นไหนใส่ราคา → ไม่ต้องเรียก (ชุดที่ไม่เปิดเช่าแยกบันทึกได้แม้ยังไม่ได้รัน Step 16)
  // รายการรองเท้าบังคับใส่ราคาอยู่แล้ว (validateShoeInclusion) จึงไม่หลุดเงื่อนไขนี้
  if (!inclusions.some((inc) => inc.price.trim())) return null

  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'

  const { error } = await supabase.rpc('admin_set_inclusion_prices', {
    p_product_id: productId,
    p_prices: inclusions.map((inc, index) => ({
      display_order: index,
      price: inc.price.trim() ? Number(inc.price) : null,
      // ค่าซักใช้เฉพาะชิ้นที่เปิดเช่าแยก
      laundry_fee: inc.price.trim() && inc.laundryFee.trim() ? Number(inc.laundryFee) : null,
      // ส่งเฉพาะเมื่อมีรองเท้า — ชุดทั่วไปยังบันทึกได้แม้ยังไม่ได้รัน Step 19
      ...(inc.shoeProductId ? { shoe_product_id: inc.shoeProductId } : {}),
    })),
  })
  if (!error) return null
  if (error.message.includes('INVALID_SHOE_PRODUCT')) return 'บันทึกรองเท้าที่มากับชุดไม่สำเร็จ: ต้องเลือกสินค้าประเภทรองเท้า'
  if (error.message.includes('SHOE_PRICE_REQUIRED')) return 'บันทึกรองเท้าที่มากับชุดไม่สำเร็จ: ต้องใส่ราคาแยกชิ้นของรองเท้า'
  if (/shoe_product_id/.test(error.message)) return 'บันทึกรองเท้าที่มากับชุดไม่สำเร็จ: ยังไม่ได้รัน SQL Step 19'
  return /admin_set_inclusion_prices|rental_price/.test(error.message)
    ? 'บันทึกราคาแยกชิ้นไม่สำเร็จ: ยังไม่ได้รัน SQL Step 16'
    : `บันทึกราคาแยกชิ้นไม่สำเร็จ: ${error.message}`
}

// รายการรองเท้าที่มากับชุด: ได้รายการเดียว ต้องเลือกรองเท้า และต้องมีราคา (ใช้ทั้งเช่าแยกและหักตอนไม่รับรองเท้า)
export function validateShoeInclusion(inclusions: ProductInclusion[]): string | null {
  const shoes = inclusions.filter((inc) => inc.shoeProductId)
  if (shoes.length > 1) return 'ชุดหนึ่งมีรองเท้าที่มากับชุดได้รายการเดียว'
  if (shoes.some((inc) => !inc.price.trim())) {
    return 'กรุณาใส่ "ราคาเช่าแยกชิ้น" ของรองเท้า — ใช้เป็นส่วนลดเมื่อลูกค้าเลือกไม่รับรองเท้าด้วย'
  }
  return null
}

// create_costume อาจไม่คืน id → หาจากรหัส SKU ที่เพิ่งบันทึก
export async function findProductIdBySku(skuPrefix: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase.from('products').select('id').eq('sku_prefix', skuPrefix).limit(1).maybeSingle()
  return data?.id ?? null
}
