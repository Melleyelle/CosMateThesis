// DELETE /api/id-card → ลูกค้าขอลบรูปบัตรประชาชนของตัวเอง (Step 25 · PDPA)
// delete_my_id_card() เช็กเงื่อนไขและล้างสถานะด้วย session ของลูกค้า แล้วลบไฟล์ด้วย service role
// (ลูกค้าไม่มีสิทธิ์ลบไฟล์ใน bucket id-cards เอง)
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });

  const { data: path, error } = await supabase.rpc('delete_my_id_card');
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });

  if (typeof path === 'string' && path) {
    const { error: rmError } = await createAdminClient().storage.from('id-cards').remove([path]);
    if (rmError) {
      console.error('id-card delete: remove failed', rmError);
      return NextResponse.json({ error: 'REMOVE_FAILED' }, { status: 502 });
    }
  }
  return NextResponse.json({ ok: true });
}
