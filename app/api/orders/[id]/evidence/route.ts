// GET /api/orders/[id]/evidence → รูปและเช็กลิสต์ตอนแพ็กของออเดอร์ (ให้ลูกค้าเจ้าของออเดอร์ดู)
// เช็กความเป็นเจ้าของด้วยสิทธิ์ลูกค้าก่อน แล้วค่อยใช้ service role อ่าน order_evidence + เซ็นลิงก์รูป
// ส่งเฉพาะ stage 'packing' — รูปตอนรับคืนเป็นหลักฐานภายในของร้าน
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ลูกค้าเห็นได้ตั้งแต่ร้านส่งของออกไปแล้ว
const VISIBLE_STATUSES = ['shipped', 'active', 'returned', 'inspecting', 'completed'];
const SIGNED_URL_SECONDS = 60 * 30;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });

  // RLS ทำให้เห็นเฉพาะออเดอร์ของตัวเอง
  const { data: order } = await supabase.from('orders').select('id, status').eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  if (!VISIBLE_STATUSES.includes(order.status)) return NextResponse.json({ packing: null });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('order_evidence')
    .select('image_paths, checklist, created_at')
    .eq('order_id', orderId)
    .eq('stage', 'packing')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return NextResponse.json({ packing: null });

  const paths = (row.image_paths ?? []) as string[];
  let photos: string[] = [];
  if (paths.length) {
    const { data } = await admin.storage.from('order-evidence').createSignedUrls(paths, SIGNED_URL_SECONDS);
    photos = (data ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u);
  }

  const checklist = Array.isArray(row.checklist) ? (row.checklist as { name: string; checked: boolean }[]) : [];
  return NextResponse.json({ packing: { photos, checklist, packedAt: row.created_at as string } });
}
