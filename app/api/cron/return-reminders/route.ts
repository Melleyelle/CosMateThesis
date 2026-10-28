// GET /api/cron/return-reminders → ส่งอีเมลเตือนลูกค้าก่อนครบกำหนดส่งคืนชุด (Vercel Cron เรียกทุกเช้า ดู vercel.json)
//   เช่า 2 วันขึ้นไป = เตือน 2 วันก่อนกำหนดคืน · เช่าวันเดียว = 1 วันก่อน (2 วันก่อนชุดยังไม่ถึงมือ)
//   ออเดอร์ละ 1 ฉบับ (orders.return_reminder_sent_at — SQL Step 22) · cron พลาดวันไหน รอบถัดไปส่งย้อนให้ถ้ายังไม่เลยกำหนด
//   ลูกค้ากรอกเลขพัสดุคืนแล้ว = ไม่ต้องเตือน
// env: CRON_SECRET (Vercel ส่งมาเป็น Authorization: Bearer <CRON_SECRET>)
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/mail/mailer';
import { returnReminderEmail } from '@/lib/mail/returnReminderEmail';
import { addDays, formatThaiDateLong } from '@/utils/dateUtils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  user_id: string;
  order_number: string;
  ship_name: string | null;
  order_items:
    | {
        end_date: string;
        rental_days: number | null;
        parent_item_id: string | null;
        product_variants: { products: { name: string } | null } | null;
      }[]
    | null;
};

// วันนี้ตามเวลาไทย (เซิร์ฟเวอร์อยู่ UTC)
function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

// วันที่ต้องเตือน และวันกำหนดคืน ของออเดอร์
function reminderDates(items: NonNullable<OrderRow['order_items']>) {
  const returnBy = items.map((i) => i.end_date).sort().slice(-1)[0];
  if (!returnBy) return null;
  const days = Math.max(...items.filter((i) => i.end_date === returnBy).map((i) => i.rental_days ?? 1));
  return { returnBy, remindOn: addDays(returnBy, days >= 2 ? -2 : -1) };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET_NOT_SET' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = bangkokToday();

  const [{ data, error }, { data: settings }, { data: shopRow }] = await Promise.all([
    admin
      .from('orders')
      .select('id, user_id, order_number, ship_name, order_items ( end_date, rental_days, parent_item_id, product_variants ( products ( name ) ) )')
      .in('status', ['shipped', 'active'])
      .is('return_submitted_at', null)
      .is('return_reminder_sent_at', null),
    admin.from('booking_settings').select('late_fee_per_day').limit(1).maybeSingle(),
    admin.from('app_settings').select('value').eq('key', 'pickup_location').maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lateFeePerDay = Number(settings?.late_fee_per_day ?? 0);
  const loc = (shopRow?.value ?? null) as { name?: string; address?: string; hours?: string } | null;
  const shop = loc?.name && loc?.address ? { name: loc.name, address: loc.address, hours: loc.hours ?? '' } : null;

  const sent: string[] = [];
  const failed: { order: string; error: string }[] = [];

  for (const order of (data ?? []) as unknown as OrderRow[]) {
    const items = order.order_items ?? [];
    const dates = reminderDates(items);
    // ยังไม่ถึงวันเตือน หรือเลยกำหนดคืนไปแล้ว (เรื่องคืนช้าแอดมินตามเอง)
    if (!dates || today < dates.remindOn || today > dates.returnBy) continue;

    const { data: customer } = await admin.auth.admin.getUserById(order.user_id);
    const to = customer?.user?.email;
    if (!to) {
      failed.push({ order: order.order_number, error: 'NO_CUSTOMER_EMAIL' });
      continue;
    }

    const mail = returnReminderEmail({
      customerName: order.ship_name ?? 'ลูกค้า',
      orderNumber: order.order_number,
      orderId: order.id,
      returnBy: formatThaiDateLong(dates.returnBy),
      daysLeft: daysBetween(today, dates.returnBy),
      // รองเท้าที่มากับชุดอยู่ในรายการชุดอยู่แล้ว ไม่แสดงซ้ำ
      productNames: [
        ...new Set(
          items
            .filter((i) => !i.parent_item_id)
            .map((i) => i.product_variants?.products?.name)
            .filter((n): n is string => !!n),
        ),
      ],
      lateFeePerDay,
      shop,
    });

    try {
      await sendMail({ to, ...mail });
    } catch (e) {
      console.error('return-reminders: send failed', order.order_number, e);
      failed.push({ order: order.order_number, error: 'SEND_FAILED' });
      continue;
    }
    // ส่งแล้วค่อยบันทึก — ถ้าบันทึกล้ม รอบหน้าอาจส่งซ้ำ 1 ครั้ง (ดีกว่าไม่ได้เตือน)
    await admin.from('orders').update({ return_reminder_sent_at: new Date().toISOString() }).eq('id', order.id);
    sent.push(order.order_number);
  }

  return NextResponse.json({ today, sent, failed });
}
