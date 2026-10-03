import { addDays, parseISODate, todayISO } from '@/utils/dateUtils'

// งานอีเวนต์ที่แสดงบนปฏิทินจองชุด
// ตอนนี้เป็นข้อมูลตัวอย่าง (mock-up) — เมื่อมีระบบให้แอดมินอัปโหลดงานอีเวนต์
// ให้เปลี่ยน fetchEvents() ไปดึงจากตาราง events ใน Supabase โดยคืนรูปแบบเดียวกัน

export type CalendarEvent = {
  id: string
  name: string
  startDate: string // 'YYYY-MM-DD'
  endDate: string // วันสุดท้ายของงาน (งานวันเดียว = startDate)
  location: string
  tone: 'pink' | 'purple' | 'yellow'
}

export const EVENT_TONE: Record<CalendarEvent['tone'], { dot: string; chip: string }> = {
  pink: { dot: 'bg-[#E5457F]', chip: 'bg-[#FDE3EE] text-[#B8285D]' },
  purple: { dot: 'bg-[#8B6FD6]', chip: 'bg-[#EDE6FA] text-[#5B3FA8]' },
  yellow: { dot: 'bg-[#E5A900]', chip: 'bg-[#FFF3B0] text-[#7A5A00]' },
}

// วันเสาร์ถัดไปนับจากวันนี้ + n สัปดาห์ ให้ข้อมูลตัวอย่างอยู่ในช่วงที่จองได้เสมอ
function saturdayAfter(weeks: number): string {
  const today = todayISO()
  const day = parseISODate(today).getDay()
  return addDays(today, ((6 - day + 7) % 7 || 7) + weeks * 7)
}

function mockEvents(): CalendarEvent[] {
  const fest = saturdayAfter(1)
  const party = saturdayAfter(3)
  const meet = saturdayAfter(5)
  const halloween = saturdayAfter(8)
  return [
    { id: 'mock-1', name: 'Cosplay Fest', startDate: fest, endDate: addDays(fest, 1), location: 'ศูนย์การประชุมกลางเมือง', tone: 'pink' },
    { id: 'mock-2', name: 'Anime Party Night', startDate: party, endDate: party, location: 'ห้างสรรพสินค้าย่านสยาม', tone: 'purple' },
    { id: 'mock-3', name: 'Game Character Meetup', startDate: meet, endDate: meet, location: 'อาคารนิทรรศการ', tone: 'yellow' },
    { id: 'mock-4', name: 'Halloween Costume Walk', startDate: halloween, endDate: addDays(halloween, 1), location: 'ถนนคนเดินริมน้ำ', tone: 'purple' },
  ]
}

export async function fetchEvents(): Promise<{ events: CalendarEvent[] }> {
  return { events: mockEvents() }
}

// รวมงานตามวัน เพื่อให้ปฏิทินเช็กได้เร็วว่าวันไหนมีงาน
export function eventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    for (let d = ev.startDate; d <= ev.endDate; d = addDays(d, 1)) {
      map.set(d, [...(map.get(d) ?? []), ev])
    }
  }
  return map
}
