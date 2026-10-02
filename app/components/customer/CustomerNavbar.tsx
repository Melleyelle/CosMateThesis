'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HeartIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  SignInIcon,
  SignOutIcon,
  StorefrontIcon,
  UserIcon,
} from '@phosphor-icons/react'
import { createClient } from '@/utils/client'
import { useCart } from '@/utils/customer/cart'
import { useFavorites } from '@/utils/customer/favorites'
import CosMateLogo from './CosMateLogo'

const NAV_LINKS = [
  { href: '/', label: 'หน้าหลัก' },
  { href: '/costumes', label: 'สำรวจชุด' },
  { href: '/how-it-works', label: 'วิธีการเช่า' },
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session?.user?.email ?? null), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

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
    'nudge relative flex h-10 w-10 items-center justify-center rounded-full text-[#263544]'

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="CosMate หน้าหลัก" className="flex-shrink-0">
          <CosMateLogo />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-1 text-base font-medium transition ${
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
            <ShoppingBagIcon size={24} weight={isActive('/cart') ? 'fill' : 'regular'} />
            {cartItems.length > 0 && <Badge count={cartItems.length} />}
          </Link>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="บัญชีของฉัน"
              aria-expanded={menuOpen}
              className={`nudge flex h-10 w-10 items-center justify-center rounded-full ${
                email ? 'bg-[#FDE3EE] text-[#E5457F]' : 'text-[#263544]'
              }`}
            >
              {email ? (
                <span className="text-base font-bold uppercase">{email.charAt(0)}</span>
              ) : (
                <UserIcon size={20} />
              )}
            </button>

            {menuOpen && ready && (
              <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border-2 border-[#263544] bg-white shadow-[4px_4px_0_0_#263544]">
                {email ? (
                  <>
                    <MenuLink href="/account" icon={<UserIcon size={18} />} label="บัญชีของฉัน" />
                    <MenuLink href="/orders" icon={<ReceiptIcon size={18} />} label="ออเดอร์ของฉัน" />
                    {isAdmin && (
                      <MenuLink href="/admin/inventory" icon={<StorefrontIcon size={18} />} label="หลังร้าน (แอดมิน)" />
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="group flex w-full items-center gap-2 border-t border-gray-100 px-4 py-3 text-left text-base font-medium text-red-600"
                    >
                      <span className="flex items-center gap-2 transition-transform duration-150 group-hover:translate-x-1">
                        <SignOutIcon size={18} />
                        ออกจากระบบ
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="p-4">
                    <p className="mb-3 text-base text-[#263544]/70">เข้าสู่ระบบเพื่อเช่าชุด</p>
                    <Link
                      href={`/login?next=${encodeURIComponent(pathname)}`}
                      className="pop flex items-center justify-center gap-2 rounded-full bg-[#E5457F] py-2.5 text-base font-semibold text-white"
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
            className={`text-base font-medium ${isActive(link.href) ? 'text-[#E5457F]' : 'text-[#263544]'}`}
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
      className="group flex items-center gap-2 px-4 py-2.5 text-base font-medium text-[#263544]"
    >
      <span className="flex items-center gap-2 transition-transform duration-150 group-hover:translate-x-1">
        {icon}
        {label}
      </span>
    </Link>
  )
}
