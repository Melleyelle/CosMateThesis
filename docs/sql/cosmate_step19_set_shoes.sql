-- =====================================================================
-- CosMate Step 19: รองเท้าที่มากับชุด (เช่าครบเซ็ต)
-- ---------------------------------------------------------------------
-- แนวคิด: รองเท้าอัปโหลดเป็นสินค้ารองเท้า (size_system = 'shoes') ตามปกติ ให้เช่าแยกได้เอง
-- แล้วชุดชี้ไปหารองเท้านั้นผ่าน "สิ่งที่รวมอยู่ในชุด" หนึ่งรายการ (product_inclusions.shoe_product_id)
-- → รองเท้าคู่จริงมีที่เดียวในคลัง จองซ้อนกันไม่ได้ ไม่ว่าจะเช่าแยกหรือเช่ามากับชุด
--
-- ตอนจอง: ชุด 1 รายการ + รองเท้า 1 รายการลูก (order_items.parent_item_id) ราคา 0 เพราะรวมในราคาชุดแล้ว
--   · เช่าทั้งชุด + เลือกไซส์รองเท้า  = ราคาไซส์ชุดเต็ม
--   · เช่าทั้งชุด + ไม่รับรองเท้า     = ราคาไซส์ชุด − ราคาแยกชิ้นของรายการรองเท้า (มัดจำเท่าเดิม)
--   · เช่าแยกชิ้น + ติ๊กรองเท้า       = ราคาชิ้นตามปกติ + ต้องเลือกไซส์รองเท้า
--
-- รันหลัง Step 18 · รันซ้ำได้
-- =====================================================================

-- 1) คอลัมน์ใหม่ ---------------------------------------------------------

alter table public.product_inclusions
  add column if not exists shoe_product_id uuid references public.products(id) on delete set null;

-- ชุดหนึ่งมีรายการรองเท้าได้รายการเดียว
create unique index if not exists product_inclusions_one_shoe_per_product
  on public.product_inclusions (product_id)
  where shoe_product_id is not null;

alter table public.order_items
  add column if not exists parent_item_id uuid references public.order_items(id) on delete cascade;

create index if not exists order_items_parent_item_id_idx
  on public.order_items (parent_item_id);


-- 2) admin_set_inclusion_prices: บันทึกรองเท้าที่ผูกไว้ไปพร้อมราคา ----------
-- (create_costume / update_costume บันทึกชิ้นส่วนตามลำดับในฟอร์ม แล้วฟังก์ชันนี้จับคู่ด้วย display_order)

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
           shoe_product_id = v_shoe
     where product_id = p_product_id
       and display_order = (r ->> 'display_order')::int;
  end loop;
end $function$;


-- 3) get_unavailable_start_dates: เพิ่ม p_shoe_variant_id ---------------
-- ต้องลบตัวเดิมก่อน ไม่อย่างนั้นจะมีสองเวอร์ชันและเรียกแบบ 4 พารามิเตอร์แล้วกำกวม

drop function if exists public.get_unavailable_start_dates(uuid, integer, integer, text);

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
    or (cfg.today + g) + p_rental_days - 1 > cfg.today + 120
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
                  (cfg.today + g) + p_rental_days - 1 + cfg.a,
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
                    (cfg.today + g) + p_rental_days - 1 + cfg.a,
                    '[]')
          )
      )
    );
end $function$;

grant execute on function public.get_unavailable_start_dates(uuid, integer, integer, text, uuid) to anon, authenticated;


-- 4) create_booking: จองรองเท้าคู่จริงไปพร้อมชุด --------------------------
-- รายการใน p_items รับ shoe_variant_id เพิ่ม (ไม่ส่ง = ไม่รับรองเท้า)

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
  p_delivery_method text default 'ship'::text
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
    order_number, user_id, delivery_method,
    ship_name, ship_phone, ship_address, ship_subdistrict, ship_district,
    ship_province, ship_postal_code, customer_note
  ) values (
    v_order_no, v_uid, v_delivery,
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
    if jsonb_typeof(v_req_pieces) = 'array' and jsonb_array_length(v_req_pieces) > 0 then
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
      v_item_deposit := public.deposit_for_rental(v_base_rental);
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
      v_item_deposit := v_variant.deposit_amount;
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

    v_inserted := false;
    for v_unit in
      select pi.id
      from public.product_items pi
      where pi.variant_id = v_variant.id
        and pi.condition_status = 'available'
      order by pi.item_code
    loop
      begin
        insert into public.order_items (
          order_id, variant_id, product_item_id,
          start_date, end_date, blocked_during,
          rental_price, deposit_amount, laundry_fee, pieces,
          rental_days, base_rental_price, extra_day_rate, extra_days_fee
        ) values (
          v_order_id, v_variant.id, v_unit,
          v_start, v_end, v_range,
          v_item_rental, v_item_deposit, v_item_laundry, v_piece_rows,
          v_days, v_base_rental, v_day_rate, v_extra_fee
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
