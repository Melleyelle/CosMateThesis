-- =====================================================================
-- CosMate Step 21: ค่าเช่าตามต้นทุน 5 เทียร์ + มัดจำชุดใหม่ลดลงตามรอบ
-- ---------------------------------------------------------------------
-- สเปก: docs/deposit-pricing-spec.md
--   · แอดมินกรอกต้นทุนชุด (products.cost_price) → ได้เทียร์ → หน้าฟอร์มเสนอค่าเช่า 40% ของต้นทุน
--   · มัดจำคิดราย "ชุดจริงแต่ละตัว" (product_items): รอบ 1–4 ใช้ rental_tiers.deposit_new, รอบ 5+ ใช้ deposit_normal
--   · รอบ = จำนวนครั้งที่ตัวนั้นถูกเช่าแล้วออเดอร์ "เสร็จสิ้น" (ตรวจรับคืนแล้ว) + 1 · ไม่นับรายการที่ถูกหัก "สูญหาย"
--     นับสดจาก order_items ทุกครั้ง ไม่มีตัวนับให้เพี้ยน และออเดอร์เก่านับย้อนหลังให้เอง
--   · ไม่มีต้นทุน / ต้นทุนนอกช่วง 600–2,500 = ใช้มัดจำที่กรอกเองในไซส์ (product_variants.deposit_amount) แบบเดิม
--   · products.deposit_override = มัดจำที่แอดมินกำหนดเอง ใช้แทนทุกรอบ
--   · เช่าแยกชิ้น: มัดจำ = มัดจำทั้งชุดของตัวนั้น × (ราคาชิ้นรวม ÷ ราคาทั้งชุด) ปัดขึ้นหลัก 50 ไม่เกินมัดจำทั้งชุด
--   · ตอนจอง ระบบเลือกตัวที่มัดจำถูกที่สุดก่อน (ตัวที่ผ่านมาหลายรอบ) และบันทึกมัดจำ/รอบไว้ในรายการ ไม่ย้อนแก้
--
-- รันหลัง Step 20 · รันซ้ำได้
-- =====================================================================

-- 1) ตารางเทียร์ ---------------------------------------------------------

create table if not exists public.rental_tiers (
  tier_id        int primary key,
  cost_min       numeric not null,
  cost_max       numeric not null,
  rent_min       numeric not null,
  rent_max       numeric not null,
  deposit_new    numeric[] not null check (array_length(deposit_new, 1) = 4), -- มัดจำรอบ 1–4
  deposit_normal numeric not null,                                             -- รอบ 5 ขึ้นไป
  check (cost_min <= cost_max and rent_min <= rent_max)
);

insert into public.rental_tiers (tier_id, cost_min, cost_max, rent_min, rent_max, deposit_new, deposit_normal) values
  (1,  600,  850, 250,  350, array[ 500,  400, 300, 200], 100),
  (2,  851, 1250, 400,  500, array[ 750,  600, 450, 300], 150),
  (3, 1251, 1600, 550,  650, array[ 950,  750, 550, 350], 200),
  (4, 1601, 2000, 700,  800, array[1200,  950, 700, 450], 250),
  (5, 2001, 2500, 850, 1000, array[1500, 1200, 900, 600], 300)
on conflict (tier_id) do update
  set cost_min = excluded.cost_min, cost_max = excluded.cost_max,
      rent_min = excluded.rent_min, rent_max = excluded.rent_max,
      deposit_new = excluded.deposit_new, deposit_normal = excluded.deposit_normal;

alter table public.rental_tiers enable row level security;
drop policy if exists rental_tiers_read on public.rental_tiers;
create policy rental_tiers_read on public.rental_tiers for select using (true);
grant select on public.rental_tiers to anon, authenticated;


-- 2) คอลัมน์ใหม่ ---------------------------------------------------------

alter table public.products
  add column if not exists cost_price numeric check (cost_price is null or cost_price >= 0),
  add column if not exists deposit_override numeric check (deposit_override is null or deposit_override >= 0);

-- รอบที่ของชุดจริงตัวนั้น ณ ตอนจอง (null = รายการก่อน Step 21 / รองเท้าที่มากับชุด)
alter table public.order_items
  add column if not exists round_no int;


-- 3) ตัวช่วยคำนวณ (ใช้ภายใน ไม่เปิดให้เรียกตรง) -------------------------

-- จำนวนครั้งที่ชุดจริงตัวนี้ถูกเช่าและคืนสำเร็จ
create or replace function public.unit_completed_rentals(p_item_id uuid)
returns int
language sql
stable
security definer
set search_path to ''
as $function$
  select count(distinct oi.order_id)::int
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

-- ค่าเช่าสะสมจากรอบที่คืนสำเร็จ (ใช้ดูว่าคืนทุนหรือยัง)
create or replace function public.unit_rental_income(p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(sum(oi.rental_price), 0)
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

-- มัดจำเช่าทั้งชุดของชุดจริงตัวนี้ ณ ตอนนี้
create or replace function public.unit_deposit(p_item_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_cost     numeric;
  v_override numeric;
  v_manual   numeric;
  v_tier     public.rental_tiers%rowtype;
  v_round    int;
begin
  select p.cost_price, p.deposit_override, pv.deposit_amount
    into v_cost, v_override, v_manual
  from public.product_items pi
  join public.product_variants pv on pv.id = pi.variant_id
  join public.products p on p.id = pv.product_id
  where pi.id = p_item_id;

  if v_override is not null then
    return v_override;
  end if;

  select * into v_tier from public.rental_tiers t
  where v_cost between t.cost_min and t.cost_max;
  if not found then
    return coalesce(v_manual, 0);
  end if;

  v_round := public.unit_completed_rentals(p_item_id) + 1;
  return case when v_round <= 4 then v_tier.deposit_new[v_round] else v_tier.deposit_normal end;
end $function$;

-- มัดจำเช่าแยกชิ้น: สัดส่วนจากมัดจำทั้งชุด ปัดขึ้นหลัก 50 ไม่เกินมัดจำทั้งชุด
create or replace function public.piece_deposit(p_full numeric, p_set_price numeric, p_pieces_total numeric)
returns numeric
language sql
immutable
set search_path to ''
as $function$
  select case
    when coalesce(p_set_price, 0) <= 0 then p_full
    else least(p_full, ceil(p_full * p_pieces_total / p_set_price / 50) * 50)
  end;
$function$;

-- ชุดจริงที่ว่างในช่วงล็อกนี้ เรียงตัวที่มัดจำถูกที่สุดก่อน (create_booking และ quote_deposits ใช้ลำดับเดียวกัน)
create or replace function public.free_units(p_variant_id uuid, p_range daterange)
returns table (item_id uuid, deposit numeric)
language sql
stable
security definer
set search_path to ''
as $function$
  select pi.id, public.unit_deposit(pi.id)
  from public.product_items pi
  where pi.variant_id = p_variant_id
    and pi.condition_status = 'available'
    and not exists (
      select 1 from public.order_items oi
      where oi.product_item_id = pi.id
        and oi.is_blocking
        and oi.blocked_during && p_range
    )
  order by 2, pi.item_code;
$function$;

revoke all on function public.unit_completed_rentals(uuid) from public, anon, authenticated;
revoke all on function public.unit_rental_income(uuid) from public, anon, authenticated;
revoke all on function public.unit_deposit(uuid) from public, anon, authenticated;
revoke all on function public.free_units(uuid, daterange) from public, anon, authenticated;


-- 4) หน้าเว็บ: ประเมินมัดจำก่อนจอง -------------------------------------
-- p_items เหมือน create_booking: [{variant_id, start_date, rental_days, pieces?}]
-- คืน array มัดจำตามลำดับรายการ · null = ช่วงนั้นไม่มีตัวว่าง / ข้อมูลไม่ครบ
-- รายการในชุดเดียวกันที่ช่วงทับกันจะได้คนละตัว เหมือนตอนจองจริง

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
      v_range := daterange(v_start - v_before, v_start + v_days - 1 + v_after, '[]');
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

grant execute on function public.quote_deposits(jsonb, text) to anon, authenticated;

-- มัดจำต่ำสุด–สูงสุดของตัวที่พร้อมเช่าในแต่ละไซส์ (แสดงก่อนลูกค้าเลือกวัน)
create or replace function public.variant_deposit_ranges(p_variant_ids uuid[])
returns table (variant_id uuid, min_deposit numeric, max_deposit numeric)
language sql
stable
security definer
set search_path to ''
as $function$
  select pi.variant_id, min(public.unit_deposit(pi.id)), max(public.unit_deposit(pi.id))
  from public.product_items pi
  where pi.variant_id = any (p_variant_ids)
    and pi.condition_status = 'available'
  group by pi.variant_id;
$function$;

grant execute on function public.variant_deposit_ranges(uuid[]) to anon, authenticated;


-- 5) แอดมิน -------------------------------------------------------------

-- บันทึกต้นทุน/มัดจำกำหนดเอง หลัง create_costume / update_costume (สองตัวนั้นไม่รู้จักคอลัมน์ใหม่)
create or replace function public.admin_set_product_pricing(p_product_id uuid, p_cost_price numeric, p_deposit_override numeric)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if coalesce(p_cost_price, 0) < 0 or coalesce(p_deposit_override, 0) < 0 then
    raise exception 'INVALID_PRICING';
  end if;
  update public.products
     set cost_price = p_cost_price,
         deposit_override = p_deposit_override
   where id = p_product_id;
end $function$;

grant execute on function public.admin_set_product_pricing(uuid, numeric, numeric) to authenticated;

-- สถิติรายตัวสำหรับหน้าแก้ไขชุด: เช่าสำเร็จกี่รอบ ค่าเช่าสะสม มัดจำรอบถัดไป
create or replace function public.admin_unit_rental_stats(p_product_id uuid)
returns table (item_id uuid, completed_rentals int, rental_income numeric, next_deposit numeric)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query
  select pi.id, public.unit_completed_rentals(pi.id), public.unit_rental_income(pi.id), public.unit_deposit(pi.id)
  from public.product_items pi
  join public.product_variants pv on pv.id = pi.variant_id
  where pv.product_id = p_product_id;
end $function$;

grant execute on function public.admin_unit_rental_stats(uuid) to authenticated;


-- 6) create_booking: มัดจำตามตัวที่ได้ ----------------------------------
-- signature เดิมจาก Step 20 · ส่วนที่เปลี่ยน:
--   · หาตัวว่างด้วย free_units() (มัดจำถูกสุดก่อน) แทนเรียงตามรหัส
--   · มัดจำคิดหลังได้ตัวแล้ว: ทั้งชุด = unit_deposit · แยกชิ้น = piece_deposit (เลิกใช้ deposit_for_rental)
--   · บันทึก round_no

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

    v_end := v_start + v_days - 1;
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
