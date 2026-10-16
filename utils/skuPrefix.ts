// utils/skuPrefix.ts
// กติการหัสอ้างอิงชุด — ต้องตรงกับ check constraint products_sku_prefix_format
// (cosmate_step14_sku_prefix_limit.sql): ^[A-Z0-9]{2,12}$
// ไม่มีขีด เพราะขีดใช้คั่นรหัสชุดจริง เช่น NEZUKO-M-01

export const SKU_PREFIX_MIN = 2
export const SKU_PREFIX_MAX = 12
export const SKU_PREFIX_PATTERN = /^[A-Z0-9]{2,12}$/

/**
 * ทำความสะอาดค่าที่พิมพ์/วาง: แปลงเป็นตัวพิมพ์ใหญ่ ตัดทุกอย่างที่ไม่ใช่ A–Z, 0–9
 * (ช่องว่าง ขีด ภาษาไทย) และตัดให้ไม่เกิน 12 ตัว — ใช้ใน onChange ของช่องกรอก
 */
export function normalizeSkuPrefix(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, SKU_PREFIX_MAX)
}

/** คืนข้อความ error ภาษาไทย หรือ null ถ้าผ่าน */
export function validateSkuPrefix(value: string): string | null {
  if (!value) return 'กรุณากรอกรหัสอ้างอิงชุด'
  if (value.length < SKU_PREFIX_MIN) return `รหัสอ้างอิงชุดต้องมีอย่างน้อย ${SKU_PREFIX_MIN} ตัว`
  if (value.length > SKU_PREFIX_MAX) return `รหัสอ้างอิงชุดยาวได้ไม่เกิน ${SKU_PREFIX_MAX} ตัว`
  if (!SKU_PREFIX_PATTERN.test(value)) return 'รหัสอ้างอิงชุดใช้ได้เฉพาะตัวอักษรอังกฤษ A–Z และตัวเลข 0–9 (ไม่มีขีดหรือช่องว่าง)'
  return null
}

/** ตัวอย่างรหัสชุดจริงที่จะพิมพ์บนป้าย เช่น NEZUKO-M-01 */
export function previewItemCode(prefix: string, size = 'M'): string {
  return `${prefix || 'NEZUKO'}-${size}-01`
}