import { createClient } from '@/utils/client'
import type { IdCardStatus } from '@/utils/customer/idCard'

export type Member = {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  avatarUrl: string | null
  status: string | null // active / suspended ...
  trustLevel: string | null // normal / blacklisted ...
  createdAt: string
  lastSignInAt: string | null
  orderCount: number
  lastOrderAt: string | null
  idStatus: IdCardStatus // รูปบัตรประชาชน (Step 25) · ยังไม่ได้รัน SQL = none
}

type Row = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  status: string | null
  trust_level: string | null
  created_at: string
  last_sign_in_at: string | null
  order_count: number | string
  last_order_at: string | null
}

// ใช้ RPC admin_list_members() เพราะวันสมัคร/เข้าใช้ล่าสุดอยู่ใน auth.users ที่หน้าเว็บอ่านตรงไม่ได้
export async function fetchMembers(): Promise<{ data: Member[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const [{ data, error }, cardRes] = await Promise.all([
    supabase.rpc('admin_list_members'),
    supabase.from('customer_id_cards').select('user_id, status'),
  ])
  const idStatus = new Map(
    cardRes.error ? [] : ((cardRes.data ?? []) as { user_id: string; status: IdCardStatus }[]).map((c) => [c.user_id, c.status]),
  )
  if (error) {
    return {
      data: [],
      error: error.message.includes('admin_list_members')
        ? 'ยังไม่ได้รัน SQL สำหรับหน้าสมาชิก (admin_list_members)'
        : error.message,
    }
  }

  return {
    data: ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
      phone: r.phone,
      avatarUrl: r.avatar_url,
      status: r.status,
      trustLevel: r.trust_level,
      createdAt: r.created_at,
      lastSignInAt: r.last_sign_in_at,
      orderCount: Number(r.order_count),
      lastOrderAt: r.last_order_at,
      idStatus: idStatus.get(r.id) ?? 'none',
    })),
    error: null,
  }
}
