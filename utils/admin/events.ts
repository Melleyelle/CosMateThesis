import { createClient } from '@/utils/client'
import { shrinkImage } from '@/utils/shrinkImage'
import {
  EVENT_COLUMNS,
  mapEvent,
  mapPhoto,
  PHOTO_COLUMNS,
  type CosEvent,
  type EventPhoto,
  type EventRow,
  type EventTone,
} from '@/utils/customer/events'

// งานอีเวนต์ฝั่งแอดมิน — เขียนตรงลงตาราง events ผ่าน RLS policy events_admin (is_admin())

export type EventInput = {
  name: string
  startDate: string
  endDate: string
  location: string
  description: string
  coverImageUrl: string | null
  mapUrl: string
  officialUrl: string
  tone: EventTone
  isPublished: boolean
}

export const EMPTY_EVENT_INPUT: EventInput = {
  name: '',
  startDate: '',
  endDate: '',
  location: '',
  description: '',
  coverImageUrl: null,
  mapUrl: '',
  officialUrl: '',
  tone: 'pink',
  isPublished: true,
}

export function toInput(ev: CosEvent): EventInput {
  return {
    name: ev.name,
    startDate: ev.startDate,
    endDate: ev.endDate,
    location: ev.location,
    description: ev.description ?? '',
    coverImageUrl: ev.coverImageUrl,
    mapUrl: ev.mapUrl ?? '',
    officialUrl: ev.officialUrl ?? '',
    tone: ev.tone,
    isPublished: ev.isPublished,
  }
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

// ตรวจฝั่งหน้าเว็บให้ข้อความอ่านง่าย (ฐานข้อมูลตรวจซ้ำด้วย check constraint)
export function validateEvent(v: EventInput): Partial<Record<keyof EventInput, string>> {
  const e: Partial<Record<keyof EventInput, string>> = {}
  if (!v.name.trim()) e.name = 'กรอกชื่องาน'
  else if (v.name.trim().length > 120) e.name = 'ชื่องานยาวได้ไม่เกิน 120 ตัวอักษร'
  if (!v.startDate) e.startDate = 'เลือกวันเริ่มงาน'
  if (!v.endDate) e.endDate = 'เลือกวันสุดท้ายของงาน'
  else if (v.startDate && v.endDate < v.startDate) e.endDate = 'วันสุดท้ายต้องไม่ก่อนวันเริ่มงาน'
  if (!v.location.trim()) e.location = 'กรอกสถานที่จัดงาน'
  if (v.description.length > 2000) e.description = 'รายละเอียดยาวได้ไม่เกิน 2,000 ตัวอักษร'
  if (v.mapUrl.trim() && !isHttpUrl(v.mapUrl.trim())) e.mapUrl = 'ลิงก์ต้องขึ้นต้นด้วย https://'
  if (v.officialUrl.trim() && !isHttpUrl(v.officialUrl.trim())) e.officialUrl = 'ลิงก์ต้องขึ้นต้นด้วย https://'
  return e
}

function toRow(v: EventInput) {
  return {
    name: v.name.trim(),
    start_date: v.startDate,
    end_date: v.endDate,
    location: v.location.trim(),
    description: v.description.trim() || null,
    cover_image_url: v.coverImageUrl,
    map_url: v.mapUrl.trim() || null,
    official_url: v.officialUrl.trim() || null,
    tone: v.tone,
    is_published: v.isPublished,
  }
}

export async function fetchAllEventsForAdmin(): Promise<{ data: CosEvent[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { data, error } = await supabase.from('events').select(EVENT_COLUMNS).order('start_date', { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: (data as EventRow[]).map(mapEvent), error: null }
}

// หน้าแก้ไขงาน — แอดมินเห็นฉบับร่างด้วย · ไม่พบ = event null ไม่ใช่ error
export async function fetchEventForAdmin(id: string): Promise<{ event: CosEvent | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { event: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { data, error } = await supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle()
  if (error) return { event: null, error: error.message }
  return { event: data ? mapEvent(data as EventRow) : null, error: null }
}

export async function saveEvent(id: string | null, v: EventInput): Promise<{ event: CosEvent | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { event: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const row = toRow(v)
  const query = id
    ? supabase.from('events').update(row).eq('id', id)
    : supabase.from('events').insert({ ...row, created_by: (await supabase.auth.getUser()).data.user?.id ?? null })
  const { data, error } = await query.select(EVENT_COLUMNS).single()
  if (error) return { event: null, error: error.message }
  return { event: mapEvent(data as EventRow), error: null }
}

export async function setEventPublished(id: string, isPublished: boolean): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { error } = await supabase.from('events').update({ is_published: isPublished }).eq('id', id)
  return { error: error?.message ?? null }
}

// ลบงาน = ลบยอดคนสนใจและรูปของผู้ใช้ในงานนั้นทั้งหมด (cascade) พร้อมไฟล์รูปใน bucket
export async function deleteEvent(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { data: photos } = await supabase.from('event_photos').select('image_path').eq('event_id', id)
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) return { error: error.message }
  const paths = (photos ?? []).map((p: { image_path: string }) => p.image_path)
  if (paths.length) await supabase.storage.from('event-images').remove(paths)
  return { error: null }
}

// รูปปกงาน → event-images/covers/<สุ่ม>.jpg (ย่อด้านยาว 1920px)
export async function uploadEventCover(file: File): Promise<{ url: string } | { error: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { error: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP' }
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const blob = await shrinkImage(file, 1920)
  if (blob.size > 5 * 1024 * 1024) return { error: 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB' }
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `covers/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('event-images')
    .upload(path, blob, { cacheControl: '3600', upsert: false, contentType: blob.type || file.type })
  if (error) return { error: error.message }
  return { url: supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl }
}

// ---------- รูปจากผู้ใช้ ----------

export async function fetchEventPhotosForAdmin(eventId: string): Promise<EventPhoto[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('event_photos')
    .select(PHOTO_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as Parameters<typeof mapPhoto>[0][]).map(mapPhoto)
}

export async function setPhotoHidden(id: string, isHidden: boolean): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { error } = await supabase.from('event_photos').update({ is_hidden: isHidden }).eq('id', id)
  return { error: error?.message ?? null }
}
