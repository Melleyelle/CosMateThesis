// GET /api/orders/[id]/promptpay → { payload, amount, accountName }
// สร้าง QR พร้อมเพย์ฝังยอดของออเดอร์ ยอดอ่านจากฐานข้อมูล (ไม่เชื่อค่าจากฝั่งลูกค้า)
// ตั้งค่าที่ app_settings.shop_receiver_account:
//   { "account_type": "02001", "account_number": "08xxxxxxxx", "account_name": "..." }
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { promptPayPayload } from '@/lib/promptpay';
import type { ShopReceiver } from '@/lib/slip/verifySlip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });

  // RLS ทำให้เห็นเฉพาะออเดอร์ของตัวเอง
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, grand_total')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  if (order.status !== 'pending_payment') {
    return NextResponse.json({ error: 'ORDER_NOT_PAYABLE' }, { status: 409 });
  }

  const { data: setting } = await createAdminClient()
    .from('app_settings')
    .select('value')
    .eq('key', 'shop_receiver_account')
    .maybeSingle();
  const receiver = (setting?.value as ShopReceiver | undefined) ?? null;

  const amount = Number(order.grand_total);
  const payload =
    receiver?.account_type === '02001' && receiver.account_number
      ? promptPayPayload(receiver.account_number, amount)
      : null;
  if (!payload) return NextResponse.json({ error: 'PROMPTPAY_NOT_CONFIGURED' }, { status: 503 });

  return NextResponse.json({ payload, amount, accountName: receiver?.account_name ?? null });
}
