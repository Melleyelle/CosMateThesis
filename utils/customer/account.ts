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
export type Profile = { email: string; firstName: string; lastName: string; phone: string }
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

export async function fetchMyAccount(): Promise<{
  profile: Profile | null
  address: Address | null
  bank: BankAccount | null
  error: string | null
}> {
  const { supabase, userId, email } = await currentUserId()
  if (!supabase || !userId) return { profile: null, address: null, bank: null, error: 'กรุณาเข้าสู่ระบบ' }

  const [p, a, b] = await Promise.all([
    supabase.from('profiles').select('email, first_name, last_name, phone').eq('id', userId).maybeSingle(),
    supabase
      .from('user_addresses')
      .select('recipient_name, recipient_phone, address_line, subdistrict, district, province, postal_code')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle(),
    supabase.from('user_bank_accounts').select('account_name, bank, account_number').eq('user_id', userId).maybeSingle(),
  ])

  return {
    profile: p.data
      ? {
          email: p.data.email ?? email ?? '',
          firstName: p.data.first_name ?? '',
          lastName: p.data.last_name ?? '',
          phone: p.data.phone ?? '',
        }
      : null,
    address: a.data
      ? {
          name: a.data.recipient_name ?? '',
          phone: onlyDigits(a.data.recipient_phone ?? ''),
          line: a.data.address_line ?? '',
          subdistrict: a.data.subdistrict ?? '',
          district: a.data.district ?? '',
          province: a.data.province ?? '',
          postalCode: a.data.postal_code ?? '',
        }
      : null,
    // ถ้ายังไม่ได้รัน Step 13 ตารางนี้ยังไม่มี → ถือว่ายังไม่มีบัญชี
    bank: !b.error && b.data ? { accountName: b.data.account_name, bank: b.data.bank, accountNumber: b.data.account_number } : null,
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

export async function saveMyBankAccount(b: BankAccount): Promise<string | null> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  const { error } = await supabase.from('user_bank_accounts').upsert({
    user_id: userId,
    account_name: b.accountName.trim(),
    bank: b.bank,
    account_number: onlyDigits(b.accountNumber),
    updated_at: new Date().toISOString(),
  })
  return error?.message ?? null
}

export async function deleteMyBankAccount(): Promise<string | null> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'
  const { error } = await supabase.from('user_bank_accounts').delete().eq('user_id', userId)
  return error?.message ?? null
}

// ที่อยู่หลัก (is_default) — มีได้ 1 ที่ต่อคน
export async function saveDefaultAddress(a: Address): Promise<string | null> {
  const { supabase, userId } = await currentUserId()
  if (!supabase || !userId) return 'กรุณาเข้าสู่ระบบ'

  const payload = {
    recipient_name: a.name.trim(),
    recipient_phone: a.phone,
    address_line: a.line.trim(),
    subdistrict: a.subdistrict.trim() || null,
    district: a.district.trim() || null,
    province: a.province.trim(),
    postal_code: a.postalCode,
  }
  const { data: existing } = await supabase
    .from('user_addresses')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('user_addresses').update(payload).eq('id', existing.id)
    : await supabase.from('user_addresses').insert({ ...payload, user_id: userId, label: 'ที่อยู่หลัก', is_default: true })
  return error?.message ?? null
}
