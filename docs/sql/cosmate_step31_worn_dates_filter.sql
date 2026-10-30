-- =====================================================================
-- CosMate Step 31: ตัวกรอง "วันที่ใช้ชุด" ดูแค่วันที่มีคนจองไปใส่จริง
-- ---------------------------------------------------------------------
-- หน้าสำรวจชุดเดิมใช้ get_unavailable_start_dates ซึ่งตอบว่า "วันนี้เริ่มจองได้ไหม"
-- จึงรวมวันขนส่ง/ซัก (buffer) จองล่วงหน้าขั้นต่ำ และช่วงเปิดจอง 120 วันด้วย
-- ตัวกรองใหม่ถามแค่ "วันนี้มีคนจองชุดไปใส่อยู่ไหม"
--   · วันใส่ของรายการ = start_date ถึง end_date − 1 (end_date คือวันส่งคืน · Step 23)
--   · ไซส์ไม่ว่างวัน D เมื่อชุดจริงสถานะ available ทุกตัวถูกจองไปใส่วัน D
--   · ไม่แตะการจองจริง: หน้าชุดและ create_booking ยังตรวจวันด้วยกติกาเดิม
--     ลูกค้าจึงอาจเห็นชุดจากตัวกรอง แต่เลือกวันนั้นในหน้าชุดไม่ได้ (เช่น ติดวันซักของคิวก่อนหน้า)
--
-- คืนเฉพาะไซส์และวันที่ ไม่มีข้อมูลออเดอร์หรือลูกค้า จึงเปิดให้ anon เรียกได้เหมือน get_occupied_dates
--
-- รันหลัง Step 23 · รันซ้ำได้
-- =====================================================================

create or replace function public.get_fully_worn_dates(p_variant_ids uuid[], p_days_ahead integer default 120)
returns table (variant_id uuid, worn_date date)
language sql
stable
security definer
set search_path to ''
as $function$
  with cfg as (
    select (now() at time zone 'Asia/Bangkok')::date as today, least(p_days_ahead, 365) as days
  ),
  units as (
    select pi.id, pi.variant_id
    from public.product_items pi
    where pi.variant_id = any (p_variant_ids)
      and pi.condition_status = 'available'
  )
  select u.variant_id, cfg.today + g
  from cfg
  join units u on true
  join public.order_items oi on oi.product_item_id = u.id and oi.is_blocking
  cross join lateral generate_series(
    greatest(oi.start_date, cfg.today) - cfg.today,
    least(oi.end_date - 1, cfg.today + cfg.days) - cfg.today
  ) as g
  group by u.variant_id, cfg.today + g
  having count(distinct u.id) >= (select count(*) from units x where x.variant_id = u.variant_id);
$function$;

grant execute on function public.get_fully_worn_dates(uuid[], integer) to anon, authenticated;
