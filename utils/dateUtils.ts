// วันที่ทั้งระบบใช้รูปแบบ 'YYYY-MM-DD' ให้ตรงกับคอลัมน์ date ใน Postgres
// และคิดตามเวลาเครื่องผู้ใช้ (ลูกค้าอยู่ไทย = เวลาไทย) — ฝั่งเซิร์ฟเวอร์ตรวจซ้ำด้วยเวลา Asia/Bangkok เสมอ

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function isISODate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

// เช่น "3 ต.ค." หรือ "3 ต.ค. 2569"
export function formatThaiDate(iso: string, withYear = false): string {
  return parseISODate(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

// เช่น "ศ. 3 ต.ค."
export function formatThaiDateWithWeekday(iso: string): string {
  return parseISODate(iso).toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// เช่น "20 สิงหาคม 2569"
export function formatThaiDateLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatBaht(value: number | string | null | undefined): string {
  const n = Number(value ?? 0)
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`
}
