import { createClient } from '@/utils/client'

// ข้อมูล "บัญชีของฉัน": โปรไฟล์ + ที่อยู่หลัก + บัญชีธนาคารรับเงินคืน (ถาวร ใช้เติมหน้าชำระเงินอัตโนมัติ)

export const BANKS = [
  'พร้อมเพย์ (เบอร์โทร/เลขบัตรประชาชน)',
  'กสิกรไทย',
  'ไทยพาณิชย์',
  'กรุงเทพ',
  'กรุงไทย',
  'กรุงศรีอยุธยา',
  'ทหารไทยธนชาต (ttb)',
  'ออมสิน',
  'ธ.ก.ส.',
  'ยูโอบี',
  'ซีไอเอ็มบี ไทย',
  'เกียรตินาคินภัทร',
  'แลนด์ แอนด์ เฮ้าส์',
]

export type BankAccount = { accountName: string; bank: string; accountNumber: string }
export type Profile = { email: string; firstName: string; lastName: string; phone: string; avatarUrl: string | null }
export type Address = {
  name: string
  phone: string
  line: string
  subdistrict: string
  district: string
  province: string
  postalCode: string
}

export const EMPTY_ADDRESS: Address = { name: '', phone: '', line: '', subdistrict: '', district: '', province: '', postalCode: '' }
export const EMPTY_BANK: BankAccount = { accountName: '', bank: '', accountNumber: '' }

export const onlyDigits = (s: string) => s.replace(/[^0-9]/g, '')

export function maskAccount(n: string) {
  const d = onlyDigits(n)
  return d.length <= 4 ? d : `${'x'.repeat(d.length - 4)}${d.slice(-4)}`
}

export function addressProblem(a: Address): string | null {
  if (!a.name.trim() || !a.line.trim() || !a.province.trim()) return 'กรอกชื่อผู้รับ ที่อยู่ และจังหวัดให้ครบ'
  if (!/^0\d{8,9}$/.test(a.phone)) return 'เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0'
  if (!/^\d{5}$/.test(a.postalCode)) return 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'
  return null
}

export function bankProblem(b: BankAccount): string | null {
  if (!b.accountName.trim() || !b.bank) return 'กรอกชื่อเจ้าของบัญชีและเลือกธนาคารให้ครบ'
  const n = onlyDigits(b.accountNumber).length
  if (n < 10 || n > 15) return 'เลขบัญชี/พร้อมเพย์ต้องเป็นตัวเลข 10–15 หลัก'
  return null
}

async function currentUserId() {
  const supabase = createClient()
  if (!supabase) return { supabase: null, userId: null }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, userId: user?.id ?? null, email: user?.email ?? '' }
}

export type SavedAddress = Address & { id: string; isDefault: boolean }
export type SavedBankAccount = BankAccount & { id: string; isDefault: boolean }

const ADDRESS_COLUMNS = 'id, is_default, recipient_name, recipient_phone, address_line, subdistrict, district, province, postal_code'

export async function fetchMyAccount(): Promise<{
  profile: Profile | null
  addresses: SavedAddress[]
  banks: SavedBankAccount[]
  error: string | null
}> {
  const { supabase, userId, email } = await currentUserId()
  if (!supabase || !userId) return { profile: null, addresses: [], banks: [], error: 'กรุณาเข้าสู่ระบบ' }

  const [p, av, a, b] = await Promise.all([
    supabase.from('profiles').select('email, first_name, last_name, phone').eq('id', userId).maybeSingle(),
    // แยก query เพราะถ้ายังไม่ได้รัน Step 14 คอลัมน์ avatar_url ยังไม่มี → ถือว่ายังไม่มีรูป หน้าไม่พัง
    supabase.from('profiles').select('avatar_url').eq('id', userId).maybeSingle(),
    supabase
      .from('user_addresses')
      .select(ADDRESS_COLUMNS)
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('id'),
    // ต้องรัน Step 15 ก่อน (มี id / is_default) — ถ้ายังไม่รันถือว่ายังไม่มีบัญชี
    supabase
      .from('user_bank_accounts')
      .select('id, is_default, account_name, bank, account_number')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('id'),
  ])

  return {
    profile: p.data
      ? {
          email: p.data.email ?? email ?? '',
          firstName: p.data.first_name ?? '',
          lastName: p.data.last_name ?? '',
          phone: p.data.phone ?? '',
          avatarUrl: (!av.error && av.data?.avatar_url) || null,
        }
      : null,
    addresses: (a.data ?? []).map((r) => ({
      id: String(r.id),
      isDefault: !!r.is_default,
      name: r.recipient_name ?? '',
      phone: onlyDigits(r.recipient_phone ?? ''),
      line: r.address_line ?? '',
      subdistrict: r.subdistrict ?? '',
      district: r.district ?? '',
      province: r.province ?? '',
      postalCode: r.postal_code ?? '',
    })),
    banks: b.error
      ? []
      : (b.data ?? []).map((r) => ({
          id: String(r.id),
          isDefault: !!r.is_default,
          accountName: r.account_name,
          bank: r.bank,
          accountNumber: r.account_number,
        })),
    error: p.error?.message ?? null,
  }
}
export async function saveMyProfile(p: Pick<Profile, 'firstName' | 'lastName' | 'phone'>): Promise<string | null> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  const { error } = await supabase
    .from('profiles')
    .update({ first_name: p.firstName.trim(), last_name: p.lastName.trim(), phone: onlyDigits(p.phone) })
    .eq('id', userId)
  return error?.message ?? null
}

export const AVATAR_MAX_SIZE = 2 * 1024 * 1024 // ต้องตรงกับ file_size_limit ของ bucket avatars
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// อัปโหลดรูปโปรไฟล์ไปที่ avatars/<user id>/avatar.<นามสกุล> (ทับรูปเดิม) แล้วบันทึก url ลง profiles
export async function uploadMyAvatar(file: File): Promise<{ url: string } | { error: string }> {
  if (!AVATAR_TYPES.includes(file.type)) return { error: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP' }
  if (file.size > AVATAR_MAX_SIZE) return { error: 'ไฟล์ต้องมีขนาดไม่เกิน 2 MB' }

  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return { error: 'กรุณาเข้าสู่ระบบ' }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${userId}/avatar.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { cacheControl: '3600', upsert: true })
  if (uploadError) {
    return { error: /bucket not found/i.test(uploadError.message) ? 'ระบบยังไม่พร้อมอัปโหลดรูป (ยังไม่ได้รัน SQL Step 14)' : uploadError.message }
  }

  // ลบรูปเดิมที่เป็นนามสกุลอื่น (เช่นเคยอัป .png แล้วเปลี่ยนเป็น .jpg) ไม่ให้ค้างใน bucket
  await supabase.storage
    .from('avatars')
    .remove(['jpg', 'png', 'webp'].filter((e) => e !== ext).map((e) => `${userId}/avatar.${e}`))

  // ชื่อไฟล์เดิมทุกครั้ง จึงต่อ ?v= ให้เบราว์เซอร์/CDN ดึงรูปใหม่แทนรูปที่แคชไว้
  const url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
  if (error) return { error: error.message.includes('avatar_url') ? 'ระบบยังไม่พร้อมอัปโหลดรูป' : error.message }
  return { url }
}

export async function removeMyAvatar(): Promise<string | null> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  await supabase.storage
    .from('avatars')
    .remove(['jpg', 'png', 'webp'].map((ext) => `${userId}/avatar.${ext}`))
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
  return error?.message ?? null
}

function addressPayload(a: Address) {
  return {
    recipient_name: a.name.trim(),
    recipient_phone: a.phone,
    address_line: a.line.trim(),
    subdistrict: a.subdistrict.trim() || null,
    district: a.district.trim() || null,
    province: a.province.trim(),
    postal_code: a.postalCode,
  }
}

function bankPayload(b: BankAccount) {
  return { account_name: b.accountName.trim(), bank: b.bank, account_number: onlyDigits(b.accountNumber) }
}

// ข้อความ error ของตารางบัญชีธนาคารตอนยังไม่ได้รัน Step 15 (ยังไม่มีคอลัมน์ id / is_default)
function bankError(message: string) {
  return /is_default|column "?id"? |user_bank_accounts.* does not exist/.test(message) ?'ระบบยังไม่พร้อมบันทึกหลายบัญชี (ยังไม่ได้รัน SQL Step 15)' : message
}

// ตั้งค่าเริ่มต้น: ปลดอันเดิมก่อนแล้วค่อยตั้งอันใหม่ (มี unique index ให้ค่าเริ่มต้นได้อันเดียวต่อคน)
async function setDefault(table: 'user_addresses' | 'user_bank_accounts', id: string): Promise<string | null> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  const unset = await supabase.from(table).update({ is_default: false }).eq('user_id', userId).eq('is_default', true).neq('id', id)
  if (unset.error) return unset.error.message
  const { error } = await supabase.from(table).update({ is_default: true }).eq('id', id).eq('user_id', userId)
  return error?.message ?? null
}

// เพิ่มรายการใหม่ — ถ้ายังไม่มีรายการไหนเลยให้เป็นค่าเริ่มต้นทันที
async function insertItem(
  table: 'user_addresses' | 'user_bank_accounts',
  payload: Record<string, unknown>,
): Promise<{ id: string } | { error: string }> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return { error: 'กรุณาเข้าสู่ระบบ' }
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const { data, error } = await supabase
    .from(table)
    .insert({ ...payload, user_id: userId, is_default: !count })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: String(data.id) }
}

// ---------- ที่อยู่ ----------

export async function saveAddress(a: Address, id: string | null): Promise<string | null> {
  if (!id) {
    const res = await insertItem('user_addresses', { ...addressPayload(a), label: 'ที่อยู่' })
    return 'error' in res ? res.error : null
  }
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  const { error } = await supabase.from('user_addresses').update(addressPayload(a)).eq('id', id).eq('user_id', userId)
  return error?.message ?? null
}

export async function deleteAddress(id: string): Promise<string | null> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  const { error } = await supabase.from('user_addresses').delete().eq('id', id).eq('user_id', userId)
  return error?.message ?? null
}

export const setDefaultAddress = (id: string) => setDefault('user_addresses', id)

// ใช้ในหน้าชำระเงิน: แก้ที่อยู่ค่าเริ่มต้นเดิม หรือเพิ่มใหม่เป็นค่าเริ่มต้นถ้ายังไม่มี
export async function saveDefaultAddress(a: Address): Promise<string | null> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  const { data: existing } = await supabase
    .from('user_addresses')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()
  if (existing) return saveAddress(a, String(existing.id))
  const res = await insertItem('user_addresses', { ...addressPayload(a), label: 'ที่อยู่' })
  if ('error' in res) return res.error
  return setDefaultAddress(res.id)
}

// ---------- บัญชีธนาคาร ----------

export async function saveBankAccount(b: BankAccount, id: string | null): Promise<string | null> {
  if (!id) {
    const res = await insertItem('user_bank_accounts', bankPayload(b))
    return 'error' in res ? bankError(res.error) : null
  }
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  const { error } = await supabase
    .from('user_bank_accounts')
    .update({ ...bankPayload(b), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  return error ? bankError(error.message) : null
}

export async function deleteBankAccount(id: string): Promise<string | null> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  const { error } = await supabase.from('user_bank_accounts').delete().eq('id', id).eq('user_id', userId)
  return error ? bankError(error.message) : null
}

export const setDefaultBankAccount = async (id: string) => {
  const err = await setDefault('user_bank_accounts', id)
  return err ? bankError(err) : null
}

// ใช้ในหน้าชำระเงิน: เพิ่มบัญชีที่กรอกตอนจองเป็นบัญชีใหม่ และตั้งเป็นค่าเริ่มต้น
export async function saveMyBankAccount(b: BankAccount): Promise<string | null> {
  const res = await insertItem('user_bank_accounts', bankPayload(b))
  if ('error' in res) return bankError(res.error)
  return setDefaultBankAccount(res.id)
}