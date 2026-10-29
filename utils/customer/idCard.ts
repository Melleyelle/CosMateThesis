import { createClient } from '@/utils/client'
import { translateRpcError } from '@/utils/bookingErrors'

// รูปบัตรประชาชนสำหรับเช่าครั้งแรก (SQL Step 25 · docs/deposit-pricing-spec.md ข้อ 6)
// เก็บแค่รูปใน bucket id-cards แบบส่วนตัว ไม่เก็บเลขบัตร · สถานะอยู่ที่ customer_id_cards (ลูกค้าอ่านได้เฉพาะของตัวเอง)

export type IdCardStatus = 'none' | 'pending' | 'verified' | 'rejected'

export type MyIdCard = {
  status: IdCardStatus
  submittedAt: string | null
  verifiedAt: string | null
  rejectReason: string | null
}

export const NO_ID_CARD: MyIdCard = { status: 'none', submittedAt: null, verifiedAt: null, rejectReason: null }

export const ID_CARD_MAX_SIZE = 3 * 1024 * 1024 // ต้องตรงกับ file_size_limit ของ bucket id-cards (หลังย่อรูป)

// ข้อความที่ลูกค้าเขียนกำกับบนสำเนาบัตร
export const ID_CARD_WATERMARK = 'ใช้สำหรับเช่าชุดร้าน CosMate เท่านั้น'

// ออเดอร์ awaiting_id = ลูกค้ายังไม่ verified · ใช้เลือกข้อความ/ปุ่มในหน้าชำระเงิน
export const canBook = (s: IdCardStatus) => s === 'pending' || s === 'verified'

export async function fetchMyIdCard(): Promise<{ data: MyIdCard; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: NO_ID_CARD, error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: NO_ID_CARD, error: 'กรุณาเข้าสู่ระบบ' }

  const { data, error } = await supabase
    .from('customer_id_cards')
    .select('status, submitted_at, verified_at, reject_reason')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    return {
      data: NO_ID_CARD,
      error: error.message.includes('customer_id_cards') ? 'ระบบยังไม่พร้อมรับรูปบัตร (ยังไม่ได้รัน SQL Step 25)' : error.message,
    }
  }
  if (!data) return { data: NO_ID_CARD, error: null }
  return {
    data: {
      status: data.status as IdCardStatus,
      submittedAt: data.submitted_at,
      verifiedAt: data.verified_at,
      rejectReason: data.reject_reason,
    },
    error: null,
  }
}

// ย่อรูปฝั่งเบราว์เซอร์เป็น JPEG ด้านยาวไม่เกิน 1600px — ตัวหนังสือบนบัตรยังอ่านได้ ไฟล์เหลือไม่กี่ร้อย KB
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85),
  )
}

export function idCardFileProblem(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'กรุณาเลือกไฟล์รูปภาพ'
  if (file.size > 15 * 1024 * 1024) return 'ไฟล์ใหญ่เกิน 15 MB'
  return null
}

// อัปโหลดไปที่ id-cards/<user id>/id-card.jpg (ทับรูปเดิม) แล้วส่งให้ร้านตรวจ
export async function submitMyIdCard(file: File, consent: boolean): Promise<string | null> {
  if (!consent) return 'กรุณากดยินยอมให้ร้านเก็บรูปบัตรก่อน'
  const problem = idCardFileProblem(file)
  if (problem) return problem

  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'กรุณาเข้าสู่ระบบ'

  let blob: Blob
  try {
    blob = await toJpeg(file)
  } catch {
    return 'เปิดรูปนี้ไม่ได้ ลองถ่ายใหม่หรือเลือกไฟล์ JPG/PNG'
  }
  if (blob.size > ID_CARD_MAX_SIZE) return 'รูปใหญ่เกินไป ลองถ่ายใหม่ให้เห็นแค่บัตร'

  const { error: uploadError } = await supabase.storage
    .from('id-cards')
    .upload(`${user.id}/id-card.jpg`, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '0' })
  if (uploadError) {
    return /bucket not found/i.test(uploadError.message)
      ? 'ระบบยังไม่พร้อมรับรูปบัตร (ยังไม่ได้รัน SQL Step 25)'
      : /row-level security|policy/i.test(uploadError.message)
        ? 'บัญชีนี้ส่งรูปบัตรใหม่ไม่ได้ (ยืนยันตัวตนแล้ว หรือถูกจำกัดการใช้งาน)'
        : `อัปโหลดไม่สำเร็จ: ${uploadError.message}`
  }

  const { error } = await supabase.rpc('submit_my_id_card', { p_consent: true })
  return error ? translateRpcError(error.message) : null
}

// ลูกค้าขอลบรูปบัตร — ลบไฟล์ฝั่งเซิร์ฟเวอร์ (ลูกค้าลบไฟล์ใน bucket เองไม่ได้)
export async function deleteMyIdCard(): Promise<string | null> {
  const res = await fetch('/api/id-card', { method: 'DELETE' })
  if (res.ok) return null
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  return translateRpcError(json.error ?? 'SERVER_ERROR')
}
