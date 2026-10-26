import { createClient } from '@/utils/client'
import { addDays, todayISO } from '@/utils/dateUtils'
import { shrinkImage } from '@/utils/shrinkImage'

// งานอีเวนต์คอสเพลย์ (ตาราง events · Step 19) — แอดมินเพิ่มเท่านั้น
// ใช้ชุดเดียวกันทั้ง ปฏิทินจองชุด · section หน้าหลัก · หน้า /events

export type EventTone = 'pink' | 'purple' | 'yellow'

// รูปแบบที่ปฏิทินจองชุดใช้อยู่เดิม — คงชื่อฟิลด์ไว้ BookingCalendar ไม่ต้องแก้
export type CalendarEvent = {
  id: string
  name: string
  startDate: string // 'YYYY-MM-DD'
  endDate: string // วันสุดท้ายของงาน (งานวันเดียว = startDate)
  location: string
  tone: EventTone
}

export type CosEvent = CalendarEvent & {
  description: string | null
  coverImageUrl: string | null
  mapUrl: string | null
  officialUrl: string | null
  interestCount: number
  isPublished: boolean
}

export type EventPhoto = {
  id: string
  eventId: string
  userId: string
  url: string
  path: string
  caption: string | null
  uploaderName: string
  isHidden: boolean
  createdAt: string
}

export const EVENT_TONE: Record<EventTone, { dot: string; chip: string; bg: string; label: string }> = {
  pink: { dot: 'bg-[#E5457F]', chip: 'bg-[#FDE3EE] text-[#B8285D]', bg: 'bg-[#FDE3EE]', label: 'ชมพู' },
  purple: { dot: 'bg-[#8B6FD6]', chip: 'bg-[#EDE6FA] text-[#5B3FA8]', bg: 'bg-[#EDE6FA]', label: 'ม่วง' },
  yellow: { dot: 'bg-[#E5A900]', chip: 'bg-[#FFF3B0] text-[#7A5A00]', bg: 'bg-[#FFF3B0]', label: 'เหลือง' },
}

export const EVENT_COLUMNS =
  'id, name, start_date, end_date, location, description, cover_image_url, map_url, official_url, tone, is_published, interest_count'

export type EventRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  location: string
  description: string | null
  cover_image_url: string | null
  map_url: string | null
  official_url: string | null
  tone: EventTone
  is_published: boolean
  interest_count: number
}

export function mapEvent(r: EventRow): CosEvent {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    location: r.location,
    description: r.description,
    coverImageUrl: r.cover_image_url,
    mapUrl: r.map_url,
    officialUrl: r.official_url,
    tone: r.tone,
    isPublished: r.is_published,
    interestCount: r.interest_count,
  }
}

// งานจบแล้ว = วันสุดท้ายของงานผ่านไปแล้ว (วันสุดท้ายยังนับว่า "กำลังจะมาถึง/กำลังจัด")
export function isEventPast(ev: Pick<CalendarEvent, 'endDate'>, today = todayISO()): boolean {
  return ev.endDate < today
}

export function isEventOngoing(ev: Pick<CalendarEvent, 'startDate' | 'endDate'>, today = todayISO()): boolean {
  return ev.startDate <= today && today <= ev.endDate
}

// ---------- อ่านงาน ----------

// ทุกงานที่เผยแพร่ (RLS กรองฉบับร่างออกให้แล้ว แต่แอดมินจะเห็นด้วย จึงกรองซ้ำ)
export async function fetchEvents(): Promise<{ events: CosEvent[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { events: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('is_published', true)
    .order('start_date', { ascending: true })
  if (error) return { events: [], error: error.message }
  return { events: (data as EventRow[]).map(mapEvent), error: null }
}

export async function fetchEvent(id: string): Promise<{ event: CosEvent | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { event: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { data, error } = await supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle()
  if (error) return { event: null, error: error.message }
  return { event: data ? mapEvent(data as EventRow) : null, error: null }
}

// ---------- ปุ่มสนใจ ----------

// งานที่ผู้ใช้คนนี้กดสนใจไว้ (ใช้แค่แสดงสถานะปุ่ม ไม่ได้แสดงเป็นรายการในหน้าบัญชี)
export async function fetchMyInterests(userId: string | null): Promise<Set<string>> {
  const supabase = createClient()
  if (!supabase || !userId) return new Set()
  const { data } = await supabase.from('event_interests').select('event_id').eq('user_id', userId)
  return new Set((data ?? []).map((r: { event_id: string }) => r.event_id))
}

export async function toggleEventInterest(
  eventId: string,
): Promise<{ interested: boolean; count: number } | { error: string }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { data, error } = await supabase.rpc('toggle_event_interest', { p_event_id: eventId })
  if (error) return { error: eventErrorMessage(error.message) }
  const row = (Array.isArray(data) ? data[0] : data) as { interested: boolean; interest_count: number }
  return { interested: row.interested, count: row.interest_count }
}

// ---------- รูปงานที่ผ่านมา ----------

const BUCKET = 'event-images'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // ตรงกับ file_size_limit ของ bucket event-images
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_PHOTOS_PER_USER = 6 // ตรงกับ submit_event_photo()

export function eventImageUrl(path: string): string {
  const supabase = createClient()
  return supabase ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : ''
}

type PhotoRow = {
  id: string
  event_id: string
  user_id: string
  image_path: string
  caption: string | null
  uploader_name: string
  is_hidden: boolean
  created_at: string
}

export const PHOTO_COLUMNS = 'id, event_id, user_id, image_path, caption, uploader_name, is_hidden, created_at'

export function mapPhoto(r: PhotoRow): EventPhoto {
  return {
    id: r.id,
    eventId: r.event_id,
    userId: r.user_id,
    path: r.image_path,
    url: eventImageUrl(r.image_path),
    caption: r.caption,
    uploaderName: r.uploader_name,
    isHidden: r.is_hidden,
    createdAt: r.created_at,
  }
}

// RLS: คนทั่วไปเห็นรูปที่ไม่ถูกซ่อน · เจ้าของเห็นของตัวเองเสมอ (แม้ถูกซ่อน)
export async function fetchEventPhotos(eventId: string): Promise<EventPhoto[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('event_photos')
    .select(PHOTO_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as PhotoRow[]).map(mapPhoto)
}

// อัปโหลดไฟล์ไป event-images/photos/<user id>/... แล้วบันทึกลงงานผ่าน submit_event_photo()
export async function uploadEventPhoto(args: {
  eventId: string
  file: File
  caption: string
  anonymous: boolean
}): Promise<{ error: string | null }> {
  const { eventId, file, caption, anonymous } = args
  if (!ALLOWED_TYPES.includes(file.type)) return { error: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP' }

  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const blob = await shrinkImage(file)
  if (blob.size > MAX_FILE_SIZE) return { error: 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB' }
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `photos/${user.id}/${crypto.randomUUID()}.${ext}`

  const up = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { cacheControl: '3600', upsert: false, contentType: blob.type || file.type })
  if (up.error) return { error: up.error.message }

  const { error } = await supabase.rpc('submit_event_photo', {
    p_event_id: eventId,
    p_image_path: path,
    p_caption: caption.trim() || null,
    p_anonymous: anonymous,
  })
  if (error) {
    // บันทึกไม่ผ่าน → ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง ไม่ให้ค้างใน bucket
    await supabase.storage.from(BUCKET).remove([path])
    return { error: eventErrorMessage(error.message) }
  }
  return { error: null }
}

export async function deleteMyEventPhoto(photo: EventPhoto): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { error } = await supabase.from('event_photos').delete().eq('id', photo.id)
  if (error) return { error: error.message }
  await supabase.storage.from(BUCKET).remove([photo.path])
  return { error: null }
}

// ---------- ข้อความ error ----------

const ERROR_TEXT: Record<string, string> = {
  NOT_AUTHENTICATED: 'กรุณาเข้าสู่ระบบก่อน',
  EVENT_NOT_FOUND: 'ไม่พบงานนี้ หรืองานถูกซ่อนแล้ว',
  EVENT_ENDED: 'งานนี้จบไปแล้ว กดสนใจไม่ได้',
  EVENT_NOT_ENDED: 'อัปโหลดรูปได้หลังงานจบแล้ว',
  INVALID_PHOTO: 'รูปหรือคำบรรยายไม่ถูกต้อง ลองอัปโหลดใหม่อีกครั้ง',
  PHOTO_LIMIT: `อัปโหลดได้สูงสุด ${MAX_PHOTOS_PER_USER} รูปต่องาน`,
}

export function eventErrorMessage(raw: string): string {
  const code = Object.keys(ERROR_TEXT).find((k) => raw.includes(k))
  return code ? ERROR_TEXT[code] : raw
}

// ---------- ปฏิทิน ----------

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
