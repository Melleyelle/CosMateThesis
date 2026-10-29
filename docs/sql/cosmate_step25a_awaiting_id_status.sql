-- =====================================================================
-- CosMate Step 25a: เพิ่มสถานะออเดอร์ awaiting_id (รอร้านตรวจบัตร) ใน enum
-- ---------------------------------------------------------------------
-- orders.status เป็น enum (order_status_t) · Postgres ไม่ให้ใช้ค่า enum ใหม่ในทรานแซกชันเดียวกับที่เพิ่ม
-- จึงแยกไฟล์นี้ออกมา: รันไฟล์นี้ให้เสร็จก่อน แล้วค่อยรัน Step 25
--
-- เพิ่มให้ทุก enum ที่มีสถานะออเดอร์ (มีทั้ง pending_payment และ manual_review) เผื่อ order_status_history ใช้ enum แยก
-- รันหลัง Step 24 · รันซ้ำได้
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select t.oid::regtype as typ
    from pg_type t
    where t.typtype = 'e'
      and exists (select 1 from pg_enum e where e.enumtypid = t.oid and e.enumlabel = 'pending_payment')
      and exists (select 1 from pg_enum e where e.enumtypid = t.oid and e.enumlabel = 'manual_review')
  loop
    execute format('alter type %s add value if not exists %L before %L', r.typ, 'awaiting_id', 'pending_payment');
  end loop;
end $$;
