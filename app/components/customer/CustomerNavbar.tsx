'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HeartIcon,
  ReceiptIcon,
  ShoppingCartSimpleIcon,
  SignInIcon,
  SignOutIcon,
  StorefrontIcon,
  UserIcon,
} from '@phosphor-icons/react'
import { createClient } from '@/utils/client'
import { useCart } from '@/utils/customer/cart'
import { useFavorites } from '@/utils/customer/favorites'

const NAV_LINKS = [
  { href: '/', label: 'หน้าหลัก' },
  { href: '/costumes', label: 'สำรวจชุด' },
  { href: '/#how-it-works', label: 'วิธีการเช่า' },
]

export default function CustomerNavbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { items: cartItems } = useCart()
  const favorites = useFavorites()

  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setReady(true)
      return
    }

    async function load(userEmail: string | null) {
      setEmail(userEmail)
      if (userEmail && supabase) {
        const { data } = await supabase.rpc('is_admin')
        setIsAdmin(data === true)
      } else {
        setIsAdmin(false)
      }
      setReady(true)
    }

    supabase.auth.getUser().then(({ data }) => load(data.user?.email ?? null))

    // เรียก supabase ต่อใน callback ตรง ๆ จะค้างได้ (ข้อจำกัดของ supabase-js) จึงเลื่อนไปทำรอบถัดไป
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session?.user?.email ?? null), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // ปิดเมนูบัญชีเมื่อคลิกนอกกล่อง หรือเปลี่ยนหน้า
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase?.auth.signOut()
    setMenuOpen(false)
    router.replace('/')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href.includes('#')) return false
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  const iconButton =
    'relative flex h-10 w-10 items-center justify-center rounded-full text-[#263544] transition hover:bg-[#FDE3EE]'

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="CosMate หน้าหลัก" className="flex-shrink-0">
          <Image src="/images/logo.png" alt="CosMate" width={1144} height={274} priority className="h-9 w-auto" />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-1 text-sm font-medium transition ${
                  active ? 'text-[#E5457F]' : 'text-[#263544] hover:text-[#E5457F]'
                }`}
              >
                {link.label}
                {active && <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-[#E5457F]" />}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href="/favorites" aria-label="รายการโปรด" className={iconButton}>
            <HeartIcon size={24} weight={isActive('/favorites') ? 'fill' : 'regular'} />
            {favorites.length > 0 && <Badge count={favorites.length} />}
          </Link>
          <Link href="/cart" aria-label="ตะกร้า" className={iconButton}>
            <ShoppingCartSimpleIcon size={24} weight={isActive('/cart') ? 'fill' : 'regular'} />
            {cartItems.length > 0 && <Badge count={cartItems.length} />}
          </Link>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="บัญชีของฉัน"
              aria-expanded={menuOpen}
              className={`ml-1 flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                email
                  ? 'border-[#E5457F] bg-[#FDE3EE] text-[#E5457F]'
                  : 'border-[#263544]/20 bg-white text-[#263544] hover:border-[#E5457F]'
              }`}
            >
              {email ? (
                <span className="text-sm font-bold uppercase">{email.charAt(0)}</span>
              ) : (
                <UserIcon size={20} />
              )}
            </button>

            {menuOpen && ready && (
              <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border-2 border-[#263544] bg-white shadow-[4px_4px_0_0_#263544]">
                {email ? (
                  <>
                    <div className="border-b border-gray-100 px-4 py-3">
                      <p className="text-xs text-[#263544]/50">เข้าสู่ระบบในชื่อ</p>
                      <p className="truncate text-sm font-semibold text-[#263544]">{email}</p>
                    </div>
                    <MenuLink href="/orders" icon={<ReceiptIcon size={18} />} label="ออเดอร์ของฉัน" />
                    <MenuLink href="/favorites" icon={<HeartIcon size={18} />} label="รายการโปรด" />
                    {isAdmin && (
                      <MenuLink href="/admin/inventory" icon={<StorefrontIcon size={18} />} label="หลังร้าน (แอดมิน)" />
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <SignOutIcon size={18} />
                      ออกจากระบบ
                    </button>
                  </>
                ) : (
                  <div className="p-4">
                    <p className="mb-3 text-sm text-[#263544]/70">เข้าสู่ระบบเพื่อเช่าชุดและติดตามออเดอร์</p>
                    <Link
                      href={`/login?next=${encodeURIComponent(pathname)}`}
                      className="flex items-center justify-center gap-2 rounded-full border-2 border-[#263544] bg-[#E5457F] py-2 text-sm font-bold text-white shadow-[2px_2px_0_0_#263544]"
                    >
                      <SignInIcon size={18} />
                      เข้าสู่ระบบ / สมัครสมาชิก
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* เมนูหลักบนมือถือ */}
      <nav className="flex justify-center gap-6 border-t border-gray-100 py-2 md:hidden">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium ${isActive(link.href) ? 'text-[#E5457F]' : 'text-[#263544]'}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

function Badge({ count }: { count: number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-[#E5457F] px-1 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function MenuLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#263544] transition hover:bg-[#FFFAFC] hover:text-[#E5457F]"
    >
      {icon}
      {label}
    </Link>
  )
}
