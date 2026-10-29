-- =====================================================================
-- CosMate Step 26: ค่าวันเพิ่ม 400 บาท · เช่าสูงสุด 5 วัน · จัดส่งเฉพาะไปรษณีย์ไทย (EMS)
-- ---------------------------------------------------------------------
--   · extra_day_rate 100 → 400 (เช่าทั้งชุด วันที่ 2 เป็นต้นไป · เป็นเพดานค่าวันเพิ่มของการเช่าแยกชิ้นด้วย)
--   · max_rental_days 10 → 5
--   · ship_carrier_fees เหลือแค่ ems (ค่าส่งเดิมของ EMS) · create_booking ไม่รับขนส่งที่ไม่มีใน key
--
-- เปลี่ยนแค่ค่าตั้ง ไม่แก้ฟังก์ชัน · ออเดอร์เดิมไม่เปลี่ยน (เก็บอัตรา/ขนส่งไว้ในออเดอร์แล้ว)
-- เก็บชนิดค่าเดิมไว้ (ตัวเลข/ข้อความใน jsonb) ให้ setting_int อ่านได้เหมือนเดิม
-- รันหลัง Step 25 · รันซ้ำได้
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select * from (values ('extra_day_rate', 400), ('max_rental_days', 5)) as t(key, val)
  loop
    update public.app_settings s
       set value = case jsonb_typeof(s.value) when 'string' then to_jsonb(r.val::text) else to_jsonb(r.val) end
     where s.key = r.key;
    if not found then
      insert into public.app_settings (key, value) values (r.key, to_jsonb(r.val));
    end if;
  end loop;
end $$;

-- เหลือแค่ EMS ราคาเดิม · ไม่เคยตั้ง EMS = ใช้ shipping_flat_rate
update public.app_settings s
   set value = jsonb_build_object(
         'ems',
         coalesce(s.value -> 'ems', to_jsonb(coalesce(public.setting_int('shipping_flat_rate'), 0)))
       )
 where s.key = 'ship_carrier_fees';

insert into public.app_settings (key, value)
select 'ship_carrier_fees', jsonb_build_object('ems', coalesce(public.setting_int('shipping_flat_rate'), 0))
where not exists (select 1 from public.app_settings where key = 'ship_carrier_fees');


-- ตรวจผล: extra_day_rate = 400 · max_rental_days = 5 · ship_carrier_fees = {"ems": ...}
select public.setting_int('extra_day_rate')  as extra_day_rate,
       public.setting_int('max_rental_days') as max_rental_days,
       public.get_ship_carrier_fees()        as ship_carrier_fees;
