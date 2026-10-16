// utils/sizeStock.ts
// ดึงและจัดรูปจำนวนชุดต่อไซส์จาก view product_size_stock (cosmate_step15_product_size_stock.sql)
import { createClient } from '@/utils/client'

export type SizeStock = {
  size: string
  availableCount: number
  packagePrice: number
}

// เรียงตามขนาดจริง ไม่ใช่ตามตัวอักษร (enum ที่เพิ่ม XS/XXL ทีหลังอาจเรียงผิดในฐานข้อมูล)
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size']

export function sortSizes<T extends { size: string }>(rows: T[]): T[] {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s)
    return i === -1 ? SIZE_ORDER.length : i
  }
  return [...rows].sort((a, b) => rank(a.size) - rank(b.size))
}

/**
 * ดึงจำนวนต่อไซส์ของหลายชุดในครั้งเดียว (ใช้กับหน้ารายการ ไม่ต้องยิงทีละการ์ด)
 * คืน Map<product_id, SizeStock[]> ที่เรียงไซส์แล้ว
 * ถ้าดึงไม่สำเร็จคืน Map ว่าง — การ์ดยังแสดงได้ แค่ไม่มีแถบไซส์ ไม่ทำให้ทั้งหน้าพัง
 */
export async function fetchSizeStock(productIds: string[]): Promise<Map<string, SizeStock[]>> {
  const result = new Map<string, SizeStock[]>()
  const supabase = createClient()
  if (!supabase || productIds.length === 0) return result

  const { data, error } = await supabase
    .from('product_size_stock')
    .select('product_id, size, available_count, package_price')
    .in('product_id', productIds)

  if (error || !data) {
    console.error('fetchSizeStock', error)
    return result
  }

  for (const row of data as { product_id: string; size: string; available_count: number; package_price: number | string }[]) {
    const list = result.get(row.product_id) ?? []
    // numeric จาก Postgres อาจมาเป็น string
    list.push({ size: row.size, availableCount: row.available_count, packagePrice: Number(row.package_price) })
    result.set(row.product_id, list)
  }
  for (const [id, list] of result) result.set(id, sortSizes(list))
  return result
}

/** ราคาต่างกันตามไซส์ไหม — ถ้าต่าง การ์ดแสดง "เริ่ม ฿…" แทนราคาเดียว */
export function pricesVary(sizes: SizeStock[]): boolean {
  return new Set(sizes.map((s) => s.packagePrice)).size > 1
}

/** รวมทุกไซส์ — ใช้ตัดสินว่าชุดนี้ "หมดชั่วคราว" ทั้งชุดหรือไม่ */
export function totalAvailable(sizes: SizeStock[]): number {
  return sizes.reduce((sum, s) => sum + s.availableCount, 0)
}