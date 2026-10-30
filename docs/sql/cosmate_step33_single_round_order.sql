-- =====================================================================
-- CosMate Step 33: ออเดอร์เดียวต้องใช้วันใส่และจำนวนวันเช่าเดียวกัน
-- ---------------------------------------------------------------------
-- ร้านส่ง รับคืน และคิดค่าปรับต่อออเดอร์ รายการในออเดอร์จึงต้องอยู่รอบเดียวกัน
-- ใช้วันอื่น = จองเป็นออเดอร์ใหม่ (ตะกร้าแบ่งกลุ่มให้ · utils/customer/cart.ts sameOrderRound)
--
--   · ใช้ trigger ตอนเพิ่ม order_items จึงไม่ต้องคัดลอก create_booking ทั้งฟังก์ชัน
--     รองเท้าใช้วันเดียวกับชุดอยู่แล้ว จึงผ่านกติกานี้เอง
--   · ไม่แตะออเดอร์เก่าที่มีหลายวัน: ตรวจเฉพาะตอนเพิ่มรายการใหม่
--   · ผิดกติกา → raise ORDER_ROUND_MISMATCH · create_booking ยกเลิกทั้งออเดอร์
--
-- รันซ้ำได้
-- =====================================================================

create or replace function public.enforce_order_single_round()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if exists (
    select 1 from public.order_items oi
    where oi.order_id = new.order_id
      and (oi.start_date is distinct from new.start_date
           or oi.rental_days is distinct from new.rental_days)
  ) then
    raise exception 'ORDER_ROUND_MISMATCH';
  end if;
  return new;
end $function$;

revoke all on function public.enforce_order_single_round() from public, anon, authenticated;

drop trigger if exists order_items_single_round on public.order_items;
create trigger order_items_single_round
  before insert on public.order_items
  for each row execute function public.enforce_order_single_round();
