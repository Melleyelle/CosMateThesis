-- =====================================================================
-- CosMate Step 28: เร่งความเร็วการดึงข้อมูล (index + RLS) — ไม่เปลี่ยนข้อมูลหรือสิทธิ์ใด ๆ
-- ---------------------------------------------------------------------
--   · ไฟล์ Step 1–18 ไม่ได้อยู่ใน repo จึงตรวจโครงสร้างจริงในฐานข้อมูลแล้วปรับเฉพาะที่ขาด
--   1) foreign key ที่ยังไม่มี index → สร้างให้ (join order_items ↔ orders, variants ↔ products ...)
--   2) index สำหรับคอลัมน์ที่หน้าเว็บกรอง/เรียงบ่อย (สร้างเฉพาะเมื่อตารางและคอลัมน์มีอยู่จริง)
--   3) RLS: auth.uid() / is_admin() ที่เรียกตรง ๆ ถูกคำนวณใหม่ทุกแถว
--      → ห่อเป็น (select ...) ให้ Postgres คำนวณครั้งเดียวต่อ query · เงื่อนไขสิทธิ์เหมือนเดิมทุกประการ
--   4) is_admin() ที่ประกาศเป็น volatile → stable (อ่านอย่างเดียว ไม่เปลี่ยนผล)
--   ผลลัพธ์ท้ายไฟล์แสดงรายการที่เปลี่ยน · รันซ้ำได้ (รอบสองจะไม่มีอะไรเปลี่ยน)
--
-- รันหลัง Step 27
-- =====================================================================

begin;

drop table if exists pg_temp.step28_log;
create temp table step28_log (kind text, detail text);

-- 1) index ให้ foreign key ทุกตัวใน public ที่ยังไม่มี index ขึ้นต้นด้วยคอลัมน์ชุดเดียวกัน ----------
do $$
declare
  r record;
  idx_name text;
begin
  for r in
    select c.conrelid::regclass as tbl,
           cl.relname as table_name,
           array_agg(a.attname order by k.ord) as cols
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.contype = 'f'
       and n.nspname = 'public'
       and not exists (
         select 1
           from pg_index i
          where i.indrelid = c.conrelid
            and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] = c.conkey
       )
     group by c.oid, c.conrelid, cl.relname
  loop
    idx_name := left(r.table_name || '_' || array_to_string(r.cols, '_'), 55) || '_fk_idx';
    execute format(
      'create index if not exists %I on %s (%s)',
      idx_name, r.tbl,
      (select string_agg(quote_ident(col), ', ') from unnest(r.cols) as col)
    );
    insert into step28_log values ('index (foreign key)', format('%s (%s)', r.tbl, array_to_string(r.cols, ', ')));
  end loop;
end $$;

-- 2) index ตามการกรอง/เรียงของหน้าเว็บ -----------------------------------------------------
--    รูปแบบ: 'ตาราง|คอลัมน์, คอลัมน์ desc' — ข้ามถ้าไม่มีตาราง/คอลัมน์ หรือมี index ชุดเดียวกันแล้ว
do $$
declare
  spec text;
  tbl text;
  col_list text;
  cols text[];
  idx_name text;
begin
  foreach spec in array array[
    'orders|user_id, created_at desc',          -- ออเดอร์ของฉัน / ประวัติสมาชิก
    'orders|created_at desc',                   -- รายการออเดอร์หลังร้าน
    'orders|status',                            -- ตัวเลขงานค้างบนเมนูหลังร้าน
    'products|status, created_at desc',         -- หน้ารวมชุด
    'product_reviews|product_id, created_at desc',
    'events|is_published, start_date',
    'event_photos|event_id, created_at desc',
    'event_interests|user_id',
    'order_status_history|order_id, changed_at',
    'order_deductions|created_at'
  ]
  loop
    tbl := split_part(spec, '|', 1);
    col_list := split_part(spec, '|', 2);
    cols := array(select split_part(trim(c), ' ', 1) from unnest(string_to_array(col_list, ',')) as c);

    continue when to_regclass(format('public.%I', tbl)) is null;
    continue when exists (
      select 1 from unnest(cols) as c
       where not exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = tbl and column_name = c
       )
    );

    idx_name := left(tbl || '_' || array_to_string(cols, '_'), 59) || '_idx';
    continue when to_regclass(format('public.%I', idx_name)) is not null;

    execute format('create index %I on public.%I (%s)', idx_name, tbl, col_list);
    insert into step28_log values ('index (filter)', format('%s (%s)', tbl, col_list));
  end loop;
end $$;

-- 3) RLS: ห่อ auth.uid() / auth.jwt() / auth.role() / is_admin() ด้วย (select ...) -------------
--    เฉพาะ policy ในสคีมา public (storage.objects เป็นของ Supabase ไม่แตะ)
--    lookbehind กันการห่อซ้ำ: Postgres เก็บแบบห่อแล้วเป็น "( SELECT auth.uid() AS uid)"
create or replace function pg_temp.step28_wrap(expr text) returns text
language sql immutable as $$
  select regexp_replace(
           regexp_replace(expr, '(?<!SELECT )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g'),
           '(?<!SELECT )(?<!\.)(public\.)?is_admin\(\)', '(select public.is_admin())', 'g')
$$;

do $$
declare
  p record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for p in select * from pg_policies where schemaname = 'public'
  loop
    new_qual := pg_temp.step28_wrap(p.qual);
    new_check := pg_temp.step28_wrap(p.with_check);
    continue when new_qual is not distinct from p.qual and new_check is not distinct from p.with_check;

    stmt := format('alter policy %I on public.%I', p.policyname, p.tablename);
    if new_qual is not null then stmt := stmt || format(' using (%s)', new_qual); end if;
    if new_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
    insert into step28_log values ('rls policy', format('%s.%s', p.tablename, p.policyname));
  end loop;
end $$;

-- 4) is_admin() ไม่ได้แก้ข้อมูล → stable ให้ planner ใช้ผลซ้ำได้ ------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'is_admin' and p.pronargs = 0 and p.provolatile = 'v'
  ) then
    alter function public.is_admin() stable;
    insert into step28_log values ('function', 'public.is_admin() → stable');
  end if;
end $$;

-- อัปเดตสถิติให้ planner เห็น index ใหม่ทันที
analyze;

-- ผลลัพธ์: รายการที่เปลี่ยนในรอบนี้ (ว่าง = ทุกอย่างถูกปรับไว้แล้ว)
select kind, detail from step28_log order by kind, detail;

commit;
