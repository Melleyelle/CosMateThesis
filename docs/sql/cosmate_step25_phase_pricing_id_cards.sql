-- =====================================================================
-- CosMate Step 25: ค่าเช่าตามช่วงอายุชุด + มัดจำตามตารางเดิม + ยืนยันตัวตนด้วยรูปบัตรประชาชน
-- ---------------------------------------------------------------------
-- สเปก: docs/deposit-pricing-spec.md (v2)
--
-- ค่าเช่า (แทน Step 21)
--   · ชุดหนึ่งมี 3 ราคา (products.price_new / price_normal / price_old) ใช้กับทุกไซส์ — เลิกตั้งราคาแยกไซส์
--   · ช่วงราคานับ "รายตัวจริง" (product_items) นับสดจากออเดอร์ที่เสร็จสิ้น เหมือน Step 21
--       new    = ค่าเช่าสะสม < ต้นทุน
--       normal = ค่าเช่าสะสม ≥ ต้นทุน (ไม่มีต้นทุน = normal)
--       old    = เช่าคืนสำเร็จครบ price_old_after_rentals รอบ (app_settings · ปิดได้ด้วย price_old_phase_enabled)
--   · products.price_locked = ไม่ปรับอัตโนมัติ: ตอนล็อกจำช่วงของแต่ละตัวไว้ที่ product_items.locked_phase
--   · product_variants.package_price / deposit_amount = ราคา/มัดจำของตัวที่ถูกที่สุดตอนนี้ ("เริ่มต้น")
--     ระบบอัปเดตให้เอง (refresh_display_prices) หน้ารายการชุดเดิมจึงแสดงถูกโดยไม่ต้องแก้
--
-- มัดจำ (แทน Step 21)
--   · ตาราง deposit_tiers ตามค่าเช่าเต็มชุดของตัวที่ได้ (ก่อนหักรองเท้า ไม่รวมค่าวันเพิ่ม)
--   · เช่าแยกชิ้น = มัดจำตามยอดชิ้นรวม ไม่เกินมัดจำทั้งชุด · ต่ำกว่าเทียร์แรก = มัดจำเทียร์แรก
--   · products.deposit_override ใช้แทนตารางได้เหมือนเดิม
--
-- ยืนยันตัวตน
--   · สมัครสมาชิกใช้แค่อีเมลเหมือนเดิม รูปบัตรขอก่อนเช่าครั้งแรก (หรืออัปโหลดล่วงหน้าในหน้าบัญชี)
--   · customer_id_cards: none → pending → verified / rejected · เก็บแค่รูป (bucket id-cards แบบส่วนตัว) ไม่เก็บเลขบัตร
--   · ลูกค้าที่ยังไม่ verified จองได้เมื่อส่งรูปแล้ว → ออเดอร์สถานะ awaiting_id กันวันไว้ ยังจ่ายไม่ได้
--       แอดมินอนุมัติ → pending_payment ชำระภายใน 24 ชม. · ไม่อนุมัติ → ยกเลิก ปล่อยวัน
--       awaiting_id / pending_payment เกิน 24 ชม. → หมดอายุ · วันรับชุดใกล้กว่า 48 ชม. → หดเวลาให้จบก่อนวันรับชุด
--   · ไฟล์ลบโดย route ฝั่งเซิร์ฟเวอร์ (Storage API) ไม่ใช่ SQL: ไม่อนุมัติ / ลูกค้าขอลบ / ไม่ได้เช่าเกิน 1 ปี
--
-- ส่วนที่ไม่รู้แน่ (SQL Step 1–18 ไม่อยู่ใน repo) เขียนให้ทนไว้:
--   · สถานะ awaiting_id: orders.status เป็น enum order_status_t → เพิ่มค่าใน Step 25a (ต้องรันก่อนไฟล์นี้)
--     ถ้ามี check constraint ที่มีรายการสถานะ (เช่นใน order_status_history) ก็แทรกให้ด้วย
--   · ปลดล็อกชุดเอง (order_items.is_blocking = false) ตอนยกเลิก/หมดอายุจาก awaiting_id
--   · pending_payment หมดอายุด้วย job เดิมของ Step 16 ที่อ่าน payment_expires_at
--
-- รันหลัง Step 25a · รันซ้ำได้
-- =====================================================================


-- 0) สถานะออเดอร์ awaiting_id ---------------------------------------------

do $$
declare
  v_type oid;
  r      record;
  v_def  text;
begin
  select a.atttypid into v_type
  from pg_attribute a
  where a.attrelid = 'public.orders'::regclass and a.attname = 'status';

  -- enum ต้องมี awaiting_id แล้ว (Step 25a)
  if exists (select 1 from pg_type t where t.oid = v_type and t.typtype = 'e')
     and not exists (select 1 from pg_enum e where e.enumtypid = v_type and e.enumlabel = 'awaiting_id') then
    raise exception 'ยังไม่มีสถานะ awaiting_id ใน % — รัน cosmate_step25a_awaiting_id_status.sql ก่อน', v_type::regtype;
  end if;

  -- check ที่มีรายการสถานะ (orders.status, order_status_history ฯลฯ) → แทรก awaiting_id หน้า pending_payment
  for r in
    select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%''pending_payment''%'
      and pg_get_constraintdef(c.oid) like '%''manual_review''%'
      and pg_get_constraintdef(c.oid) not like '%''awaiting_id''%'
  loop
    v_def := replace(r.def, '''pending_payment''::text', '''awaiting_id''::text, ''pending_payment''::text');
    if v_def = r.def then
      v_def := replace(r.def, '''pending_payment''', '''awaiting_id'', ''pending_payment''');
    end if;
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, v_def);
  end loop;
end $$;

-- เส้นตายที่ร้านต้องตรวจบัตรให้เสร็จ (null = ไม่ได้รอตรวจบัตร)
alter table public.orders
  add column if not exists id_review_expires_at timestamptz;


-- 1) ตารางมัดจำ (ตารางเดิมของร้าน) ---------------------------------------

create table if not exists public.deposit_tiers (
  rent_min numeric primary key,
  rent_max numeric not null,
  deposit  numeric not null check (deposit >= 0),
  check (rent_min <= rent_max)
);

insert into public.deposit_tiers (rent_min, rent_max, deposit) values
  ( 250,  500, 150),
  ( 501, 1000, 250),
  (1001, 1500, 400),
  (1501, 2000, 550),
  (2001, 2500, 700)
on conflict (rent_min) do update
  set rent_max = excluded.rent_max, deposit = excluded.deposit;

alter table public.deposit_tiers enable row level security;
drop policy if exists deposit_tiers_read on public.deposit_tiers;
create policy deposit_tiers_read on public.deposit_tiers for select using (true);
grant select on public.deposit_tiers to anon, authenticated;


-- 2) คอลัมน์ราคา + ค่าตั้ง ------------------------------------------------

alter table public.products
  add column if not exists price_new    numeric check (price_new    is null or price_new    >= 0),
  add column if not exists price_normal numeric check (price_normal is null or price_normal >= 0),
  add column if not exists price_old    numeric check (price_old    is null or price_old    >= 0),
  add column if not exists price_locked boolean not null default false;

-- ช่วงที่จำไว้ตอนล็อกราคา (null = ไม่ได้ล็อก / ตัวที่เพิ่มหลังล็อก = ชุดใหม่)
alter table public.product_items
  add column if not exists locked_phase text check (locked_phase is null or locked_phase in ('new', 'normal', 'old'));

-- ช่วงราคาของตัวนั้น ณ ตอนจอง (null = รายการก่อน Step 25 / รองเท้าที่มากับชุด)
alter table public.order_items
  add column if not exists price_phase text;

-- ชุดเดิม: ทั้ง 3 ช่วงใช้ราคาไซส์ที่แพงที่สุดที่ตั้งไว้ ราคาลูกค้าไม่เปลี่ยน (ยกเว้นไซส์ที่เคยถูกกว่า)
-- แอดมินกด "ใช้ราคาที่ระบบแนะนำ" ในหน้าแก้ไขชุดเมื่อพร้อมใช้ราคาตามช่วง
update public.products p
   set price_new    = coalesce(p.price_new, v.max_price),
       price_normal = coalesce(p.price_normal, v.max_price),
       price_old    = coalesce(p.price_old, v.max_price)
  from (select product_id, max(package_price) as max_price from public.product_variants group by product_id) v
 where v.product_id = p.id
   and (p.price_new is null or p.price_normal is null or p.price_old is null);

insert into public.app_settings (key, value) values
  ('price_old_phase_enabled', 'true'::jsonb),
  ('price_old_after_rentals', '10'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_price_phase_settings()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'old_enabled', coalesce((select (s.value #>> '{}')::boolean from public.app_settings s where s.key = 'price_old_phase_enabled'), true),
    'old_after',   coalesce((select (s.value #>> '{}')::int from public.app_settings s where s.key = 'price_old_after_rentals'), 10)
  );
$function$;

grant execute on function public.get_price_phase_settings() to anon, authenticated;

create or replace function public.admin_set_price_phase_settings(p_old_enabled boolean, p_old_after int)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_old_enabled is null or p_old_after is null or p_old_after < 1 or p_old_after > 100 then
    raise exception 'INVALID_PRICING';
  end if;
  insert into public.app_settings (key, value) values
    ('price_old_phase_enabled', to_jsonb(p_old_enabled)),
    ('price_old_after_rentals', to_jsonb(p_old_after))
  on conflict (key) do update set value = excluded.value;
  perform public.refresh_display_prices(p.id) from public.products p;
end $function$;

grant execute on function public.admin_set_price_phase_settings(boolean, int) to authenticated;


-- 3) ตัวช่วยคำนวณ ---------------------------------------------------------

-- มัดจำตามค่าเช่า: เทียร์ที่ rent_min ≤ ค่าเช่า สูงสุด · ต่ำกว่าเทียร์แรก = เทียร์แรก · เกินเทียร์สุดท้าย = เทียร์สุดท้าย
create or replace function public.deposit_for_rent(p_rent numeric)
returns numeric
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (select t.deposit from public.deposit_tiers t where t.rent_min <= p_rent order by t.rent_min desc limit 1),
    (select t.deposit from public.deposit_tiers t order by t.rent_min limit 1),
    0
  );
$function$;

grant execute on function public.deposit_for_rent(numeric) to anon, authenticated;

-- ช่วงราคาของชุดจริงตัวนี้ตอนนี้
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
     and public.unit_completed_rentals(p_item_id) >= (v_settings ->> 'old_after')::int then
    return 'old';
  end if;
  if v_cost is null or public.unit_rental_income(p_item_id) >= v_cost then
    return 'normal';
  end if;
  return 'new';
end $function$;

-- ค่าเช่าเต็มชุด (วันแรก) ของชุดจริงตัวนี้ตอนนี้ · ชุดที่ยังไม่มีราคาช่วง = ราคาไซส์เดิม
create or replace function public.unit_price(p_item_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_phase text := public.unit_phase(p_item_id);
  v_new    numeric;
  v_normal numeric;
  v_old    numeric;
  v_pkg    numeric;
begin
  select p.price_new, p.price_normal, p.price_old, pv.package_price
    into v_new, v_normal, v_old, v_pkg
  from public.product_items pi
  join public.product_variants pv on pv.id = pi.variant_id
  join public.products p on p.id = pv.product_id
  where pi.id = p_item_id;

  return coalesce(
    case v_phase when 'new' then v_new when 'old' then v_old else v_normal end,
    v_normal, v_pkg, 0
  );
end $function$;

-- มัดจำเช่าทั้งชุดของชุดจริงตัวนี้ตอนนี้ (แทนของ Step 21)
create or replace function public.unit_deposit(p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(p.deposit_override, public.deposit_for_rent(public.unit_price(p_item_id)))
  from public.product_items pi
  join public.product_variants pv on pv.id = pi.variant_id
  join public.products p on p.id = pv.product_id
  where pi.id = p_item_id;
$function$;

-- ชุดจริงที่ว่างในช่วงล็อกนี้ เรียงตัวที่ค่าเช่าถูกที่สุดก่อน แล้วมัดจำ (create_booking และ quote_lines ใช้ลำดับเดียวกัน)
drop function if exists public.free_units(uuid, daterange);
create function public.free_units(p_variant_id uuid, p_range daterange)
returns table (item_id uuid, price numeric, deposit numeric, phase text)
language sql
stable
security definer
set search_path to ''
as $function$
  select u.id, u.price, u.deposit, u.phase
  from (
    select pi.id, pi.item_code,
           public.unit_price(pi.id) as price,
           public.unit_deposit(pi.id) as deposit,
           public.unit_phase(pi.id) as phase
    from public.product_items pi
    where pi.variant_id = p_variant_id
      and pi.condition_status = 'available'
      and not exists (
        select 1 from public.order_items oi
        where oi.product_item_id = pi.id
          and oi.is_blocking
          and oi.blocked_during && p_range
      )
  ) u
  order by u.price, u.deposit, u.item_code;
$function$;

-- มัดจำเช่าแยกชิ้น: ตามยอดชิ้นรวม ไม่เกินมัดจำทั้งชุดของตัวนั้น
create or replace function public.pieces_deposit(p_full numeric, p_pieces_total numeric)
returns numeric
language sql
stable
security definer
set search_path to ''
as $function$
  select least(p_full, public.deposit_for_rent(p_pieces_total));
$function$;

revoke all on function public.unit_phase(uuid) from public, anon, authenticated;
revoke all on function public.unit_price(uuid) from public, anon, authenticated;
revoke all on function public.unit_deposit(uuid) from public, anon, authenticated;
revoke all on function public.free_units(uuid, daterange) from public, anon, authenticated;
revoke all on function public.pieces_deposit(numeric, numeric) from public, anon, authenticated;


-- 4) ราคา "เริ่มต้น" ที่เก็บในไซส์ ------------------------------------------
-- package_price / deposit_amount ของไซส์ = ตัวที่พร้อมเช่าและถูกที่สุด · ไม่มีตัวพร้อม = ราคาปกติ

create or replace function public.refresh_display_prices(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_variant  uuid;
  v_price    numeric;
  v_deposit  numeric;
  v_normal   numeric;
  v_override numeric;
begin
  select p.price_normal, p.deposit_override into v_normal, v_override
  from public.products p where p.id = p_product_id;

  for v_variant in select pv.id from public.product_variants pv where pv.product_id = p_product_id loop
    select u.price, u.deposit into v_price, v_deposit
    from (
      select public.unit_price(pi.id) as price, public.unit_deposit(pi.id) as deposit
      from public.product_items pi
      where pi.variant_id = v_variant and pi.condition_status = 'available'
    ) u
    order by u.price, u.deposit
    limit 1;

    if v_price is null and v_normal is not null then
      v_price := v_normal;
      v_deposit := coalesce(v_override, public.deposit_for_rent(v_normal));
    end if;

    if v_price is not null then
      update public.product_variants
         set package_price = v_price, deposit_amount = v_deposit
       where id = v_variant
         and (package_price, deposit_amount) is distinct from (v_price, v_deposit);
    end if;
  end loop;
end $function$;

revoke all on function public.refresh_display_prices(uuid) from public, anon, authenticated;

-- ออเดอร์เสร็จสิ้น (หรือถูกย้อนจากเสร็จสิ้น) → รอบ/ค่าเช่าสะสมเปลี่ยน → ราคาเริ่มต้นอาจเปลี่ยน
create or replace function public.orders_refresh_display_prices()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_product uuid;
begin
  if new.status is distinct from old.status and ('completed' in (new.status::text, old.status::text)) then
    for v_product in
      select distinct pv.product_id
      from public.order_items oi
      join public.product_variants pv on pv.id = oi.variant_id
      where oi.order_id = new.id
    loop
      perform public.refresh_display_prices(v_product);
    end loop;
  end if;
  return null;
end $function$;

drop trigger if exists orders_refresh_display_prices on public.orders;
create trigger orders_refresh_display_prices
  after update of status on public.orders
  for each row execute function public.orders_refresh_display_prices();

-- เพิ่ม/ปลดระวาง/ลบชุดจริง → ตัวที่ถูกที่สุดอาจเปลี่ยน
create or replace function public.items_refresh_display_prices()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_variant uuid := coalesce(new.variant_id, old.variant_id);
begin
  if tg_op = 'UPDATE' and new.condition_status is not distinct from old.condition_status then
    return null;
  end if;
  perform public.refresh_display_prices(pv.product_id)
  from public.product_variants pv where pv.id = v_variant;
  return null;
end $function$;

drop trigger if exists items_refresh_display_prices on public.product_items;
create trigger items_refresh_display_prices
  after insert or delete or update of condition_status on public.product_items
  for each row execute function public.items_refresh_display_prices();


-- 5) หน้าเว็บ: ราคา/มัดจำก่อนจอง -------------------------------------------
-- p_items เหมือน create_booking: [{variant_id, start_date, rental_days, pieces?}]
-- คืน array ตามลำดับรายการ: {price, deposit, phase} · null = ช่วงนั้นไม่มีตัวว่าง / ข้อมูลไม่ครบ
--   price = ค่าเช่าเต็มชุดวันแรกของตัวที่จะได้ (ก่อนหักรองเท้า) · เช่าแยกชิ้นหน้าเว็บคิดจากราคาชิ้นเอง
-- รายการในชุดเดียวกันที่ช่วงทับกันจะได้คนละตัว เหมือนตอนจองจริง

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
          select coalesce(sum(pi.rental_price), 0) into v_pieces
          from public.product_inclusions pi
          where pi.product_id = v_variant.product_id
            and pi.rental_price is not null
            and pi.id::text in (select x from jsonb_array_elements_text(v_item -> 'pieces') x);
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

-- ของเดิม (Step 21): array มัดจำอย่างเดียว ให้หน้าเว็บเวอร์ชันเก่าที่ยังเปิดค้างอยู่ใช้ต่อได้
create or replace function public.quote_deposits(p_items jsonb, p_delivery_method text default 'ship')
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    jsonb_agg(case when x.q = 'null'::jsonb then 'null'::jsonb else x.q -> 'deposit' end order by x.ord),
    '[]'::jsonb
  )
  from jsonb_array_elements(public.quote_lines(p_items, p_delivery_method)) with ordinality as x(q, ord);
$function$;

grant execute on function public.quote_deposits(jsonb, text) to anon, authenticated;

-- ค่าเช่า/มัดจำ ต่ำสุด–สูงสุดของตัวที่พร้อมเช่าในแต่ละไซส์ (แสดงก่อนลูกค้าเลือกวัน)
create or replace function public.variant_price_ranges(p_variant_ids uuid[])
returns table (variant_id uuid, min_price numeric, max_price numeric, min_deposit numeric, max_deposit numeric)
language sql
stable
security definer
set search_path to ''
as $function$
  select u.variant_id, min(u.price), max(u.price), min(u.deposit), max(u.deposit)
  from (
    select pi.variant_id, public.unit_price(pi.id) as price, public.unit_deposit(pi.id) as deposit
    from public.product_items pi
    where pi.variant_id = any (p_variant_ids)
      and pi.condition_status = 'available'
  ) u
  group by u.variant_id;
$function$;

grant execute on function public.variant_price_ranges(uuid[]) to anon, authenticated;


-- 6) แอดมิน: บันทึกราคา + สถิติรายตัว --------------------------------------

drop function if exists public.admin_set_product_pricing(uuid, numeric, numeric);

create or replace function public.admin_set_product_pricing(
  p_product_id uuid,
  p_cost_price numeric,
  p_deposit_override numeric,
  p_price_new numeric,
  p_price_normal numeric,
  p_price_old numeric,
  p_price_locked boolean default false
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_was_locked boolean;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_price_new is null or p_price_normal is null or p_price_old is null
     or least(coalesce(p_cost_price, 0), coalesce(p_deposit_override, 0), p_price_new, p_price_normal, p_price_old) < 0 then
    raise exception 'INVALID_PRICING';
  end if;

  select p.price_locked into v_was_locked from public.products p where p.id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  -- เริ่มล็อก: จำช่วงปัจจุบันของทุกตัว (คิดก่อนเปลี่ยนต้นทุน) · ปลดล็อก: ล้างที่จำไว้
  if p_price_locked and not v_was_locked then
    update public.product_items pi
       set locked_phase = public.unit_phase(pi.id)
      from public.product_variants pv
     where pv.id = pi.variant_id and pv.product_id = p_product_id;
  elsif not p_price_locked then
    update public.product_items pi
       set locked_phase = null
      from public.product_variants pv
     where pv.id = pi.variant_id and pv.product_id = p_product_id and pi.locked_phase is not null;
  end if;

  update public.products
     set cost_price = p_cost_price,
         deposit_override = p_deposit_override,
         price_new = p_price_new,
         price_normal = p_price_normal,
         price_old = p_price_old,
         price_locked = coalesce(p_price_locked, false)
   where id = p_product_id;

  perform public.refresh_display_prices(p_product_id);
end $function$;

grant execute on function public.admin_set_product_pricing(uuid, numeric, numeric, numeric, numeric, numeric, boolean) to authenticated;

-- สถิติรายตัวสำหรับหน้าแก้ไขชุด: เช่าสำเร็จกี่รอบ ค่าเช่าสะสม ช่วงราคา ค่าเช่า/มัดจำรอบถัดไป
drop function if exists public.admin_unit_rental_stats(uuid);
create function public.admin_unit_rental_stats(p_product_id uuid)
returns table (item_id uuid, completed_rentals int, rental_income numeric, phase text, next_price numeric, next_deposit numeric)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query
  select pi.id, public.unit_completed_rentals(pi.id), public.unit_rental_income(pi.id),
         public.unit_phase(pi.id), public.unit_price(pi.id), public.unit_deposit(pi.id)
  from public.product_items pi
  join public.product_variants pv on pv.id = pi.variant_id
  where pv.product_id = p_product_id;
end $function$;

grant execute on function public.admin_unit_rental_stats(uuid) to authenticated;


-- 7) บัตรประชาชน: ตาราง + ที่เก็บไฟล์ -------------------------------------

create table if not exists public.customer_id_cards (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  status        text not null default 'none' check (status in ('none', 'pending', 'verified', 'rejected')),
  file_path     text,          -- id-cards/<user id>/id-card.jpg · null = ไม่มีไฟล์
  consent_at    timestamptz,   -- เวลาที่ลูกค้ากดยินยอมตอนส่งรูป
  submitted_at  timestamptz,
  reviewed_at   timestamptz,
  reviewed_by   uuid,
  reject_reason text,
  verified_at   timestamptz,
  deleted_at    timestamptz    -- ลบไฟล์ครั้งล่าสุดเมื่อ
);

alter table public.customer_id_cards enable row level security;
drop policy if exists customer_id_cards_read on public.customer_id_cards;
create policy customer_id_cards_read on public.customer_id_cards
  for select using (user_id = auth.uid() or public.is_admin());
grant select on public.customer_id_cards to authenticated;
-- เขียนผ่านฟังก์ชันด้านล่างเท่านั้น (ลูกค้าตั้ง verified เองไม่ได้)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-cards', 'id-cards', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- อัปโหลด/ทับรูปได้เมื่อยังไม่ verified และไม่ถูกแบน
create or replace function public.can_upload_id_card()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select auth.uid() is not null
     and not exists (select 1 from public.customer_id_cards c where c.user_id = auth.uid() and c.status = 'verified')
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.trust_level = 'blacklisted');
$function$;

grant execute on function public.can_upload_id_card() to authenticated;

drop policy if exists id_cards_insert_own on storage.objects;
create policy id_cards_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text and public.can_upload_id_card());

drop policy if exists id_cards_update_own on storage.objects;
create policy id_cards_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text and public.can_upload_id_card())
  with check (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text and public.can_upload_id_card());

-- เจ้าของ (ต้องใช้ตอน upsert) และแอดมินเปิดดูได้ · ลบผ่าน route ฝั่งเซิร์ฟเวอร์เท่านั้น
drop policy if exists id_cards_select on storage.objects;
create policy id_cards_select on storage.objects
  for select to authenticated
  using (bucket_id = 'id-cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));


-- 8) บัตรประชาชน: ฝั่งลูกค้า ------------------------------------------------

-- หลังอัปโหลดรูปไปที่ id-cards/<user id>/id-card.jpg แล้ว → รอร้านตรวจ
create or replace function public.submit_my_id_card(p_consent boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid  uuid := auth.uid();
  v_path text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not coalesce(p_consent, false) then raise exception 'ID_CONSENT_REQUIRED'; end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.trust_level = 'blacklisted') then
    raise exception 'ACCOUNT_NOT_ALLOWED';
  end if;
  if exists (select 1 from public.customer_id_cards c where c.user_id = v_uid and c.status = 'verified') then
    raise exception 'ID_ALREADY_VERIFIED';
  end if;

  v_path := v_uid::text || '/id-card.jpg';
  if not exists (select 1 from storage.objects o where o.bucket_id = 'id-cards' and o.name = v_path) then
    raise exception 'ID_CARD_FILE_MISSING';
  end if;

  insert into public.customer_id_cards (user_id, status, file_path, consent_at, submitted_at)
  values (v_uid, 'pending', v_path, now(), now())
  on conflict (user_id) do update
    set status = 'pending', file_path = excluded.file_path, consent_at = now(), submitted_at = now(),
        reviewed_at = null, reviewed_by = null, reject_reason = null;
end $function$;

grant execute on function public.submit_my_id_card(boolean) to authenticated;

-- ลูกค้าขอลบรูปบัตร → คืน path ให้ route ลบไฟล์ · เก็บต่อถ้าถูกแบนหรือมีออเดอร์ที่ยังไม่จบ
create or replace function public.delete_my_id_card()
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid  uuid := auth.uid();
  v_path text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select c.file_path into v_path from public.customer_id_cards c where c.user_id = v_uid for update;
  if not found or v_path is null then return null; end if;

  if exists (select 1 from public.profiles p where p.id = v_uid and p.trust_level = 'blacklisted')
     or exists (
       select 1 from public.orders o
       where o.user_id = v_uid and o.status::text not in ('completed', 'expired', 'cancelled')
     ) then
    raise exception 'ID_CARD_IN_USE';
  end if;

  update public.customer_id_cards
     set status = 'none', file_path = null, consent_at = null, deleted_at = now(),
         verified_at = null, reject_reason = null
   where user_id = v_uid;
  return v_path;
end $function$;

grant execute on function public.delete_my_id_card() to authenticated;


-- 9) ออเดอร์ที่รอตรวจบัตร -------------------------------------------------

-- ปลดล็อกชุดของออเดอร์ (ทำซ้ำกับระบบเดิมได้ไม่เสียหาย) · ข้ามถ้า is_blocking เป็นคอลัมน์คำนวณ
create or replace function public.release_order_units(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'order_items'
      and c.column_name = 'is_blocking' and c.is_generated = 'NEVER'
  ) then
    update public.order_items set is_blocking = false where order_id = p_order_id and is_blocking;
  end if;
end $function$;

-- เส้นตายของออเดอร์: เริ่มวันที่ร้านต้องส่งชุด (จัดส่ง) หรือวันรับชุด (รับเอง) เวลาไทย
create or replace function public.order_handover_deadline(p_order_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path to ''
as $function$
  select ((min(oi.start_date)
           - case when o.delivery_method = 'pickup' then 0
                  else coalesce(public.setting_int('buffer_days_before'), 0) + 1 end
          )::timestamp at time zone 'Asia/Bangkok')
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.id = p_order_id
  group by o.delivery_method;
$function$;

-- ปิดออเดอร์ awaiting_id (ยกเลิก/หมดอายุ) แล้วปล่อยวัน
create or replace function public.close_awaiting_order(p_order_id uuid, p_status text, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.orders
     set status = p_status::public.order_status_t, cancel_reason = p_reason, id_review_expires_at = null
   where id = p_order_id and status = 'awaiting_id';
  if found then
    perform public.release_order_units(p_order_id);
  end if;
end $function$;

revoke all on function public.release_order_units(uuid) from public, anon, authenticated;
revoke all on function public.order_handover_deadline(uuid) from public, anon, authenticated;
revoke all on function public.close_awaiting_order(uuid, text, text) from public, anon, authenticated;

-- pg_cron: ร้านตรวจบัตรไม่ทัน → หมดอายุ
create or replace function public.expire_awaiting_id_orders()
returns int
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id    uuid;
  v_count int := 0;
begin
  for v_id in
    select o.id from public.orders o
    where o.status = 'awaiting_id' and o.id_review_expires_at < now()
    for update skip locked
  loop
    perform public.close_awaiting_order(v_id, 'expired', 'ร้านตรวจบัตรประชาชนไม่ทันเวลา ระบบปล่อยชุดให้คนอื่นจองแล้ว');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $function$;

revoke all on function public.expire_awaiting_id_orders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'cosmate-expire-awaiting-id';
    perform cron.schedule('cosmate-expire-awaiting-id', '* * * * *', 'select public.expire_awaiting_id_orders()');
  else
    raise notice 'ไม่มี pg_cron: ออเดอร์ awaiting_id จะไม่หมดอายุเอง';
  end if;
end $$;

-- ลูกค้ายกเลิกเองระหว่างรอตรวจบัตร
create or replace function public.cancel_my_awaiting_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.user_id = auth.uid() and o.status = 'awaiting_id'
  ) then
    raise exception 'INVALID_TRANSITION';
  end if;
  perform public.close_awaiting_order(p_order_id, 'cancelled', 'ลูกค้ายกเลิกระหว่างรอตรวจบัตร');
end $function$;

grant execute on function public.cancel_my_awaiting_order(uuid) to authenticated;


-- 10) แอดมินตรวจบัตร ------------------------------------------------------

-- ข้อมูลบัตรของเจ้าของออเดอร์ (แผงขวาหน้าออเดอร์ ไม่มี user_id ในรายการ)
create or replace function public.admin_order_id_card(p_order_id uuid)
returns table (
  user_id uuid, status text, file_path text, submitted_at timestamptz,
  reject_reason text, id_review_expires_at timestamptz, handover_deadline timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query
  select o.user_id, coalesce(c.status, 'none'), c.file_path, c.submitted_at, c.reject_reason,
         o.id_review_expires_at, public.order_handover_deadline(o.id)
  from public.orders o
  left join public.customer_id_cards c on c.user_id = o.user_id
  where o.id = p_order_id;
end $function$;

grant execute on function public.admin_order_id_card(uuid) to authenticated;

-- อนุมัติ: ออเดอร์ awaiting_id ทุกใบของลูกค้า → pending_payment ชำระภายใน 24 ชม. (ไม่เกินเส้นตายออเดอร์)
-- ไม่อนุมัติ: ยกเลิกออเดอร์ awaiting_id ทุกใบ · คืน file_path ให้ route ลบไฟล์
-- คืน {approved, file_path, orders: [{id, order_number, status, payment_expires_at}]}
create or replace function public.admin_review_id_card(p_user_id uuid, p_approve boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_card     public.customer_id_cards%rowtype;
  v_order    record;
  v_deadline timestamptz;
  v_orders   jsonb := '[]'::jsonb;
  v_path     text;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  select * into v_card from public.customer_id_cards c where c.user_id = p_user_id for update;
  if not found or v_card.status <> 'pending' then raise exception 'ID_NOT_PENDING'; end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then raise exception 'ID_REJECT_REASON_REQUIRED'; end if;

  if p_approve then
    update public.customer_id_cards
       set status = 'verified', verified_at = now(), reviewed_at = now(), reviewed_by = auth.uid(), reject_reason = null
     where user_id = p_user_id;
  else
    v_path := v_card.file_path;
    update public.customer_id_cards
       set status = 'rejected', file_path = null, reviewed_at = now(), reviewed_by = auth.uid(),
           reject_reason = trim(p_reason), verified_at = null, deleted_at = now()
     where user_id = p_user_id;
  end if;

  for v_order in
    select o.id, o.order_number from public.orders o
    where o.user_id = p_user_id and o.status = 'awaiting_id'
    order by o.created_at
    for update
  loop
    if not p_approve then
      perform public.close_awaiting_order(v_order.id, 'cancelled', 'บัตรประชาชนไม่ผ่านการตรวจ: ' || trim(p_reason));
      v_orders := v_orders || jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number, 'status', 'cancelled');
      continue;
    end if;

    v_deadline := least(now() + interval '24 hours', public.order_handover_deadline(v_order.id));
    if v_deadline < now() + interval '30 minutes' then
      -- ตรวจเสร็จตอนเหลือเวลาไม่พอให้ชำระก่อนส่งชุด
      perform public.close_awaiting_order(v_order.id, 'expired', 'ตรวจบัตรเสร็จเมื่อใกล้วันรับชุดเกินไป ระบบปล่อยชุดให้คนอื่นจองแล้ว');
      v_orders := v_orders || jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number, 'status', 'expired');
    else
      update public.orders
         set status = 'pending_payment', payment_expires_at = v_deadline, id_review_expires_at = null
       where id = v_order.id;
      v_orders := v_orders || jsonb_build_object(
        'id', v_order.id, 'order_number', v_order.order_number,
        'status', 'pending_payment', 'payment_expires_at', v_deadline);
    end if;
  end loop;

  return jsonb_build_object('approved', p_approve, 'file_path', v_path, 'orders', v_orders);
end $function$;

grant execute on function public.admin_review_id_card(uuid, boolean, text) to authenticated;


-- 11) PDPA: ลบรูปบัตรที่ไม่ได้ใช้ (route /api/cron/id-card-cleanup เรียกทุกวันด้วย service role) -----
-- verified · ไม่ได้เช่าเกิน 1 ปี (นับจากวันคืนของออเดอร์ที่เสร็จสิ้นล่าสุด หรือวันยืนยันถ้ายังไม่เคยเช่า)
-- ไม่ถูกแบน · ไม่มีออเดอร์ที่ยังไม่จบ (ข้อพิพาท/รอคืนเงิน)

create or replace function public.id_cards_due_for_cleanup()
returns table (user_id uuid, file_path text)
language sql
stable
security definer
set search_path to ''
as $function$
  select c.user_id, c.file_path
  from public.customer_id_cards c
  left join public.profiles p on p.id = c.user_id
  where c.status = 'verified'
    and c.file_path is not null
    and p.trust_level is distinct from 'blacklisted'
    and not exists (
      select 1 from public.orders o
      where o.user_id = c.user_id and o.status::text not in ('completed', 'expired', 'cancelled')
    )
    and coalesce(
          (select max(oi.end_date)::timestamptz
           from public.orders o join public.order_items oi on oi.order_id = o.id
           where o.user_id = c.user_id and o.status = 'completed'),
          c.verified_at
        ) < now() - interval '1 year';
$function$;

create or replace function public.mark_id_cards_deleted(p_user_ids uuid[])
returns int
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count int;
begin
  update public.customer_id_cards
     set status = 'none', file_path = null, consent_at = null, verified_at = null, deleted_at = now()
   where user_id = any (p_user_ids) and status = 'verified';
  get diagnostics v_count = row_count;
  return v_count;
end $function$;

revoke all on function public.id_cards_due_for_cleanup() from public, anon, authenticated;
revoke all on function public.mark_id_cards_deleted(uuid[]) from public, anon, authenticated;
grant execute on function public.id_cards_due_for_cleanup() to service_role;
grant execute on function public.mark_id_cards_deleted(uuid[]) to service_role;


-- 12) create_booking ------------------------------------------------------
-- signature เดิมจาก Step 20 · คัดลอกจาก Step 23 ส่วนที่เปลี่ยน:
--   · ต้องมีรูปบัตร: verified = จ่ายได้เลย · pending = ออเดอร์ awaiting_id · none/rejected = ID_CARD_REQUIRED
--   · ค่าเช่าทั้งชุด = ราคาช่วงของตัวที่ได้ (unit_price) แทนราคาไซส์ · หาตัวว่างเรียงค่าเช่าถูกสุดก่อน
--   · มัดจำ: ทั้งชุด = unit_deposit (ตามค่าเช่าเต็มชุดก่อนหักรองเท้า) · แยกชิ้น = pieces_deposit
--   · บันทึก price_phase · นับออเดอร์ค้างรวม awaiting_id

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


-- 13) ราคาเริ่มต้นของทุกชุดตามกติกาใหม่ ------------------------------------

select public.refresh_display_prices(p.id) from public.products p;
