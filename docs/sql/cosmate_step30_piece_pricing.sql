-- =====================================================================
-- CosMate Step 30: ราคาเช่าแยกชิ้นตามระดับชิ้น + ลดตามช่วงอายุของชุดจริง
-- ---------------------------------------------------------------------
-- สเปก: docs/deposit-pricing-spec.md (ส่วน "เช่าแยกชิ้น")
--
-- ราคาชิ้น
--   · แอดมินเลือกระดับชิ้น product_inclusions.price_weight: หลัก 3 / รอง 2 / เสริม 1
--   · สามแบบ (ไม่เพิ่มคอลัมน์สถานะ)
--       ตามระบบ    = rental_price มีค่า + price_weight มีค่า (rental_price เป็นแค่ค่าสำรอง: ราคาในช่วงราคาปกติ)
--       กำหนดเอง   = rental_price มีค่า + price_weight ว่าง → ราคาตายตัว รวมรองเท้าที่มากับชุด
--       ไม่เปิดเช่า = rental_price ว่าง · price_weight ที่ใส่ไว้ยังนับในสัดส่วนของชุด
--   · ราคาชิ้นตามระบบ = (ค่าเช่าเต็มชุดของตัวที่ได้ − ผลรวมชิ้นราคาตายตัว) × ระดับชิ้น ÷ ระดับรวม × piece_price_markup_percent %
--     ปัดขึ้นตาม piece_price_round ขั้นต่ำ piece_price_min → ลดเองตามช่วงของชุดจริง และทำงานกับล็อกราคา/ชุดไม่มีต้นทุน
--   · ยอดแยกชิ้นไม่เกินค่าเช่าทั้งชุดของตัวนั้น (ไม่ได้ติ๊กรองเท้า = ไม่เกินค่าเช่าทั้งชุดแบบไม่รับรองเท้า)
--
-- การนับรอบ
--   · ช่วงชุดเก่าดูรอบการใช้งาน: เช่าทั้งชุด = 1 · แยกชิ้น = ยอดชิ้น ÷ ค่าเช่าเต็มชุด ณ ตอนจอง (order_items.round_weight)
--   · unit_completed_rentals ยังนับจำนวนครั้งที่เช่าจริงเหมือนเดิม (round_no / สถิติ)
--   · รายการก่อน Step 30 นับ 1 รอบตามเดิม จึงไม่มีตัวไหนเปลี่ยนช่วงทันทีที่รันไฟล์นี้
--
-- รันหลัง Step 29 · รันซ้ำได้
-- =====================================================================


-- 1) คอลัมน์ + ค่าตั้ง -------------------------------------------------------

alter table public.product_inclusions
  add column if not exists price_weight smallint;

alter table public.product_inclusions drop constraint if exists product_inclusions_price_weight_check;
alter table public.product_inclusions
  add constraint product_inclusions_price_weight_check
  check (price_weight is null or price_weight in (1, 2, 3));

alter table public.order_items
  add column if not exists round_weight numeric not null default 1;

insert into public.app_settings (key, value) values
  ('piece_price_markup_percent', '120'::jsonb),
  ('piece_price_min', '100'::jsonb),
  ('piece_price_round', '10'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_piece_price_settings()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'markup_percent', coalesce((select (s.value #>> '{}')::numeric from public.app_settings s where s.key = 'piece_price_markup_percent'), 120),
    'min_price',      coalesce((select (s.value #>> '{}')::numeric from public.app_settings s where s.key = 'piece_price_min'), 100),
    'round_to',       coalesce((select nullif((s.value #>> '{}')::numeric, 0) from public.app_settings s where s.key = 'piece_price_round'), 10)
  );
$function$;

grant execute on function public.get_piece_price_settings() to anon, authenticated;


-- 2) ราคาชิ้น --------------------------------------------------------------
-- ต้องตรงกับ piecePrices() / capPiecesTotal() ใน utils/customer/rentalPrice.ts

-- ราคาชิ้นที่เปิดเช่าแยกทุกชิ้น เมื่อค่าเช่าเต็มชุดของตัวที่ได้ = p_unit_price
create or replace function public.piece_prices(p_product_id uuid, p_unit_price numeric)
returns table (inclusion_id uuid, price numeric)
language sql
stable
security definer
set search_path to ''
as $function$
  with cfg as (
    select (s ->> 'markup_percent')::numeric as pct, (s ->> 'min_price')::numeric as min_price, (s ->> 'round_to')::numeric as round_to
    from public.get_piece_price_settings() s
  ),
  sums as (
    select coalesce(sum(pi.price_weight), 0) as weight,
           coalesce(sum(pi.rental_price) filter (where pi.price_weight is null), 0) as fixed
    from public.product_inclusions pi
    where pi.product_id = p_product_id
  )
  select pi.id,
         case when pi.price_weight is null then pi.rental_price
              else greatest(
                cfg.min_price,
                ceil(greatest(p_unit_price - sums.fixed, 0) * pi.price_weight * cfg.pct / (sums.weight * 100 * cfg.round_to)) * cfg.round_to
              )
         end
  from public.product_inclusions pi, cfg, sums
  where pi.product_id = p_product_id
    and pi.rental_price is not null;
$function$;

-- ค่าเช่าวันแรกของชิ้นที่เลือก: ผลรวมราคาชิ้น ไม่เกินค่าเช่าทั้งชุดของตัวนั้น
-- ไม่ได้ติ๊กรองเท้า = เพดานคือค่าเช่าทั้งชุดแบบไม่รับรองเท้า · ราคารองเท้าสูงกว่าค่าเช่าชุด = ใช้ค่าเช่าเต็มชุดแทน กันยอดเป็นศูนย์
create or replace function public.pieces_rent(p_product_id uuid, p_unit_price numeric, p_piece_ids text[])
returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_total numeric;
  v_shoe  numeric;
  v_cap   numeric;
begin
  select coalesce(sum(pp.price), 0) into v_total
  from public.piece_prices(p_product_id, p_unit_price) pp
  where pp.inclusion_id::text = any (p_piece_ids);

  select coalesce(max(pi.rental_price), 0) into v_shoe
  from public.product_inclusions pi
  where pi.product_id = p_product_id
    and pi.shoe_product_id is not null
    and not (pi.id::text = any (p_piece_ids));

  if p_unit_price <= 0 then
    return v_total;
  end if;
  v_cap := case when p_unit_price - v_shoe > 0 then p_unit_price - v_shoe else p_unit_price end;
  return least(v_total, v_cap);
end $function$;

revoke all on function public.piece_prices(uuid, numeric) from public, anon, authenticated;
revoke all on function public.pieces_rent(uuid, numeric, text[]) from public, anon, authenticated;


-- 3) แอดมินบันทึกระดับชิ้น (คัดลอกจาก Step 19 เพิ่ม price_weight) ---------------

create or replace function public.admin_set_inclusion_prices(p_product_id uuid, p_prices jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r      jsonb;
  v_shoe uuid;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  for r in select * from jsonb_array_elements(p_prices) loop
    v_shoe := nullif(r ->> 'shoe_product_id', '')::uuid;
    if v_shoe is not null then
      if v_shoe = p_product_id
         or not exists (select 1 from public.products where id = v_shoe and size_system = 'shoes') then
        raise exception 'INVALID_SHOE_PRODUCT';
      end if;
      -- ราคานี้ใช้ทั้งเช่าแยกชิ้น และหักออกตอนลูกค้าไม่รับรองเท้า จึงห้ามว่าง
      if nullif(r ->> 'price', '') is null then
        raise exception 'SHOE_PRICE_REQUIRED';
      end if;
    end if;

    update public.product_inclusions
       set rental_price    = nullif(r ->> 'price', '')::numeric,
           laundry_fee     = nullif(r ->> 'laundry_fee', '')::numeric,
           shoe_product_id = v_shoe,
           -- รองเท้าเป็นราคาตายตัวเสมอ เพราะเป็นส่วนลดตอนไม่รับรองเท้าด้วย
           price_weight    = case when v_shoe is null then nullif(r ->> 'price_weight', '')::smallint end
     where product_id = p_product_id
       and display_order = (r ->> 'display_order')::int;
  end loop;
end $function$;


-- 4) ช่วงชุดเก่านับรอบการใช้งาน ------------------------------------------------

-- รอบการใช้งานของชุดจริงตัวนี้: เช่าแยกชิ้นนับตามสัดส่วนยอดเช่า (เงื่อนไขเดียวกับ unit_completed_rentals)
create or replace function public.unit_wear_rounds(p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(sum(oi.round_weight), 0)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.product_item_id = p_item_id
    and o.status = 'completed'
    and not exists (
      select 1 from public.order_deductions d
      where d.order_id = o.id and d.type = 'lost'
        and (d.order_item_id is null or d.order_item_id = oi.id)
    );
$function$;

revoke all on function public.unit_wear_rounds(uuid) from public, anon, authenticated;

-- คัดลอกจาก Step 25 ส่วนที่เปลี่ยน: ช่วงชุดเก่าดู unit_wear_rounds แทน unit_completed_rentals
create or replace function public.unit_phase(p_item_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_cost      numeric;
  v_locked    boolean;
  v_lock      text;
  v_settings  jsonb := public.get_price_phase_settings();
begin
  select p.cost_price, p.price_locked, pi.locked_phase
    into v_cost, v_locked, v_lock
  from public.product_items pi
  join public.product_variants pv on pv.id = pi.variant_id
  join public.products p on p.id = pv.product_id
  where pi.id = p_item_id;

  if v_locked then
    return coalesce(v_lock, 'new');
  end if;
  if (v_settings ->> 'old_enabled')::boolean
     and public.unit_wear_rounds(p_item_id) >= (v_settings ->> 'old_after')::int then
    return 'old';
  end if;
  if v_cost is null or public.unit_rental_income(p_item_id) >= v_cost then
    return 'normal';
  end if;
  return 'new';
end $function$;

revoke all on function public.unit_phase(uuid) from public, anon, authenticated;

-- สถิติรายตัว: เพิ่มรอบการใช้งาน
drop function if exists public.admin_unit_rental_stats(uuid);
create function public.admin_unit_rental_stats(p_product_id uuid)
returns table (item_id uuid, completed_rentals int, wear_rounds numeric, rental_income numeric, phase text, next_price numeric, next_deposit numeric)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query
  select pi.id, public.unit_completed_rentals(pi.id), public.unit_wear_rounds(pi.id), public.unit_rental_income(pi.id),
         public.unit_phase(pi.id), public.unit_price(pi.id), public.unit_deposit(pi.id)
  from public.product_items pi
  join public.product_variants pv on pv.id = pi.variant_id
  where pv.product_id = p_product_id;
end $function$;

grant execute on function public.admin_unit_rental_stats(uuid) to authenticated;


-- 5) quote_lines (คัดลอกจาก Step 25) ส่วนที่เปลี่ยน: ยอดแยกชิ้นคิดตามตัวที่จะได้ ใช้หามัดจำ ---------
-- หน้าเว็บคำนวณราคาชิ้นเองจาก price ของรายการด้วยสูตรเดียวกัน (utils/customer/rentalPrice.ts)

create or replace function public.quote_lines(p_items jsonb, p_delivery_method text default 'ship')
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
  v_line    jsonb;
  v_result  jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then
    return '[]'::jsonb;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line := null;
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
        v_line := jsonb_build_object('price', v_unit.price, 'deposit', v_unit.deposit, 'phase', v_unit.phase);

        if jsonb_typeof(v_item -> 'pieces') = 'array' and jsonb_array_length(v_item -> 'pieces') > 0 then
          v_pieces := public.pieces_rent(
            v_variant.product_id, v_unit.price,
            array(select jsonb_array_elements_text(v_item -> 'pieces')));
          v_line := v_line || jsonb_build_object('deposit', public.pieces_deposit(v_unit.deposit, v_pieces));
        end if;
        exit;
      end loop;
    end if;

    v_result := v_result || jsonb_build_array(coalesce(v_line, 'null'::jsonb));
  end loop;
  return v_result;
end $function$;

grant execute on function public.quote_lines(jsonb, text) to anon, authenticated;


-- 6) create_booking (คัดลอกจาก Step 29) ส่วนที่เปลี่ยน ------------------------
--   · ราคาชิ้น ค่าวันเพิ่มแยกชิ้น และ snapshot ใน pieces คิดตามตัวที่ได้ในลูปเลือกตัว
--   · ยอดแยกชิ้นใช้ pieces_rent() · เก็บ round_weight
--   · ค่ารองเท้าที่ต้องคืน (shoe_sourcing_amount) ยังเป็น rental_price ของแถวรองเท้าเหมือนเดิม

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
