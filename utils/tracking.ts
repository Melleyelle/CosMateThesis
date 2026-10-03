// เลขพัสดุ: ร้านส่งออกด้วยไปรษณีย์ไทย (EMS) ส่วนลูกค้าส่งคืนด้วยขนส่งไหนก็ได้
export const SHIP_CARRIER = 'ไปรษณีย์ไทย (EMS)'

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
