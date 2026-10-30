import { createClient } from '@/utils/client'
import { piecePrices, type PieceRule, type PieceSettings } from '@/utils/customer/rentalPrice'
import type { ProductInclusion, ProductPricing } from '@/app/components/admin/costume-form/types'

// ชิ้นนี้เปิดเช่าแยกไหม (รองเท้าเปิดเสมอ เพราะราคาเป็นส่วนลดตอนไม่รับรองเท้าด้วย)
export function isPieceOpen(inc: ProductInclusion): boolean {
  return inc.rentMode === 'auto' || (inc.rentMode === 'manual' && !!inc.price.trim())
}

// แถวในฟอร์ม → กติกาคำนวณราคา · แถวว่างไม่นับในสัดส่วน เพราะหน้าร้านตัดแถวว่างออก
export function pieceRulesOf(inclusions: ProductInclusion[]): PieceRule[] {
  return inclusions.map((inc) => {
    const blank = !inc.name.trim() && !inc.imageUrl
    if (inc.rentMode === 'manual') return { id: inc.id, price: inc.price.trim() ? Number(inc.price) : null, weight: null }
    if (blank) return { id: inc.id, price: null, weight: null }
    // auto คำนวณจาก weight ค่า price แค่บอกว่าเปิดเช่า
    return { id: inc.id, price: inc.rentMode === 'auto' ? 0 : null, weight: inc.weight }
  })
}

// บันทึกราคาเช่าแยกชิ้นหลัง create_costume / update_costume (RPC สองตัวนั้นไม่รู้จักราคา)
// จับคู่ด้วย display_order = ลำดับในฟอร์ม เพราะ RPC บันทึกชิ้นส่วนตามลำดับนั้น
// ชิ้นตามระบบเก็บราคาในช่วงราคาปกติไว้ใน rental_price เป็นค่าสำรอง ราคาจริงคำนวณตามตัวที่ได้ตอนจอง (Step 30)
export async function saveInclusionPrices(
  productId: string,
  inclusions: ProductInclusion[],
  pricing: ProductPricing,
  settings: PieceSettings,
): Promise<string | null> {
  // ไม่มีชิ้นไหนเปิดเช่าแยก → ไม่ต้องเรียก (ชุดที่ไม่เปิดเช่าแยกบันทึกได้แม้ยังไม่ได้รัน Step 16)
  // รายการรองเท้าบังคับใส่ราคาอยู่แล้ว (validateShoeInclusion) จึงไม่หลุดเงื่อนไขนี้
  if (!inclusions.some(isPieceOpen)) return null

  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'

  const rules = pieceRulesOf(inclusions)
  const normalPrices = piecePrices(rules, Number(pricing.priceNormal) || 0, settings)
  const { error } = await supabase.rpc('admin_set_inclusion_prices', {
    p_product_id: productId,
    p_prices: inclusions.map((inc, index) => ({
      display_order: index,
      price: normalPrices[inc.id] ?? null,
      // ค่าซักใช้เฉพาะชิ้นที่เปิดเช่าแยก
      laundry_fee: isPieceOpen(inc) && inc.laundryFee.trim() ? Number(inc.laundryFee) : null,
      price_weight: rules[index].weight,
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
  const open = inclusions.filter((inc) => !inc.shoeProductId)
  if (open.some((inc) => inc.rentMode === 'manual' && !inc.price.trim())) {
    return 'กรุณาใส่ราคาของชิ้นที่กำหนดราคาเอง หรือเปลี่ยนเป็นไม่เปิดเช่าแยก'
  }
  if (open.some((inc) => inc.rentMode === 'auto' && !inc.weight)) return 'กรุณาเลือกระดับของชิ้นที่ให้ระบบคำนวณราคา'
  return null
}

// create_costume อาจไม่คืน id → หาจากรหัส SKU ที่เพิ่งบันทึก
export async function findProductIdBySku(skuPrefix: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase.from('products').select('id').eq('sku_prefix', skuPrefix).limit(1).maybeSingle()
  return data?.id ?? null
}
