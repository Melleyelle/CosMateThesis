// POST /api/id-cards/[userId]/review { approve: boolean, reason?: string } → แอดมินอนุมัติ/ไม่อนุมัติรูปบัตรประชาชน (Step 25)
//   1) admin_review_id_card() ด้วย session ของแอดมิน (เช็กสิทธิ์ในฐานข้อมูล) — ย้าย/ยกเลิกออเดอร์ awaiting_id ให้
//   2) ไม่อนุมัติ → ลบไฟล์ใน bucket id-cards ด้วย service role (ลบไฟล์ผ่าน SQL ไม่ได้)
//   3) อีเมลแจ้งลูกค้า (ส่งไม่ได้ไม่ทำให้ผลตรวจพัง)
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/mail/mailer';
import { idReviewEmail, type IdReviewOrder } from '@/lib/mail/idReviewEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReviewResult = {
  approved: boolean;
  file_path: string | null;
  orders: { id: string; order_number: string; status: IdReviewOrder['status']; payment_expires_at?: string }[];
};

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const body = (await req.json().catch(() => null)) as { approve?: unknown; reason?: unknown } | null;
  if (!body || typeof body.approve !== 'boolean') return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });

  const { data, error } = await supabase.rpc('admin_review_id_card', {
    p_user_id: userId,
    p_approve: body.approve,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes('NOT_ADMIN') ? 403 : 409 });
  const result = data as ReviewResult;

  const admin = createAdminClient();
  if (result.file_path) {
    const { error: rmError } = await admin.storage.from('id-cards').remove([result.file_path]);
    if (rmError) console.error('id-card review: remove failed', rmError);
  }

  let mailed = false;
  const [{ data: customer }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('profiles').select('first_name, last_name').eq('id', userId).maybeSingle(),
  ]);
  const to = customer?.user?.email;
  if (to) {
    const mail = idReviewEmail({
      customerName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'ลูกค้า',
      approved: result.approved,
      reason,
      orders: (result.orders ?? []).map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        payBy: o.payment_expires_at ?? null,
      })),
    });
    try {
      await sendMail({ to, ...mail });
      mailed = true;
    } catch (e) {
      console.error('id-card review: send failed', e);
    }
  }

  return NextResponse.json({ ok: true, mailed, orders: result.orders ?? [] });
}
