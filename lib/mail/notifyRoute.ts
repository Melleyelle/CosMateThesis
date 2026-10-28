// ส่วนที่ใช้ร่วมกันของ route แจ้งลูกค้าทางอีเมล (POST /api/orders/[id]/notify-*)
// เช็กสิทธิ์แอดมินด้วย session ก่อน แล้วค่อยใช้ service role อ่านข้อมูลออเดอร์และอีเมลลูกค้า
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/mail/mailer';

// คืน admin client ถ้าผู้เรียกเป็นแอดมิน ไม่งั้นคืน response error
export async function adminOrError(): Promise<SupabaseClient | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  return createAdminClient();
}

// อีเมลลูกค้าจากบัญชีที่ใช้ล็อกอิน แล้วส่ง · คืน response ตอบกลับแอดมิน
export async function mailCustomer(
  admin: SupabaseClient,
  userId: string,
  mail: { subject: string; html: string; text: string },
  tag: string,
): Promise<NextResponse> {
  const { data: customer } = await admin.auth.admin.getUserById(userId);
  const to = customer?.user?.email;
  if (!to) return NextResponse.json({ error: 'NO_CUSTOMER_EMAIL' }, { status: 422 });
  try {
    await sendMail({ to, ...mail });
  } catch (e) {
    console.error(`${tag}: send failed`, e);
    return NextResponse.json({ error: 'SEND_FAILED' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
