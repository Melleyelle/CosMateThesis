// เลขพัสดุ: ร้านส่งออกด้วยขนส่งที่ลูกค้าเลือกตอนสั่ง (Step 20) ส่วนลูกค้าส่งคืนด้วยขนส่งไหนก็ได้
// รหัสตรงกับ orders.ship_carrier และ key ใน app_settings.ship_carrier_fees
export const SHIP_CARRIERS = [
  { code: 'ems', name: 'ไปรษณีย์ไทย (EMS)' },
  { code: 'kerry', name: 'Kerry Express' },
  { code: 'flash', name: 'Flash Express' },
  { code: 'jt', name: 'J&T Express' },
] as const

export type ShipCarrier = (typeof SHIP_CARRIERS)[number]['code']

export function isShipCarrier(value: unknown): value is ShipCarrier {
  return SHIP_CARRIERS.some((c) => c.code === value)
}

// ออเดอร์ก่อน Step 20 ไม่มีรหัสขนส่ง = ส่ง EMS
export function shipCarrierName(code: string | null): string {
  return SHIP_CARRIERS.find((c) => c.code === code)?.name ?? SHIP_CARRIERS[0].name
}

export const RETURN_CARRIERS = ['ไปรษณีย์ไทย', 'Kerry Express', 'Flash Express', 'J&T Express', 'อื่น ๆ'] as const

// ตัดช่องว่าง/ขีด แปลงเป็นตัวพิมพ์ใหญ่ ให้ตรงกับที่ฐานข้อมูลเก็บ
export function normalizeTracking(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase()
}

export function trackingProblem(raw: string): string | null {
  const t = normalizeTracking(raw)
  if (!t) return 'กรุณากรอกเลขพัสดุ'
  if (!/^[A-Z0-9]{8,30}$/.test(t)) return 'เลขพัสดุต้องเป็นตัวอักษรอังกฤษหรือตัวเลข 8–30 ตัว'
  return null
}

// ลิงก์ติดตามพัสดุ มีเฉพาะไปรษณีย์ไทย (ขนส่งอื่นให้ลูกค้า/แอดมินคัดลอกเลขไปเช็กเอง)
export function trackingUrl(carrier: string | null, trackingNo: string): string | null {
  if (!carrier || !carrier.startsWith('ไปรษณีย์ไทย')) return null
  return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(trackingNo)}`
}
