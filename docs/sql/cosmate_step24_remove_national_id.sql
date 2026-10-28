-- =====================================================================
-- CosMate Step 24: เอาเลขบัตรประชาชนออกจากระบบ
-- ---------------------------------------------------------------------
-- หน้าเว็บเลิกเก็บเลขบัตรแล้ว แต่ฐานข้อมูลยังมี trigger orders_guard_identity
-- (BEFORE INSERT ON orders) ที่บังคับว่าต้องมีแถวใน customer_identity
-- → ลูกค้าที่ไม่มีเลขบัตรจองไม่ได้ create_booking ตอบ 400 'NATIONAL_ID_REQUIRED'
--
-- การแบนยังทำงานเหมือนเดิมผ่าน profiles.trust_level = 'blacklisted'
-- (create_booking เช็คอยู่แล้ว)
--
-- รันหลัง Step 23 · รันซ้ำได้
-- =====================================================================


-- 1) trigger ที่ทำให้จองไม่ได้ -------------------------------------------

drop trigger if exists orders_guard_identity on public.orders;
drop function if exists public.guard_order_identity();


-- 2) ฟังก์ชันแอดมินที่อ่าน/แบนด้วยเลขบัตร (หน้าเว็บไม่ได้เรียกแล้ว) -------------

drop function if exists public.admin_member_identities();
drop function if exists public.admin_ban_member(uuid, text);
drop function if exists public.admin_unban_member(uuid);


-- 3) ตารางเก็บเลขบัตร (hash + 4 ตัวท้าย) ----------------------------------
-- ลบข้อมูลถาวร กู้คืนไม่ได้ · เอาคอมเมนต์ออกเมื่อแน่ใจว่าไม่ต้องใช้แล้ว

-- drop table if exists public.banned_national_ids;
-- drop table if exists public.customer_identity;
