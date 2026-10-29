// จัดการบัญชีสมาชิกจากหน้าแอดมิน (Step 27) — ระงับ / แบล็กลิสต์ / เปิดใช้งาน · โน้ตภายในร้าน
import { createClient } from '@/utils/client'
import type { Member } from '@/utils/admin/fetchMembers'

export type AccessAction = 'suspend' | 'blacklist' | 'reactivate'

export const ACCESS_ACTION_LABEL: Record<AccessAction, string> = {
  suspend: 'ระงับชั่วคราว',
  blacklist: 'แบล็กลิสต์',
  reactivate: 'เปิดใช้งาน',
}

export type AccessLog = { id: number; action: AccessAction; reason: string; adminId: string | null; at: string }
export type MemberNote = { note: string; updatedAt: string; updatedBy: string | null }

export const isBlacklisted = (m: Pick<Member, 'trustLevel'>) => m.trustLevel === 'blacklisted'
export const isSuspended = (m: Pick<Member, 'status'>) => !!m.status && m.status !== 'active'

// โน้ต + ประวัติ · ยังไม่ได้รัน Step 27 = ไม่มีตาราง → คืน missing ให้หน้าเว็บบอกแอดมิน
export async function fetchMemberAdminData(
  userId: string,
): Promise<{ note: MemberNote | null; log: AccessLog[]; missing: boolean; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { note: null, log: [], missing: false, error: 'Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค' }

  const [noteRes, logRes] = await Promise.all([
    supabase.from('member_notes').select('note, updated_at, updated_by').eq('user_id', userId).maybeSingle(),
    supabase
      .from('member_access_log')
      .select('id, action, reason, admin_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])
  const err = noteRes.error ?? logRes.error
  if (err) {
    const missing = err.message.includes('member_notes') || err.message.includes('member_access_log')
    return { note: null, log: [], missing, error: missing ? null : err.message }
  }

  type LogRow = { id: number; action: AccessAction; reason: string; admin_id: string | null; created_at: string }
  return {
    note: noteRes.data ? { note: noteRes.data.note, updatedAt: noteRes.data.updated_at, updatedBy: noteRes.data.updated_by } : null,
    log: ((logRes.data ?? []) as LogRow[]).map((r) => ({ id: r.id, action: r.action, reason: r.reason, adminId: r.admin_id, at: r.created_at })),
    missing: false,
    error: null,
  }
}

export async function setMemberAccess(userId: string, action: AccessAction, reason: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { error } = await supabase.rpc('admin_set_member_access', { p_user_id: userId, p_action: action, p_reason: reason })
  return { error: error?.message ?? null }
}

export async function setMemberNote(userId: string, note: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { error } = await supabase.rpc('admin_set_member_note', { p_user_id: userId, p_note: note })
  return { error: error?.message ?? null }
}
