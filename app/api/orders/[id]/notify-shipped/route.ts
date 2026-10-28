// POST /api/orders/[id]/notify-shipped → ส่งอีเมลแจ้งลูกค้าว่าจัดส่งชุดแล้ว
// แอดมินเรียกหลัง admin_ship_order() สำเร็จ · เช็กสิทธิ์แอดมินด้วย session ก่อน แล้วค่อยใช้ service role อ่านอีเมลลูกค้า
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/mail/mailer';
import { shippedEmail } from '@/lib/mail/shippedEmail';
import { formatThaiDateLong } from '@/utils/dateUtils';
import { shipCarrierName } from '@/utils/tracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  user_id: string;
  order_number: string;
  status: string;
  ship_name: string | null;
  ship_carrier: string | null;
  ship_tracking_no: string | null;
  order_items: { end_date: string; product_variants: { products: { name: string } | null } | null }[] | null;
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;

  // 1) ต้องเป็นแอดมิน
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  // 2) ออเดอร์ต้องอยู่ในสถานะจัดส่งแล้ว และมีเลขพัสดุ
  const admin = createAdminClient();
  const { data } = await admin
    .from('orders')
    .select('id, user_id, order_number, status, ship_name, ship_carrier, ship_tracking_no, order_items ( end_date, product_variants ( products ( name ) ) )')
    .eq('id', orderId)
    .maybeSingle();
  const order = data as unknown as OrderRow | null;
  if (!order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  if (order.status !== 'shipped' || !order.ship_tracking_no) {
    return NextResponse.json({ error: 'ORDER_NOT_SHIPPED' }, { status: 409 });
  }

  // 3) อีเมลลูกค้าจากบัญชีที่ใช้ล็อกอิน
  const { data: customer } = await admin.auth.admin.getUserById(order.user_id);
  const to = customer?.user?.email;
  if (!to) return NextResponse.json({ error: 'NO_CUSTOMER_EMAIL' }, { status: 422 });

  const items = order.order_items ?? [];
  const returnBy = items.map((i) => i.end_date).sort().slice(-1)[0] ?? null;
  const mail = shippedEmail({
    customerName: order.ship_name ?? 'ลูกค้า',
    orderNumber: order.order_number,
    orderId: order.id,
    carrierName: shipCarrierName(order.ship_carrier),
    trackingNo: order.ship_tracking_no,
    productNames: [...new Set(items.map((i) => i.product_variants?.products?.name).filter((n): n is string => !!n))],
    returnBy: returnBy ? formatThaiDateLong(returnBy) : null,
  });

  // 4) ส่งเมล
  try {
    await sendMail({ to, ...mail });
  } catch (e) {
    console.error('notify-shipped: send failed', e);
    return NextResponse.json({ error: 'SEND_FAILED' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
