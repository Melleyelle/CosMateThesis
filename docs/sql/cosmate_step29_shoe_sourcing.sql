-- =====================================================================
-- CosMate Step 29: รองเท้าไม่ว่างไม่ล็อกทั้งชุด — ร้านจัดหาคู่ใกล้เคียงให้แทน
-- ---------------------------------------------------------------------
-- นโยบาย (PRODUCT.md)
--   · ปฏิทินดูเฉพาะชุดหลัก · ชุดหลักเช่าไม่ได้ก็ต่อเมื่อติดจองจริง หรือส่งซัก/ซ่อม (condition_status)
--   · ลูกค้าเลือกไซส์รองเท้าที่ไม่ว่าง → จองได้ถ้ายอมรับ "ร้านจัดหาคู่ใกล้เคียงให้" (shoe_substitute = true)
--       ราคาเต็มเหมือนเดิม · แอดมินโทรคุยกับลูกค้าเอง · หาไม่ได้ = คืนค่ารองเท้า (ราคาชิ้นรองเท้าตอนจอง)
--   · ไม่ยอมรับ แล้วรองเท้าถูกจองตัดหน้า = SHOE_UNAVAILABLE เหมือนเดิม
--
-- การเก็บข้อมูล: ไม่สร้างรายการรองเท้าลูก (ไม่มีคู่จริงให้ล็อก) แต่ติดสถานะไว้ที่รายการชุด
--   shoe_sourcing_status  null = ไม่ต้องจัดหา · pending = รอจัดหา · sourced = จัดหาได้แล้ว · refund = หาไม่ได้ คืนค่ารองเท้า
-- คืนเงิน: ตอนตรวจรับคืน ค่ารองเท้าที่หาไม่ได้ถูกบวกเข้ายอดคืนมัดจำอัตโนมัติ (ข้อ 4)
--
-- รันหลัง Step 25 · รันซ้ำได้
-- =====================================================================


-- 1) คอลัมน์ที่รายการชุด ----------------------------------------------------
-- shoe_sourcing_variant_id ไม่ทำ FK: order_items มี FK ไป product_variants อยู่แล้ว (variant_id)
--   ถ้ามีสองเส้น หน้าเว็บที่ embed product_variants ( … ) จะกำกวมและ query ล้ม · เก็บไซส์เป็นข้อความไว้แสดงแทน
alter table public.order_items
  add column if not exists shoe_sourcing_variant_id uuid,
  add column if not exists shoe_sourcing_size       text,
  add column if not exists shoe_sourcing_status     text,
  add column if not exists shoe_sourcing_amount     numeric not null default 0,
  add column if not exists shoe_sourcing_note       text;

alter table public.order_items drop constraint if exists order_items_shoe_sourcing_status_check;
alter table public.order_items
  add constraint order_items_shoe_sourcing_status_check
  check (shoe_sourcing_status is null or shoe_sourcing_status in ('pending', 'sourced', 'refund'));

create index if not exists order_items_shoe_sourcing_pending_idx
  on public.order_items (order_id)
  where shoe_sourcing_status = 'pending';


-- 2) แอดมินปิดงานจัดหา -------------------------------------------------------
--   sourced = จัดหาได้แล้ว · refund = หาไม่ได้ คืนค่ารองเท้า · pending = ย้อนกลับไปรอจัดหา
--   ล็อกเมื่อออเดอร์จบแล้ว: ยอดคืนเงินคำนวณไปแล้วตอนตรวจรับคืน (ข้อ 4) แก้ทีหลังยอดจะไม่ตรง
--   (รหัส error ห้ามขึ้นต้นด้วย INVALID_SHOE — หน้าเว็บจับคู่ข้อความแบบ "มีคำนี้อยู่" จะไปตรงกับ INVALID_SHOE ของ Step 19)
create or replace function public.admin_set_shoe_sourcing(p_line_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_status not in ('pending', 'sourced', 'refund') then raise exception 'SHOE_SOURCING_BAD_STATUS'; end if;
  if exists (
    select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
     where oi.id = p_line_id and o.status::text in ('completed', 'cancelled', 'expired')) then
    raise exception 'SHOE_SOURCING_LOCKED';
  end if;

  update public.order_items
     set shoe_sourcing_status = p_status,
         shoe_sourcing_note   = nullif(left(btrim(coalesce(p_note, '')), 300), '')
   where id = p_line_id
     and shoe_sourcing_status is not null;
  if not found then raise exception 'SHOE_SOURCING_NOT_FOUND'; end if;
end $function$;

revoke all on function public.admin_set_shoe_sourcing(uuid, text, text) from public, anon;
grant execute on function public.admin_set_shoe_sourcing(uuid, text, text) to authenticated;


-- 3) create_booking ------------------------------------------------------
-- คัดลอกจาก Step 25 ส่วนที่เปลี่ยน: รายการใน p_items รับ shoe_substitute (boolean) เพิ่ม
--   ไม่มีรองเท้าคู่ว่าง + shoe_substitute = ติดสถานะ pending ที่รายการชุด แทน SHOE_UNAVAILABLE

create or replace function public.create_booking(
  p_items jsonb,
  p_ship_name text,
  p_ship_phone text,
  p_ship_address text,
  p_ship_subdistrict text,
  p_ship_district text,
  p_ship_province text,
  p_ship_postal_code text,
  p_note text default null::text,
  p_delivery_method text default 'ship'::text,
  p_ship_carrier text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_delivery text := coalesce(p_delivery_method, 'ship');
  v_before   int  := public.setting_int('buffer_days_before');
  v_after    int  := public.setting_int('buffer_days_after');
  v_max_pend int  := public.setting_int('max_pending_orders_per_user');
  v_shipping numeric := public.setting_int('shipping_flat_rate');
  v_today    date := (now() at time zone 'Asia/Bangkok')::date;
  v_earliest date;
  v_min_days   int     := coalesce(public.setting_int('min_rental_days'), 1);
  v_max_days   int     := coalesce(public.setting_int('max_rental_days'), 10);
  v_extra_rate numeric := coalesce(public.setting_int('extra_day_rate'), 100);
  v_piece_pct  numeric := coalesce(public.setting_int('piece_extra_day_percent'), 50);
  v_window     int     := 120; -- ช่วงเปิดจอง ให้ตรงกับ DAYS_AHEAD ของหน้าเว็บ

  -- ขนส่ง (Step 20) · ไม่ส่งมา = EMS ให้หน้าเว็บเวอร์ชันเก่ายังจองได้
  v_carrier  text := coalesce(nullif(p_ship_carrier, ''), 'ems');
  v_fees     jsonb := (select s.value from public.app_settings s where s.key = 'ship_carrier_fees');

  v_order_id uuid;
  v_order_no text;
  v_item     jsonb;
  v_variant  public.product_variants%rowtype;
  v_start    date;
  v_end      date;
  v_range    daterange;
  v_unit     uuid;
  v_inserted boolean;
  v_rental   numeric := 0;
  v_deposit  numeric := 0;
  v_laundry  numeric := 0;
  v_grand    numeric;

  v_req_pieces   jsonb;
  v_piece_rows   jsonb;
  v_piece_count  int;
  v_req_count    int;
  v_item_rental  numeric;
  v_item_deposit numeric;
  v_item_laundry numeric;
  v_days_raw     jsonb;
  v_days         int;
  v_base_rental  numeric;
  v_day_rate     numeric;
  v_extra_fee    numeric;

  -- รองเท้าที่มากับชุด (Step 19)
  v_line_id       uuid;
  v_shoe_inc_id   uuid;
  v_shoe_product  uuid;
  v_shoe_price    numeric;
  v_shoe_req      uuid;
  v_wants_shoe    boolean;
  v_shoe_variant  uuid;
  v_shoe_sub      boolean; -- ยอมรับคู่ใกล้เคียงถ้าไซส์ที่เลือกไม่ว่าง (Step 29)

  -- ราคา/มัดจำตามตัว (Step 21 → 25)
  v_is_pieces     boolean;
  v_unit_price    numeric;
  v_unit_deposit  numeric;
  v_unit_phase    text;
  v_shoe_cut      numeric;

  -- ยืนยันตัวตน (Step 25)
  v_id_status   text;
  v_need_id     boolean;
  v_handover    timestamptz;
  v_id_deadline timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.status <> 'active' or v_profile.trust_level = 'blacklisted' then
    raise exception 'ACCOUNT_NOT_ALLOWED';
  end if;

  -- เช่าครั้งแรกต้องส่งรูปบัตรก่อน · ส่งแล้วรอตรวจ = จองได้แต่ยังไม่เปิดให้ชำระ
  select c.status into v_id_status from public.customer_id_cards c where c.user_id = v_uid;
  v_id_status := coalesce(v_id_status, 'none');
  if v_id_status not in ('pending', 'verified') then
    raise exception 'ID_CARD_REQUIRED';
  end if;
  v_need_id := v_id_status = 'pending';

  if v_delivery not in ('ship', 'pickup') then
    raise exception 'INVALID_DELIVERY_METHOD';
  end if;
  -- จัดส่งต้องมีที่อยู่ · รับเองไม่มีวันขนส่งและไม่มีค่าส่ง
  if v_delivery = 'ship' and (
       coalesce(trim(p_ship_address), '') = ''
       or coalesce(trim(p_ship_province), '') = ''
       or coalesce(trim(p_ship_postal_code), '') = '') then
    raise exception 'INVALID_ADDRESS';
  end if;
  if v_delivery = 'pickup' then
    v_before   := 0;
    v_shipping := 0;
    v_carrier  := null;
  else
    -- ขนส่งต้องเปิดอยู่ใน ship_carrier_fees · ไม่มีค่าตั้งนี้ = ใช้ shipping_flat_rate
    if v_carrier not in ('ems', 'kerry', 'flash', 'jt')
       or (v_fees is not null and not (v_fees ? v_carrier)) then
      raise exception 'INVALID_CARRIER';
    end if;
    if v_fees is not null then
      v_shipping := (v_fees ->> v_carrier)::numeric;
    end if;
  end if;
  v_earliest := public.earliest_start_date(v_delivery);

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 10 then
    raise exception 'INVALID_ITEMS';
  end if;

  if (select count(*) from public.orders o
       where o.user_id = v_uid and o.status::text in ('pending_payment', 'awaiting_id')) >= v_max_pend then
    raise exception 'TOO_MANY_PENDING_ORDERS';
  end if;

  v_order_no := 'CM'
    || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDD')
    || lpad(nextval('public.order_number_seq')::text, 4, '0');

  insert into public.orders (
    order_number, user_id, status, delivery_method, ship_carrier,
    ship_name, ship_phone, ship_address, ship_subdistrict, ship_district,
    ship_province, ship_postal_code, customer_note
  ) values (
    v_order_no, v_uid,
    (case when v_need_id then 'awaiting_id' else 'pending_payment' end)::public.order_status_t,
    v_delivery, v_carrier,
    p_ship_name, p_ship_phone,
    case when v_delivery = 'pickup' then null else p_ship_address end,
    case when v_delivery = 'pickup' then null else p_ship_subdistrict end,
    case when v_delivery = 'pickup' then null else p_ship_district end,
    case when v_delivery = 'pickup' then null else p_ship_province end,
    case when v_delivery = 'pickup' then null else p_ship_postal_code end,
    p_note
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select pv.* into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item ->> 'variant_id')::uuid
      and p.status = 'active';
    if not found then
      raise exception 'VARIANT_NOT_FOUND';
    end if;

    v_days_raw := v_item -> 'rental_days';
    if coalesce(jsonb_typeof(v_days_raw), '') <> 'number'
       or (v_days_raw::text)::numeric <> trunc((v_days_raw::text)::numeric) then
      raise exception 'INVALID_RENTAL_DAYS';
    end if;
    v_days := (v_days_raw::text)::int;
    if v_days < v_min_days or v_days > v_max_days then
      raise exception 'INVALID_RENTAL_DAYS';
    end if;

    -- รายการรองเท้าของชุดนี้ (ถ้ามี)
    v_shoe_inc_id := null;
    v_shoe_product := null;
    v_shoe_price := 0;
    select pi.id, pi.shoe_product_id, coalesce(pi.rental_price, 0)
      into v_shoe_inc_id, v_shoe_product, v_shoe_price
    from public.product_inclusions pi
    where pi.product_id = v_variant.product_id
      and pi.shoe_product_id is not null
    limit 1;
    v_shoe_req := nullif(v_item ->> 'shoe_variant_id', '')::uuid;
    v_shoe_sub := coalesce(v_item -> 'shoe_substitute' = 'true'::jsonb, false);

    v_req_pieces := v_item -> 'pieces';
    v_is_pieces := jsonb_typeof(v_req_pieces) = 'array' and jsonb_array_length(v_req_pieces) > 0;
    v_shoe_cut := 0;
    if v_is_pieces then
      select count(distinct x) into v_req_count from jsonb_array_elements_text(v_req_pieces) x;

      select jsonb_agg(jsonb_build_object(
               'id', pi.id, 'name', pi.name,
               'rental_price', pi.rental_price, 'laundry_fee', coalesce(pi.laundry_fee, 0))
             order by pi.display_order),
             count(*), coalesce(sum(pi.rental_price), 0), coalesce(sum(coalesce(pi.laundry_fee, 0)), 0)
        into v_piece_rows, v_piece_count, v_base_rental, v_item_laundry
      from public.product_inclusions pi
      where pi.product_id = v_variant.product_id
        and pi.rental_price is not null
        and pi.id::text in (select x from jsonb_array_elements_text(v_req_pieces) x);

      if v_piece_count <> v_req_count then
        raise exception 'INVALID_PIECES';
      end if;
      v_day_rate := ceil(least(v_base_rental * v_piece_pct / 100.0, v_extra_rate));

      -- แยกชิ้น: เอารองเท้าก็ต่อเมื่อติ๊กชิ้นรองเท้า
      v_wants_shoe := v_shoe_inc_id is not null
        and exists (select 1 from jsonb_array_elements_text(v_req_pieces) x where x = v_shoe_inc_id::text);
      if v_wants_shoe and v_shoe_req is null then
        raise exception 'SHOE_SIZE_REQUIRED';
      end if;
    else
      v_piece_rows   := null;
      v_item_laundry := v_variant.laundry_fee;
      v_day_rate     := v_extra_rate;

      -- ทั้งชุด: ส่งไซส์รองเท้ามา = รับรองเท้า · ไม่ส่ง = ไม่รับ หักราคารองเท้าออก (มัดจำเท่าเดิม)
      v_wants_shoe := v_shoe_inc_id is not null and v_shoe_req is not null;
      if v_shoe_inc_id is not null and v_shoe_req is null then
        v_shoe_cut := v_shoe_price;
      end if;
    end if;

    -- ส่งไซส์รองเท้ามาทั้งที่ชุดไม่มีรองเท้า หรือไม่ได้เลือกชิ้นรองเท้า
    if v_shoe_req is not null and not v_wants_shoe then
      raise exception 'INVALID_SHOE';
    end if;

    if v_wants_shoe then
      select pv.id into v_shoe_variant
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = v_shoe_req
        and pv.product_id = v_shoe_product
        and p.status = 'active';
      if not found then
        raise exception 'INVALID_SHOE';
      end if;
    end if;

    v_extra_fee := (v_days - 1) * v_day_rate;

    v_start := (v_item ->> 'start_date')::date;
    if v_start < v_earliest then
      raise exception 'START_DATE_TOO_SOON';
    end if;

    v_end := v_start + v_days;
    if v_end > v_today + v_window then
      raise exception 'DATE_UNAVAILABLE';
    end if;
    v_range := daterange(v_start - v_before, v_end + v_after, '[]');

    -- ตัวที่ค่าเช่าถูกสุดก่อน · ค่าเช่าทั้งชุดและมัดจำล็อกตามตัวที่ได้
    v_inserted := false;
    for v_unit, v_unit_price, v_unit_deposit, v_unit_phase in
      select f.item_id, f.price, f.deposit, f.phase from public.free_units(v_variant.id, v_range) f
    loop
      if v_is_pieces then
        v_item_deposit := public.pieces_deposit(v_unit_deposit, v_base_rental);
      else
        v_base_rental  := greatest(v_unit_price - v_shoe_cut, 0);
        v_item_deposit := v_unit_deposit;
      end if;
      v_item_rental := v_base_rental + v_extra_fee;
      begin
        insert into public.order_items (
          order_id, variant_id, product_item_id,
          start_date, end_date, blocked_during,
          rental_price, deposit_amount, laundry_fee, pieces,
          rental_days, base_rental_price, extra_day_rate, extra_days_fee, round_no, price_phase
        ) values (
          v_order_id, v_variant.id, v_unit,
          v_start, v_end, v_range,
          v_item_rental, v_item_deposit, v_item_laundry, v_piece_rows,
          v_days, v_base_rental, v_day_rate, v_extra_fee, public.unit_completed_rentals(v_unit) + 1, v_unit_phase
        ) returning id into v_line_id;
        v_inserted := true;
        exit;
      exception when exclusion_violation then
        null;
      end;
    end loop;

    if not v_inserted then
      raise exception 'DATE_UNAVAILABLE';
    end if;

    -- รองเท้าคู่จริง: ช่วงล็อกเดียวกับชุด · ราคา/มัดจำ/ค่าซัก 0 เพราะรวมอยู่ในรายการชุดแล้ว
    if v_wants_shoe then
      v_inserted := false;
      for v_unit in
        select pi.id
        from public.product_items pi
        where pi.variant_id = v_shoe_variant
          and pi.condition_status = 'available'
        order by pi.item_code
      loop
        begin
          insert into public.order_items (
            order_id, variant_id, product_item_id, parent_item_id,
            start_date, end_date, blocked_during,
            rental_price, deposit_amount, laundry_fee, pieces,
            rental_days, base_rental_price, extra_day_rate, extra_days_fee
          ) values (
            v_order_id, v_shoe_variant, v_unit, v_line_id,
            v_start, v_end, v_range,
            0, 0, 0, null,
            v_days, 0, 0, 0
          );
          v_inserted := true;
          exit;
        exception when exclusion_violation then
          null;
        end;
      end loop;

      -- ไม่มีคู่ว่าง: ยอมรับคู่ใกล้เคียง = จองชุดได้ ร้านจัดหาเอง (ราคาเต็ม · หาไม่ได้คืนค่ารองเท้าตามราคานี้)
      if not v_inserted then
        if not v_shoe_sub then
          raise exception 'SHOE_UNAVAILABLE';
        end if;
        update public.order_items
           set shoe_sourcing_variant_id = v_shoe_variant,
               shoe_sourcing_size       = (select pv.size from public.product_variants pv where pv.id = v_shoe_variant),
               shoe_sourcing_status     = 'pending',
               shoe_sourcing_amount     = v_shoe_price
         where id = v_line_id;
      end if;
    end if;

    v_rental  := v_rental  + v_item_rental;
    v_deposit := v_deposit + v_item_deposit;
    v_laundry := v_laundry + v_item_laundry;
  end loop;

  v_grand := v_rental + v_deposit + v_laundry + v_shipping;

  update public.orders
     set rental_total  = v_rental,
         deposit_total = v_deposit,
         laundry_total = v_laundry,
         shipping_fee  = v_shipping,
         grand_total   = v_grand
   where id = v_order_id;

  -- รอตรวจบัตร: ไม่เกิน 24 ชม. · เส้นตายออเดอร์ใกล้กว่า 48 ชม. = ครึ่งหนึ่งของเวลาที่เหลือ (อีกครึ่งให้ชำระ)
  -- payment_expires_at ตั้งเท่ากัน กันระบบหมดอายุเดิมของ Step 16 ตัดออเดอร์ก่อนเวลา
  if v_need_id then
    v_handover := public.order_handover_deadline(v_order_id);
    if v_handover - now() < interval '2 hours' then
      raise exception 'ID_REVIEW_NO_TIME';
    end if;
    v_id_deadline := now() + least(interval '24 hours', (v_handover - now()) / 2);
    update public.orders
       set id_review_expires_at = v_id_deadline,
           payment_expires_at   = v_id_deadline
     where id = v_order_id;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_no,
    'grand_total', v_grand,
    'status', case when v_need_id then 'awaiting_id' else 'pending_payment' end,
    'id_review_expires_at', v_id_deadline
  );
end $function$;


-- 4) admin_receive_and_inspect: รวมค่ารองเท้าที่หาไม่ได้เข้ายอดคืนเงิน ----------
-- คัดลอกจากฟังก์ชันในฐานข้อมูล (ดึงด้วย pg_get_functiondef เมื่อ 30 ต.ค. 2569) ส่วนที่เปลี่ยน:
--   · ยังมีรองเท้ารอจัดหา (pending) = SHOE_SOURCING_PENDING ให้แอดมินปิดงานจัดหาก่อน ยอดคืนจะได้ถูก
--   · ยอดคืน = มัดจำ − ค่าปรับ/ค่าเสียหาย + ค่ารองเท้าที่หาไม่ได้ (refund)
--     ค่ารองเท้าไม่ใช่มัดจำ จึงไม่นับในเพดาน DEDUCTION_EXCEEDS_DEPOSIT และคืนแม้กรณีสูญหาย (ลูกค้าไม่ได้รองเท้าจริง)
--   · ผลลัพธ์เพิ่ม shoe_refund
-- ยกเลิกออเดอร์ที่จ่ายแล้ว (admin_update_order_status) คืน grand_total ทั้งก้อนซึ่งรวมค่ารองเท้าอยู่แล้ว ไม่ต้องแก้

create or replace function public.admin_receive_and_inspect(
  p_order_id uuid,
  p_image_paths text[],
  p_checklist jsonb default '[]'::jsonb,
  p_deductions jsonb default '[]'::jsonb,
  p_waive_late boolean default false,
  p_severity text default 'minor'::text,
  p_note text default null::text,
  p_return_method text default 'ship'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order      public.orders%rowtype;
  v_fee_day    numeric;
  v_due        date;
  v_back_on    date;
  v_late_days  int := 0;
  v_late_fee   numeric := 0;
  v_damage_fee numeric := 0;
  v_deposit    numeric;
  v_refund     numeric;
  v_shoe_refund numeric := 0; -- ค่ารองเท้าที่หาไม่ได้ (Step 29)
  v_lost       boolean;
  v_broken     boolean;
  v_result     text;
  v_item       record;
  d            jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if coalesce(p_return_method, '') not in ('ship', 'walk_in') then raise exception 'INVALID_TRANSITION'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if jsonb_typeof(coalesce(p_deductions, '[]'::jsonb)) <> 'array' then raise exception 'INVALID_DEDUCTION'; end if;
  v_lost := exists (select 1 from jsonb_array_elements(coalesce(p_deductions, '[]'::jsonb)) e where e->>'type' = 'lost');

  -- active ที่มีเลขพัสดุคืนแล้ว = ออเดอร์เก่าก่อน Step 17 · active + walk_in = ลูกค้านำมาคืนที่ร้าน
  -- active ที่ไม่มีเลขพัสดุคืน (และไม่ใช่ walk_in) ปิดได้เฉพาะ "สูญหาย" และต้องเลยกำหนดคืนเกิน overdue_lost_days
  if not (v_order.status in ('returned', 'inspecting')
          or (v_order.status = 'active' and v_order.return_tracking_no is not null)
          or (v_order.status = 'active' and p_return_method = 'walk_in')) then
    if not (v_order.status = 'active' and v_lost) then
      raise exception 'RETURN_TRACKING_REQUIRED';
    end if;
    if (select max(end_date) from public.order_items where order_id = p_order_id)
         + coalesce((select (value #>> '{}')::int from public.app_settings where key = 'overdue_lost_days'), 7)
       >= (now() at time zone 'Asia/Bangkok')::date then
      raise exception 'NOT_OVERDUE_ENOUGH';
    end if;
  end if;

  -- รองเท้าที่ยังรอจัดหา: ต้องบอกก่อนว่าหาได้หรือไม่ ยอดคืนเงินขึ้นกับคำตอบนี้
  if exists (select 1 from public.order_items where order_id = p_order_id and shoe_sourcing_status = 'pending') then
    raise exception 'SHOE_SOURCING_PENDING';
  end if;

  if not v_lost and (p_image_paths is null or cardinality(p_image_paths) < 1) then
    raise exception 'EVIDENCE_REQUIRED';
  end if;
  if exists (select 1 from unnest(coalesce(p_image_paths, '{}')) p where p not like p_order_id::text || '/%' or p like '%..%') then
    raise exception 'INVALID_EVIDENCE_PATH';
  end if;
  if p_severity not in ('minor', 'major') then raise exception 'INVALID_DEDUCTION'; end if;

  for d in select * from jsonb_array_elements(coalesce(p_deductions, '[]'::jsonb)) loop
    if (d->>'type') is null or (d->>'type') not in ('damage', 'missing_part', 'special_cleaning', 'lost')
       or coalesce((d->>'amount')::numeric, -1) < 0
       or char_length(coalesce(d->>'note', '')) > 300 then
      raise exception 'INVALID_DEDUCTION';
    end if;
    if (d->>'order_item_id') is not null and not exists (
         select 1 from public.order_items where id = (d->>'order_item_id')::uuid and order_id = p_order_id) then
      raise exception 'INVALID_DEDUCTION';
    end if;
  end loop;

  v_deposit := v_order.deposit_total;
  v_broken := not v_lost and exists (
    select 1 from jsonb_array_elements(p_deductions) e where e->>'type' in ('damage', 'missing_part'));

  -- ค่าปรับคืนช้า: นับถึงวันที่ลูกค้ากรอกเลขพัสดุ (walk_in = วันนี้ที่นำมาคืน)
  select max(end_date) into v_due from public.order_items where order_id = p_order_id;
  v_back_on := (coalesce(v_order.return_submitted_at, now()) at time zone 'Asia/Bangkok')::date;
  v_late_days := greatest(0, v_back_on - v_due);
  select (value #>> '{}')::numeric into v_fee_day from public.app_settings where key = 'late_fee_per_day';
  if not v_lost and not coalesce(p_waive_late, false) then
    v_late_fee := least(v_late_days * coalesce(v_fee_day, 100), v_deposit);
  end if;

  if v_lost then
    v_damage_fee := v_deposit;
  else
    select coalesce(sum((e->>'amount')::numeric), 0) into v_damage_fee
    from jsonb_array_elements(p_deductions) e;
  end if;

  if v_late_fee + v_damage_fee > v_deposit then raise exception 'DEDUCTION_EXCEEDS_DEPOSIT'; end if;
  select coalesce(sum(shoe_sourcing_amount), 0) into v_shoe_refund
  from public.order_items where order_id = p_order_id and shoe_sourcing_status = 'refund';
  v_refund := v_deposit - v_late_fee - v_damage_fee + v_shoe_refund;

  v_result := case when v_lost then 'lost'
                   when v_broken then case when p_severity = 'major' then 'major_damage' else 'minor_damage' end
                   else 'no_damage' end;

  if p_image_paths is not null and cardinality(p_image_paths) > 0 then
    insert into public.order_evidence (order_id, stage, image_paths, checklist, note, created_by)
    values (p_order_id, 'return_received', p_image_paths, coalesce(p_checklist, '[]'::jsonb), p_note, auth.uid())
    on conflict (order_id, stage) do update
      set image_paths = excluded.image_paths, checklist = excluded.checklist,
          note = excluded.note, created_by = excluded.created_by, created_at = now();
  end if;

  delete from public.order_deductions where order_id = p_order_id;
  if v_late_fee > 0 then
    insert into public.order_deductions (order_id, type, amount, note, created_by)
    values (p_order_id, 'late_return', v_late_fee,
            'คืนช้า ' || v_late_days || ' วัน × ' || coalesce(v_fee_day, 100)::int || ' บาท', auth.uid());
  end if;
  if v_lost then
    insert into public.order_deductions (order_id, order_item_id, type, amount, note, created_by)
    select p_order_id, nullif(e->>'order_item_id', '')::uuid, 'lost', v_deposit,
           coalesce(nullif(e->>'note', ''), 'ไม่ได้รับชุดคืน'), auth.uid()
    from jsonb_array_elements(p_deductions) e where e->>'type' = 'lost' limit 1;
  else
    insert into public.order_deductions (order_id, order_item_id, type, amount, note, created_by)
    select p_order_id, nullif(e->>'order_item_id', '')::uuid, e->>'type', (e->>'amount')::numeric,
           nullif(e->>'note', ''), auth.uid()
    from jsonb_array_elements(p_deductions) e;
  end if;

  perform set_config('cosmate.status_reason',
    'ตรวจคืน · ' || v_result || case when p_return_method = 'walk_in' and not v_lost then ' · นำมาคืนที่ร้าน' else '' end
    || ' · หัก ' || (v_late_fee + v_damage_fee)::int || ' บาท'
    || case when v_shoe_refund > 0 then ' · คืนค่ารองเท้า ' || v_shoe_refund::int || ' บาท' else '' end, true);
  update public.orders set
    inspection_result = v_result,
    late_fee          = v_late_fee,
    damage_fee        = v_damage_fee,
    refund_amount     = v_refund,
    refund_status     = case when v_refund > 0 then 'pending' else null end,
    return_method     = case when v_lost then null else p_return_method end,
    status            = 'completed'
  where id = p_order_id;

  if v_lost or v_broken then
    for v_item in
      select distinct oi.product_item_id
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.product_item_id is not null
        and (
          not exists (select 1 from jsonb_array_elements(p_deductions) e
                      where e->>'type' in ('damage', 'missing_part', 'lost') and nullif(e->>'order_item_id', '') is not null)
          or exists (select 1 from jsonb_array_elements(p_deductions) e
                     where e->>'type' in ('damage', 'missing_part', 'lost') and nullif(e->>'order_item_id', '')::uuid = oi.id)
        )
    loop
      perform public.admin_set_item_condition(v_item.product_item_id, case when v_lost then 'retired' else 'damaged' end);
    end loop;
  end if;

  if v_lost then
    update public.profiles set trust_level = 'blacklisted' where id = v_order.user_id;
  end if;

  return jsonb_build_object(
    'late_days', v_late_days, 'late_fee', v_late_fee, 'damage_fee', v_damage_fee,
    'refund_amount', v_refund, 'shoe_refund', v_shoe_refund, 'inspection_result', v_result);
end $function$;
