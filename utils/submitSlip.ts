// ฝั่งลูกค้า: อัปโหลดสลิปเข้า bucket แล้วให้เซิร์ฟเวอร์ตรวจ
// ใช้ในหน้า /orders/[id] แทนปุ่ม submit_payment_mock เดิม
import type { SupabaseClient } from '@supabase/supabase-js';

export type SlipResult =
  | 'PAID'
  | 'MANUAL_REVIEW'
  | 'EXPIRED_REFUND'
  | 'REJECTED_DUPLICATE'
  | 'REJECTED_UNREADABLE'
  | string;

export async function submitSlip(
  supabase: SupabaseClient,
  orderId: string,
  file: File,
): Promise<{ ok: boolean; result: SlipResult; message: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, result: 'NOT_AUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' };

  // เก็บชื่อไฟล์เดิมไว้ในชื่อ (ตัดอักขระพิเศษ) — โหมด mock ใช้ชื่อไฟล์เลือกผลทดสอบ
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-40);
  const path = `${user.id}/${orderId}/${Date.now()}-${safe}`;

  const { error: upErr } = await supabase.storage
    .from('payment-slips')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, result: 'UPLOAD_FAILED', message: 'อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่' };

  const res = await fetch(`/api/orders/${orderId}/slip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  const json = (await res.json().catch(() => ({}))) as { result?: string; error?: string; message?: string };
  return {
    ok: res.ok,
    result: json.result ?? json.error ?? 'SERVER_ERROR',
    message: json.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่',
  };
}
