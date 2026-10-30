-- =====================================================================
-- CosMate Step 32: ระยะเวลาคืนมัดจำเป็นค่ากลางของร้าน
-- ---------------------------------------------------------------------
-- เดิมเก็บรายไซส์ที่ product_variants.deposit_return_hours และมีค่าในโค้ดอีกหลายจุด
-- ตอนนี้ใช้ app_settings.deposit_return_hours ค่าเดียว ทั้งหน้าร้าน หน้าชำระเงิน วิธีการเช่า และอีเมล
--
-- เปลี่ยนค่า: update public.app_settings set value = '48' where key = 'deposit_return_hours';
--
-- คอลัมน์ product_variants.deposit_return_hours เลิกใช้แล้ว แต่ยังไม่ลบ
-- เพราะ create_costume / update_costume (ไม่อยู่ใน repo) ยังอ้างถึงคอลัมน์นี้
--
-- รันซ้ำได้
-- =====================================================================

insert into public.app_settings (key, value) values ('deposit_return_hours', '72'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_deposit_return_hours()
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((select (s.value #>> '{}')::int from public.app_settings s where s.key = 'deposit_return_hours'), 72);
$function$;

grant execute on function public.get_deposit_return_hours() to anon, authenticated;
