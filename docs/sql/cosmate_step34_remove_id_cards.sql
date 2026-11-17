-- =====================================================================
-- CosMate Step 34: เลิกใช้การยืนยันตัวตนด้วยรูปบัตรประชาชน
-- ---------------------------------------------------------------------
-- เช่าครั้งแรกไม่ต้องส่งรูปบัตรและไม่ต้องรอร้านตรวจ → จองแล้วชำระได้ทันทีเหมือนลูกค้าเดิม
--
--   · create_booking (คัดลอกจาก Step 30) ส่วนที่เปลี่ยน: ตัดการเช็ก customer_id_cards
--     ออเดอร์ใหม่เป็น pending_payment เสมอ · ไม่ตั้ง id_review_expires_at
--   · ออเดอร์ awaiting_id ที่ค้างอยู่ → pending_payment ชำระภายใน 24 ชม. (ไม่เกินเส้นตายออเดอร์)
--     เหลือเวลาไม่ถึง 30 นาที → หมดอายุและปล่อยวัน (กติกาเดียวกับตอนแอดมินอนุมัติบัตรใน Step 25)
--   · หยุด pg_cron cosmate-expire-awaiting-id · ถอนสิทธิ์ฟังก์ชันฝั่งลูกค้า/แอดมินของบัตร
--   · ไม่ลบตาราง customer_id_cards, bucket id-cards และค่า enum awaiting_id (Postgres ลบค่า enum ไม่ได้)
--     route /api/cron/id-card-cleanup ยังลบรูปบัตร verified ที่ไม่ได้ใช้เกิน 1 ปีตามเดิม
--
-- รันหลัง Step 33 · รันซ้ำได้
-- =====================================================================


-- 1) ออเดอร์ที่รอตรวจบัตรอยู่ ----------------------------------------------

do $$
declare
  v_order    record;
  v_deadline timestamptz;
begin
  for v_order in
    select o.id from public.orders o where o.status::text = 'awaiting_id' for update
  loop
    v_deadline := least(now() + interval '24 hours', public.order_handover_deadline(v_order.id));
    if v_deadline < now() + interval '30 minutes' then
      perform public.close_awaiting_order(v_order.id, 'expired', 'เหลือเวลาไม่พอให้ชำระก่อนวันส่งชุด ระบบปล่อยชุดให้คนอื่นจองแล้ว');
    else
      update public.orders
         set status = 'pending_payment', payment_expires_at = v_deadline, id_review_expires_at = null
       where id = v_order.id;
    end if;
  end loop;
end $$;


-- 2) หยุดงานและฟังก์ชันของการตรวจบัตร ------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'cosmate-expire-awaiting-id') then
    perform cron.unschedule('cosmate-expire-awaiting-id');
  end if;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.submit_my_id_card(boolean)',
    'public.delete_my_id_card()',
    'public.cancel_my_awaiting_order(uuid)',
    'public.admin_order_id_card(uuid)',
    'public.admin_review_id_card(uuid, boolean, text)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
    end if;
  end loop;
end $$;

-- อัปโหลดรูปบัตรใหม่ไม่ได้อีก
drop policy if exists id_cards_insert_own on storage.objects;
drop policy if exists id_cards_update_own on storage.objects;


-- 3) create_booking ---------------------------------------------------------

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
  v_piece_ids    text[];
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
  v_round_weight  numeric;
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
    order_number, user_id, status, delivery_method, ship_carrier,
    ship_name, ship_phone, ship_address, ship_subdistrict, ship_district,
    ship_province, ship_postal_code, customer_note
  ) values (
    v_order_no, v_uid,
    'pending_payment',
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
      v_piece_ids := array(select jsonb_array_elements_text(v_req_pieces));

      -- ราคาชิ้นขึ้นกับตัวที่ได้ คิดในลูปเลือกตัวด้านล่าง
      select count(*), coalesce(sum(coalesce(pi.laundry_fee, 0)), 0)
        into v_piece_count, v_item_laundry
      from public.product_inclusions pi
      where pi.product_id = v_variant.product_id
        and pi.rental_price is not null
        and pi.id::text = any (v_piece_ids);

      if v_piece_count <> v_req_count then
        raise exception 'INVALID_PIECES';
      end if;

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
        v_base_rental := public.pieces_rent(v_variant.product_id, v_unit_price, v_piece_ids);
        select jsonb_agg(jsonb_build_object(
                 'id', pi.id, 'name', pi.name,
                 'rental_price', pp.price, 'laundry_fee', coalesce(pi.laundry_fee, 0))
               order by pi.display_order)
          into v_piece_rows
        from public.product_inclusions pi
        join public.piece_prices(v_variant.product_id, v_unit_price) pp on pp.inclusion_id = pi.id
        where pi.id::text = any (v_piece_ids);
        v_day_rate     := ceil(least(v_base_rental * v_piece_pct / 100.0, v_extra_rate));
        v_item_deposit := public.pieces_deposit(v_unit_deposit, v_base_rental);
        v_round_weight := case when v_unit_price > 0 then round(least(v_base_rental / v_unit_price, 1), 2) else 1 end;
      else
        v_base_rental  := greatest(v_unit_price - v_shoe_cut, 0);
        v_item_deposit := v_unit_deposit;
        v_round_weight := 1;
      end if;
      v_extra_fee   := (v_days - 1) * v_day_rate;
      v_item_rental := v_base_rental + v_extra_fee;
      begin
        insert into public.order_items (
          order_id, variant_id, product_item_id,
          start_date, end_date, blocked_during,
          rental_price, deposit_amount, laundry_fee, pieces,
          rental_days, base_rental_price, extra_day_rate, extra_days_fee, round_no, price_phase, round_weight
        ) values (
          v_order_id, v_variant.id, v_unit,
          v_start, v_end, v_range,
          v_item_rental, v_item_deposit, v_item_laundry, v_piece_rows,
          v_days, v_base_rental, v_day_rate, v_extra_fee, public.unit_completed_rentals(v_unit) + 1, v_unit_phase, v_round_weight
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

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_no,
    'grand_total', v_grand,
    'status', 'pending_payment'
  );
end $function$;
