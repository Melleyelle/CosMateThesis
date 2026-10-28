// POST /api/orders/[id]/notify-refunded → ส่งอีเมลแจ้งว่าโอนเงินคืนสำเร็จ (คืนมัดจำ หรือคืนเงินออเดอร์ที่ยกเลิก)
// แอดมินเรียกหลัง admin_mark_refund(..., 'transferred') สำเร็จ
import { NextResponse } from 'next/server';
import { adminOrError, mailCustomer } from '@/lib/mail/notifyRoute';
import { refundedEmail } from '@/lib/mail/refundedEmail';
import { maskAccount } from '@/utils/customer/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  user_id: string;
  order_number: string;
  status: string;
  ship_name: string | null;
  refund_status: string | null;
  refund_amount: number | string | null;
  refund_bank: string | null;
  refund_account_number: string | null;
  refunded_at: string | null;
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const admin = await adminOrError();
  if (admin instanceof NextResponse) return admin;

  const { data } = await admin
    .from('orders')
    .select('id, user_id, order_number, status, ship_name, refund_status, refund_amount, refund_bank, refund_account_number, refunded_at')
    .eq('id', orderId)
    .maybeSingle();
  const order = data as OrderRow | null;
  if (!order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  if (order.refund_status !== 'transferred') return NextResponse.json({ error: 'REFUND_NOT_TRANSFERRED' }, { status: 409 });

  const mail = refundedEmail({
    customerName: order.ship_name ?? 'ลูกค้า',
    orderNumber: order.order_number,
    orderId: order.id,
    amount: Number(order.refund_amount ?? 0),
    cancelled: order.status === 'cancelled',
    bank: order.refund_bank,
    accountMasked: order.refund_account_number ? maskAccount(order.refund_account_number) : null,
    // เซิร์ฟเวอร์อยู่ UTC → ระบุเขตเวลาไทยเอง
    transferredAt: order.refunded_at
      ? new Date(order.refunded_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })
      : null,
  });
  return mailCustomer(admin, order.user_id, mail, 'notify-refunded');
}
