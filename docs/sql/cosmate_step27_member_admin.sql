-- =====================================================================
-- CosMate Step 27: แอดมินจัดการบัญชีสมาชิก (ระงับ / แบล็กลิสต์ / ปลด · โน้ตภายในร้าน)
-- ---------------------------------------------------------------------
--   · ระงับชั่วคราว = profiles.status 'suspended' · แบล็กลิสต์ = profiles.trust_level 'blacklisted'
--     (create_booking เช็กสองช่องนี้อยู่แล้ว → จองไม่ได้ ข้อความ ACCOUNT_NOT_ALLOWED)
--   · ทุกครั้งต้องใส่เหตุผล และเก็บประวัติใน member_access_log (ใคร ทำอะไร เมื่อไหร่)
--   · โน้ตภายในแยกเป็นตาราง member_notes — ห้ามเก็บใน profiles เพราะลูกค้าอ่านแถวของตัวเองได้
--   · ออเดอร์เดิมของลูกค้าไม่ถูกยกเลิกอัตโนมัติ แอดมินจัดการเองในหน้าออเดอร์
--
-- รันหลัง Step 25 · รันซ้ำได้
-- =====================================================================

-- 0) ถ้า status / trust_level เป็น enum ให้แน่ใจว่ามีค่าที่ใช้ ----------------
do $$
declare
  r record;
begin
  for r in
    select a.attname, format('%I.%I', n.nspname, t.typname) as type_name
      from pg_attribute a
      join pg_type t on t.oid = a.atttypid
      join pg_namespace n on n.oid = t.typnamespace
     where a.attrelid = 'public.profiles'::regclass
       and a.attname in ('status', 'trust_level')
       and t.typtype = 'e'
  loop
    if r.attname = 'status' then
      execute format('alter type %s add value if not exists %L', r.type_name, 'active');
      execute format('alter type %s add value if not exists %L', r.type_name, 'suspended');
    else
      execute format('alter type %s add value if not exists %L', r.type_name, 'blacklisted');
    end if;
  end loop;
end $$;


-- 1) ตาราง (อ่านได้เฉพาะแอดมิน · เขียนผ่านฟังก์ชันด้านล่างเท่านั้น) -----------
create table if not exists public.member_notes (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  note       text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.member_access_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  admin_id   uuid references public.profiles (id) on delete set null,
  action     text not null check (action in ('suspend', 'blacklist', 'reactivate')),
  reason     text not null,
  created_at timestamptz not null default now()
);
create index if not exists member_access_log_user_idx on public.member_access_log (user_id, created_at desc);

alter table public.member_notes enable row level security;
alter table public.member_access_log enable row level security;

drop policy if exists member_notes_admin_read on public.member_notes;
create policy member_notes_admin_read on public.member_notes for select using (public.is_admin());

drop policy if exists member_access_log_admin_read on public.member_access_log;
create policy member_access_log_admin_read on public.member_access_log for select using (public.is_admin());


-- 2) ระงับ / แบล็กลิสต์ / เปิดใช้งาน ----------------------------------------
--   reactivate = กลับมาใช้งานได้ทั้งหมด (status active + ล้างแบล็กลิสต์เป็นค่าเริ่มต้นของคอลัมน์)
create or replace function public.admin_set_member_access(p_user_id uuid, p_action text, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_action not in ('suspend', 'blacklist', 'reactivate') then raise exception 'INVALID_MEMBER_ACTION'; end if;
  if char_length(v_reason) < 3 then raise exception 'MEMBER_REASON_REQUIRED'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'MEMBER_NOT_FOUND'; end if;

  if p_action = 'suspend' then
    update public.profiles set status = 'suspended' where id = p_user_id;
  elsif p_action = 'blacklist' then
    update public.profiles set trust_level = 'blacklisted' where id = p_user_id;
  else
    update public.profiles set status = 'active' where id = p_user_id;
    update public.profiles set trust_level = default where id = p_user_id and trust_level = 'blacklisted';
  end if;

  insert into public.member_access_log (user_id, admin_id, action, reason)
  values (p_user_id, auth.uid(), p_action, left(v_reason, 300));
end $function$;

revoke all on function public.admin_set_member_access(uuid, text, text) from public, anon;
grant execute on function public.admin_set_member_access(uuid, text, text) to authenticated;


-- 3) โน้ตภายในร้าน (ข้อความว่าง = ลบโน้ต) ----------------------------------
create or replace function public.admin_set_member_note(p_user_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_note text := btrim(coalesce(p_note, ''));
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'MEMBER_NOT_FOUND'; end if;

  if v_note = '' then
    delete from public.member_notes where user_id = p_user_id;
  else
    insert into public.member_notes (user_id, note, updated_at, updated_by)
    values (p_user_id, left(v_note, 2000), now(), auth.uid())
    on conflict (user_id) do update
      set note = excluded.note, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;
end $function$;

revoke all on function public.admin_set_member_note(uuid, text) from public, anon;
grant execute on function public.admin_set_member_note(uuid, text) to authenticated;


-- ตรวจผล: ต้องได้ 2 ตาราง และ 2 ฟังก์ชัน
select to_regclass('public.member_notes')      as member_notes,
       to_regclass('public.member_access_log') as member_access_log,
       to_regprocedure('public.admin_set_member_access(uuid, text, text)') as set_access,
       to_regprocedure('public.admin_set_member_note(uuid, text)')         as set_note;
