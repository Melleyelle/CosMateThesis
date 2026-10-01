import { createClient } from '@/utils/client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB ต้องตรงกับ file_size_limit ของ bucket ที่ตั้งไว้ใน SQL
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type UploadResult = { url: string } | { error: string }

// อัปโหลดรูปหนึ่งไฟล์ไปที่ bucket "product-images" แล้วคืน public URL กลับมา
// ใช้ path แบบ drafts/... ก่อน เพราะตอนนี้ยังไม่มี product_id จริง (ยังไม่ได้กดบันทึกทั้งฟอร์ม)
export async function uploadProductImage(file: File): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB' }
  }

  const supabase = createClient()
  if (!supabase) {
    return { error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }
  }

  const fileExt = file.name.split('.').pop()
  const path = `drafts/${crypto.randomUUID()}.${fileExt}`

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) {
    return { error: error.message }
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return { url: data.publicUrl }
}