// Supabase client สิทธิ์ service role — ใช้ใน Route Handler ฝั่งเซิร์ฟเวอร์เท่านั้น
// ข้าม RLS ทั้งหมด จึงต้องเช็กสิทธิ์ผู้เรียกเองก่อนใช้ทุกครั้ง
// env: SUPABASE_SERVICE_ROLE_KEY (ห้ามขึ้นต้น NEXT_PUBLIC_)
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
