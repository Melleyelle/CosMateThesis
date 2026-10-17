// POST /api/orders/[id]/slip   body: { path: "<user_id>/<order_id>/<ไฟล์>" }
// ลำดับ: ลูกค้าอัปโหลดสลิปเข้า bucket payment-slips เอง → เรียก route นี้
//        → ตรวจตามโหมดใน app_settings → confirm_payment() ด้วยสิทธิ์ service role
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySlip, type ShopReceiver, type VerifyMode } from '@/lib/slip/verifySlip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  PAID: 'ชำระเงินสำเร็จ ร้านจะเริ่มแพ็กชุดตามวันที่ต้องส่ง',
  MANUAL_REVIEW: 'ได้รับสลิปแล้ว ร้านกำลังตรวจสอบ',
  REJECTED_DUPLICATE: 'สลิปนี้เคยถูกใช้แล้ว กรุณาแนบสลิปของการโอนครั้งนี้',
  REJECTED_UNREADABLE: 'อ่านสลิปไม่ได้ กรุณาแนบรูปสลิปที่เห็น QR ชัดเจน',
  EXPIRED_REFUND: 'ออเดอร์หมดเวลาชำระแล้ว ร้านจะโอนเงินคืนเต็มจำนวน',
  ORDER_NOT_PAYABLE: 'ออเดอร์นี้ไม่อยู่ในสถานะรอชำระ กรุณาติดต่อร้านทาง LINE',
};

function fail(code: string, status: number) {
  return NextResponse.json({ error: code, message: MESSAGES[code] ?? code }, { status });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;

  // 1) ต้องล็อกอิน
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('NOT_AUTHENTICATED', 401);

  // 2) path ต้องอยู่ในโฟลเดอร์ของผู้ใช้และออเดอร์นี้ (กันส่ง path ของคนอื่นมา)
  const body = (await req.json().catch(() => null)) as { path?: unknown } | null;
  const slipPath = typeof body?.path === 'string' ? body.path : '';
  if (!slipPath.startsWith(`${user.id}/${orderId}/`) || slipPath.includes('..')) {
    return fail('INVALID_PATH', 400);
  }

  // 3) อ่านออเดอร์ด้วยสิทธิ์ลูกค้า — RLS ทำให้เห็นเฉพาะออเดอร์ของตัวเอง
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, grand_total, created_at')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return fail('ORDER_NOT_FOUND', 404);
  if (!['pending_payment', 'expired', 'cancelled'].includes(order.status)) {
    return fail('ORDER_NOT_PAYABLE', 409);
  }

  // จากตรงนี้ใช้สิทธิ์ service role (เช็กความเป็นเจ้าของครบแล้ว)
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from('app_settings')
    .select('key, value')
    .in('key', ['slip_verify_mode', 'shop_receiver_account']);
  const setting = (k: string) => settings?.find((s) => s.key === k)?.value;
  const rawMode = setting('slip_verify_mode');
  const mode: VerifyMode = rawMode === 'mock' || rawMode === 'slip2go' ? rawMode : 'manual';

  const { data: file, error: dlErr } = await admin.storage.from('payment-slips').download(slipPath);
  if (dlErr || !file) return fail('SLIP_NOT_FOUND', 400);

  // 4) ตรวจสลิป (ไม่โยน error — API ล่มจะได้ outcome = api_error)
  const check = await verifySlip(mode, {
    file,
    slipPath,
    expectedAmount: Number(order.grand_total),
    orderCreatedAt: order.created_at,
    receiver: (setting('shop_receiver_account') as ShopReceiver | undefined) ?? null,
  });

  // 5) ให้ฐานข้อมูลตัดสินขั้นสุดท้าย (สลิปซ้ำ / สถานะ / หมดอายุ)
  const { data: result, error: rpcErr } = await admin.rpc('confirm_payment', {
    p_order_id: orderId,
    p_outcome: check.outcome,
    p_slip_path: slipPath,
    p_trans_ref: check.transRef,
    p_amount: check.amount,
    p_raw: { mode, note: check.note ?? null, provider: check.raw ?? null },
    p_note: check.note ?? null,
  });

  if (rpcErr) {
    const code = ['ORDER_NOT_PAYABLE', 'ORDER_NOT_FOUND'].find((c) => rpcErr.message.includes(c));
    if (code) return fail(code, code === 'ORDER_NOT_FOUND' ? 404 : 409);
    console.error('confirm_payment failed', rpcErr);
    return fail('SERVER_ERROR', 500);
  }

  const resultCode = String(result);
  const ok = resultCode === 'PAID' || resultCode === 'MANUAL_REVIEW' || resultCode === 'EXPIRED_REFUND';
  return NextResponse.json(
    { result: resultCode, message: MESSAGES[resultCode] ?? resultCode },
    { status: ok ? 200 : 422 },
  );
}
