'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CaretRightIcon,
  ClipboardIcon,
  DressIcon,
  ListIcon,
  SignOutIcon,
  SquaresFourIcon,
  StorefrontIcon,
  UsersThreeIcon,
  XIcon,
} from '@phosphor-icons/react'
import { createClient } from '@/utils/client'
import CosMateLogo from '@/app/components/customer/CosMateLogo'

// โครงหลังร้านทุกหน้า — ใช้แทน AdminLayout เดิมได้ทันที (รับแค่ children เหมือนเดิม)
// แถบซ้าย: เมนู + ตัวเลขงานค้าง / มือถือ: แถบบน + เมนูเลื่อนออก

type NavItem = {
  href: string
  label: string
  icon: typeof SquaresFourIcon
  exact?: boolean
  badgeKey?: 'orders'
}

// หน้า /admin (ภาพรวม) และ /admin/reviews ยังเปิดได้ตาม URL แต่เอาออกจากเมนูแล้ว
// จะเอาภาพรวมกลับมา: ใส่บรรทัดนี้คืนไว้บนสุด
// { href: '/admin', label: 'ภาพรวม', icon: SquaresFourIcon, exact: true },
const NAV: NavItem[] = [
  { href: '/admin/orders', label: 'ออเดอร์', icon: ClipboardIcon, badgeKey: 'orders' },
  { href: '/admin/inventory', label: 'คลังชุด', icon: DressIcon },
  { href: '/admin/members', label: 'สมาชิก', icon: UsersThreeIcon },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [badges, setBadges] = useState<{ orders: number }>({ orders: 0 })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))

    // งานที่ร้านต้องลงมือ: ตรวจสลิป + แพ็กส่ง + ตรวจสภาพชุดคืน + โอนเงินคืน
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .or('status.in.(manual_review,paid,returned,inspecting),refund_status.eq.pending')
      .then(({ count }) => setBadges({ orders: count ?? 0 }))
  }, [pathname])

  useEffect(() => setMobileOpen(false), [pathname])

  async function handleLogout() {
    await createClient()?.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="เมนูหลังร้าน">
      {NAV.map((item) => {
        const active = isActive(item)
        const count = item.badgeKey ? badges[item.badgeKey] : 0
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            // หน้าตาเดียวกับเมนูหน้า "บัญชีของฉัน" ฝั่งลูกค้า
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium ${
              active ? 'bg-[#FDE3EE] text-[#E5457F]' : 'nudge-x text-[#263544]'
            }`}
          >
            <Icon size={22} weight={active ? 'fill' : 'regular'} />
            <span className="flex-1">{item.label}</span>
            {count > 0 && (
              <span
                className="min-w-[22px] rounded-full bg-[#FFF1D6] px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-[#875200] ring-1 ring-inset ring-[#F2D49B]"
                title="งานที่ร้านต้องทำ"
              >
                {count}
              </span>
            )}
            {active && <CaretRightIcon size={16} weight="bold" />}
          </Link>
        )
      })}
    </nav>
  )

  const footer = (
    <div className="border-t border-[#EEEDF2] p-3">
      <Link
        href="/"
        target="_blank"
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#5B6472] transition hover:bg-[#F5F4F8] hover:text-[#263544]"
      >
        <StorefrontIcon size={20} />
        ดูหน้าร้าน
      </Link>
      <div className="mt-2 flex items-center gap-3 px-3 py-2">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#263544] text-xs font-bold uppercase text-white">
          {email?.charAt(0) ?? 'A'}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-[#5B6472]">{email ?? 'แอดมิน'}</span>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="ออกจากระบบ"
          title="ออกจากระบบ"
          className="rounded-lg p-1.5 text-[#5B6472] transition hover:bg-[#FDE8E8] hover:text-[#B42318]"
        >
          <SignOutIcon size={18} />
        </button>
      </div>
    </div>
  )

  const brand = (
    <Link href="/admin" aria-label="CosMate หลังร้าน" className="flex items-center px-6 py-6">
      <CosMateLogo />
    </Link>
  )

  return (
    <div className="min-h-screen bg-[#F5F4F8] text-[#263544]">
      {/* แถบซ้าย (จอใหญ่) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#E4E3EA] bg-white lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* แถบบน (มือถือ) */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E4E3EA] bg-white px-4 py-3 lg:hidden">
        <Link href="/admin" aria-label="CosMate หลังร้าน">
          <CosMateLogo size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="เปิดเมนู"
          className="relative rounded-lg p-2 text-[#263544] hover:bg-[#F5F4F8]"
        >
          <ListIcon size={22} />
          {badges.orders > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#E59A00]" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนูหลังร้าน">
          <div className="absolute inset-0 bg-[#263544]/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="ปิดเมนู"
                className="rounded-lg p-2 text-[#263544] hover:bg-[#F5F4F8]"
              >
                <XIcon size={20} />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  )
}
