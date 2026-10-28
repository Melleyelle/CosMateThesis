-- =====================================================================
-- CosMate Step 23: วันส่งคืน = วันถัดจากวันใช้งานวันสุดท้าย
-- ---------------------------------------------------------------------
-- เช่า N วัน = ใส่ N วัน แล้วส่งคืนภายในวันถัดไป
--   เช่า 1 วัน ใส่วันที่ 23 → ได้รับชุดวันที่ 22 · ส่งคืนภายในวันที่ 24 · ส่งวันที่ 25 = คืนช้า
-- เดิม: end_date = start + days − 1 (เช่า 1 วัน ต้องส่งคืนวันที่ใส่)
-- ใหม่: end_date = start + days     (order_items.end_date คือ "ส่งคืนภายใน" ตามที่หน้าเว็บแสดงอยู่แล้ว)
-- ช่วงล็อกชุด = [start − buffer_before, end_date + buffer_after] → ยาวขึ้น 1 วันตามวันส่งคืน
--
-- ฟังก์ชันที่เปลี่ยน (คัดลอกจากเวอร์ชันล่าสุด แก้แค่สูตรวันคืน):
--   · get_unavailable_start_dates (จาก Step 19)
--   · quote_deposits              (จาก Step 21)
--   · create_booking              (จาก Step 21)
-- ออเดอร์ที่จองไปแล้วไม่ถูกแก้ (ยังใช้วันคืนตามที่ตกลงตอนจอง)
--
-- รันหลัง Step 22 · รันซ้ำได้
-- =====================================================================


-- 0) check constraint วันคืน ---------------------------------------------
-- ของเดิมบังคับ end_date = start_date + rental_days − 1 (สร้างไว้ใน Supabase ไม่อยู่ใน repo)
-- รับทั้งสองสูตร: ออเดอร์เก่ายังเป็นแบบเดิม และ Postgres ตรวจ check ซ้ำทุกครั้งที่ update แถว
-- ถ้ารับแค่สูตรใหม่ การเปลี่ยนสถานะออเดอร์เก่าจะพัง

alter table public.order_items drop constraint if exists order_items_end_matches_days;
alter table public.order_items add constraint order_items_end_matches_days
  check (rental_days is null or end_date in (start_date + rental_days - 1, start_date + rental_days));


-- 1) get_unavailable_start_dates ----------------------------------------

create or replace function public.get_unavailable_start_dates(
  p_variant_id uuid,
  p_days_ahead integer default 180,
  p_rental_days integer default 1,
  p_delivery_method text default 'ship'::text,
  p_shoe_variant_id uuid default null
)
returns setof date
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_min int := coalesce(public.setting_int('min_rental_days'), 1);
  v_max int := coalesce(public.setting_int('max_rental_days'), 10);
begin
  if p_rental_days is null or p_rental_days < v_min or p_rental_days > v_max then
    raise exception 'INVALID_RENTAL_DAYS';
  end if;
  if p_delivery_method is null or p_delivery_method not in ('ship', 'pickup') then
    raise exception 'INVALID_DELIVERY_METHOD';
  end if;

  return query
  with cfg as (
    select case when p_delivery_method = 'pickup' then 0
                else public.setting_int('buffer_days_before') end as b,
           public.setting_int('buffer_days_after') as a,
           public.earliest_start_date(p_delivery_method) as earliest,
           (now() at time zone 'Asia/Bangkok')::date as today
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = p_variant_id and p.status = 'active'
  )
  select (cfg.today + g)::date
  from cfg, generate_series(0, least(p_days_ahead, 365)) as g
  where
    (cfg.today + g) < cfg.earliest
    or (cfg.today + g) + p_rental_days > cfg.today + 120
    or not exists (
      select 1
      from public.product_items pi
      where pi.variant_id = p_variant_id
        and pi.condition_status = 'available'
        and not exists (
          select 1
          from public.order_items oi
          where oi.product_item_id = pi.id
            and oi.is_blocking
            and oi.blocked_during && daterange(
                  (cfg.today + g) - cfg.b,
                  (cfg.today + g) + p_rental_days + cfg.a,
                  '[]')
        )
    )
    -- เลือกไซส์รองเท้ามาด้วย → รองเท้าไซส์นั้นต้องมีคู่ว่างในช่วงเดียวกันด้วย
    or (
      p_shoe_variant_id is not null
      and not exists (
        select 1
        from public.product_items pi
        where pi.variant_id = p_shoe_variant_id
          and pi.condition_status = 'available'
          and not exists (
            select 1
            from public.order_items oi
            where oi.product_item_id = pi.id
              and oi.is_blocking
              and oi.blocked_during && daterange(
                    (cfg.today + g) - cfg.b,
                    (cfg.today + g) + p_rental_days + cfg.a,
                    '[]')
          )
      )
    );
end $function$;


-- 2) quote_deposits -----------------------------------------------------

create or replace function public.quote_deposits(p_items jsonb, p_delivery_method text default 'ship')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_before  int := case when p_delivery_method = 'pickup' then 0 else public.setting_int('buffer_days_before') end;
  v_after   int := public.setting_int('buffer_days_after');
  v_item    jsonb;
  v_variant public.product_variants%rowtype;
  v_start   date;
  v_days    int;
  v_range   daterange;
  v_unit    record;
  v_taken   jsonb := '[]'::jsonb; -- [{item, from, to}] ตัวที่รายการก่อนหน้าในตะกร้าจองไปแล้ว
  v_pieces  numeric;
  v_deposit numeric;
  v_result  jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then
    return '[]'::jsonb;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_deposit := null;
    v_start := null;
    begin
      select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
      v_start := (v_item ->> 'start_date')::date;
      v_days  := greatest(coalesce((v_item ->> 'rental_days')::int, 1), 1);
    exception when others then
      v_variant := null;
    end;

    if v_variant.id is not null and v_start is not null then
      v_range := daterange(v_start - v_before, v_start + v_days + v_after, '[]');
      for v_unit in select * from public.free_units(v_variant.id, v_range) loop
        continue when exists (
          select 1 from jsonb_array_elements(v_taken) t
          where (t ->> 'item')::uuid = v_unit.item_id
            and daterange((t ->> 'from')::date, (t ->> 'to')::date, '[]') && v_range
        );
        v_taken := v_taken || jsonb_build_object('item', v_unit.item_id, 'from', lower(v_range), 'to', upper(v_range) - 1);
        v_deposit := v_unit.deposit;

        if jsonb_typeof(v_item -> 'pieces') = 'array' and jsonb_array_length(v_item -> 'pieces') > 0 then
          select coalesce(sum(pi.rental_price), 0) into v_pieces
          from public.product_inclusions pi
          where pi.product_id = v_variant.product_id
            and pi.rental_price is not null
            and pi.id::text in (select x from jsonb_array_elements_text(v_item -> 'pieces') x);
          v_deposit := public.piece_deposit(v_deposit, v_variant.package_price, v_pieces);
        end if;
        exit;
      end loop;
    end if;

    v_result := v_result || coalesce(to_jsonb(v_deposit), 'null'::jsonb);
  end loop;
  return v_result;
end $function$;


-- 3) create_booking -----------------------------------------------------

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

  -- มัดจำตามตัว (Step 21)
  v_is_pieces     boolean;
  v_unit_deposit  numeric;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.status <> 'active' or v_profile.trust_level = 'blacklisted' then
    raise exception 'ACCOUNT_NOT_ALLOWED';
  end if;

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
       where o.user_id = v_uid and o.status = 'pending_payment') >= v_max_pend then
    raise exception 'TOO_MANY_PENDING_ORDERS';
  end if;

  v_order_no := 'CM'
    || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDD')
    || lpad(nextval('public.order_number_seq')::text, 4, '0');

  insert into public.orders (
    order_number, user_id, delivery_method, ship_carrier,
    ship_name, ship_phone, ship_address, ship_subdistrict, ship_district,
    ship_province, ship_postal_code, customer_note
  ) values (
    v_order_no, v_uid, v_delivery, v_carrier,
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

    v_req_pieces := v_item -> 'pieces';
    v_is_pieces := jsonb_typeof(v_req_pieces) = 'array' and jsonb_array_length(v_req_pieces) > 0;
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
      v_base_rental  := v_variant.package_price;
      v_item_laundry := v_variant.laundry_fee;
      v_day_rate     := v_extra_rate;

      -- ทั้งชุด: ส่งไซส์รองเท้ามา = รับรองเท้า · ไม่ส่ง = ไม่รับ หักราคารองเท้าออก (มัดจำเท่าเดิม)
      v_wants_shoe := v_shoe_inc_id is not null and v_shoe_req is not null;
      if v_shoe_inc_id is not null and v_shoe_req is null then
        v_base_rental := greatest(v_base_rental - v_shoe_price, 0);
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

    v_extra_fee   := (v_days - 1) * v_day_rate;
    v_item_rental := v_base_rental + v_extra_fee;

    v_start := (v_item ->> 'start_date')::date;
    if v_start < v_earliest then
      raise exception 'START_DATE_TOO_SOON';
    end if;

    v_end := v_start + v_days;
    if v_end > v_today + v_window then
      raise exception 'DATE_UNAVAILABLE';
    end if;
    v_range := daterange(v_start - v_before, v_end + v_after, '[]');

    -- ตัวที่มัดจำถูกสุดก่อน · มัดจำล็อกตามตัวที่ได้ (แยกชิ้นคิดสัดส่วนจากราคาทั้งชุดของไซส์)
    v_inserted := false;
    for v_unit, v_unit_deposit in
      select f.item_id, f.deposit from public.free_units(v_variant.id, v_range) f
    loop
      v_item_deposit := case
        when v_is_pieces then public.piece_deposit(v_unit_deposit, v_variant.package_price, v_base_rental)
        else v_unit_deposit
      end;
      begin
        insert into public.order_items (
          order_id, variant_id, product_item_id,
          start_date, end_date, blocked_during,
          rental_price, deposit_amount, laundry_fee, pieces,
          rental_days, base_rental_price, extra_day_rate, extra_days_fee, round_no
        ) values (
          v_order_id, v_variant.id, v_unit,
          v_start, v_end, v_range,
          v_item_rental, v_item_deposit, v_item_laundry, v_piece_rows,
          v_days, v_base_rental, v_day_rate, v_extra_fee, public.unit_completed_rentals(v_unit) + 1
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

      if not v_inserted then
        raise exception 'SHOE_UNAVAILABLE';
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

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_no,
    'grand_total', v_grand
  );
end $function$;
