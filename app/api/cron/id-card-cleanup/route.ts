// GET /api/cron/id-card-cleanup → ลบรูปบัตรประชาชนของลูกค้าที่ไม่ได้เช่าเกิน 1 ปี (Step 25 · PDPA, Vercel Cron ทุกวัน ดู vercel.json)
//   รายชื่อมาจาก id_cards_due_for_cleanup(): verified · ไม่ถูกแบน · ไม่มีออเดอร์ที่ยังไม่จบ
//   ลบไฟล์ก่อน แล้วค่อยตั้งสถานะกลับเป็น none — ลบไฟล์ไม่สำเร็จรอบนี้ รอบหน้าลองใหม่
// env: CRON_SECRET (Vercel ส่งมาเป็น Authorization: Bearer <CRON_SECRET>)
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET_NOT_SET' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('id_cards_due_for_cleanup');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (data ?? []) as { user_id: string; file_path: string }[];
  if (due.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  const { error: rmError } = await admin.storage.from('id-cards').remove(due.map((d) => d.file_path));
  if (rmError) return NextResponse.json({ error: rmError.message }, { status: 502 });

  const { data: marked, error: markError } = await admin.rpc('mark_id_cards_deleted', {
    p_user_ids: due.map((d) => d.user_id),
  });
  if (markError) return NextResponse.json({ error: markError.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: marked ?? 0 });
}
