// POST /api/orders/[id]/notify-inspected → ส่งอีเมลผลตรวจสภาพชุด / การหักมัดจำ
// แอดมินเรียกหลัง admin_receive_and_inspect() สำเร็จ
import { NextResponse } from 'next/server';
import { adminOrError, mailCustomer } from '@/lib/mail/notifyRoute';
import { inspectedEmail } from '@/lib/mail/inspectedEmail';
import { DEDUCTION_LABEL } from '@/utils/admin/orderOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  user_id: string;
  order_number: string;
  status: string;
  ship_name: string | null;
  deposit_total: number | string;
  refund_amount: number | string | null;
  order_items: { product_variants: { deposit_return_hours: number | null } | null }[] | null;
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const admin = await adminOrError();
  if (admin instanceof NextResponse) return admin;

  const [{ data }, { data: dedRows }, { data: shoeRows }] = await Promise.all([
    admin
      .from('orders')
      .select('id, user_id, order_number, status, ship_name, deposit_total, refund_amount, order_items ( product_variants ( deposit_return_hours ) )')
      .eq('id', orderId)
      .maybeSingle(),
    admin.from('order_deductions').select('type, amount, note').eq('order_id', orderId).order('created_at'),
    // ค่ารองเท้าที่หาไม่ได้ (Step 29) แยก query ไว้ ยังไม่ได้รัน SQL = error → ถือว่าไม่มี อีเมลยังส่งได้
    admin.from('order_items').select('shoe_sourcing_amount').eq('order_id', orderId).eq('shoe_sourcing_status', 'refund'),
  ]);
  const order = data as unknown as OrderRow | null;
  if (!order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  // ผ่านการตรวจรับคืนมาแล้ว (ยังไม่ได้ตรวจ = ยังอยู่กับลูกค้า)
  if (!['returned', 'inspecting', 'completed'].includes(order.status)) {
    return NextResponse.json({ error: 'ORDER_NOT_INSPECTED' }, { status: 409 });
  }

  const deductions = (dedRows ?? []) as { type: string; amount: number | string; note: string | null }[];
  const lost = deductions.some((d) => d.type === 'lost');
  const mail = inspectedEmail({
    customerName: order.ship_name ?? 'ลูกค้า',
    orderNumber: order.order_number,
    orderId: order.id,
    deposit: Number(order.deposit_total),
    // สูญหาย: ริบมัดจำทั้งก้อน รายการนี้ไม่มียอดของตัวเอง จึงไม่แสดงเป็นรายการหัก
    deductions: deductions
      .filter((d) => d.type !== 'lost')
      .map((d) => ({ label: DEDUCTION_LABEL[d.type] ?? d.type, note: d.note, amount: Number(d.amount) })),
    refund: Number(order.refund_amount ?? 0),
    shoeRefund: ((shoeRows ?? []) as { shoe_sourcing_amount: number | string | null }[]).reduce(
      (sum, r) => sum + Number(r.shoe_sourcing_amount ?? 0),
      0,
    ),
    lost,
    refundHours: Math.max(72, ...(order.order_items ?? []).map((i) => i.product_variants?.deposit_return_hours ?? 72)),
  });
  return mailCustomer(admin, order.user_id, mail, 'notify-inspected');
}
