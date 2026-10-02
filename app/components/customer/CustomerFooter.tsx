import Link from 'next/link'
import Image from 'next/image'
import { ArrowRightIcon, ArrowUpIcon, EnvelopeSimpleIcon, PhoneIcon } from '@phosphor-icons/react/dist/ssr'

const PERKS = [
  'REAL-TIME AVAILABILITY',
  'FULL SET & PROPS',
  'ACCURATE SIZING',
  'ADVANCED BOOKING',
  'FAST SHIPPING',
  'FAST DEPOSIT REFUND',
]

const LINK_GROUPS = [
  {
    title: 'บริการ',
    links: [
      { href: '/costumes?category=cosplay', label: 'เช่าชุดคอสเพลย์' },
      { href: '/costumes?category=fancy', label: 'เช่าชุดแฟนซี' },
      { href: '/costumes?category=props_shoes', label: 'เช่าพร็อพเสริม / รองเท้า' },
      { href: '/costumes', label: 'สำรวจชุดทั้งหมด' },
    ],
  },
  {
    title: 'ช่วยเหลือ',
    links: [
      { href: '/how-it-works', label: 'วิธีการเช่า' },
      { href: '/orders', label: 'ติดตามออเดอร์' },
      { href: '/favorites', label: 'รายการโปรด' },
      { href: '/account', label: 'บัญชีของฉัน' },
    ],
  },
]

export default function CustomerFooter() {
  return (
    <footer className="mt-20 bg-white">
      {/* แถบจุดเด่นวิ่งวน — เนื้อหาซ้ำ 2 ชุดเพื่อให้วนต่อกันไม่มีรอยต่อ */}
      <div className="overflow-hidden border-y-2 border-[#263544] bg-[#FBDCE7] py-3" aria-label="จุดเด่นของ CosMate">
        <div className="marquee flex w-max">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-center whitespace-nowrap text-base font-bold tracking-wide text-[#263544] sm:text-base">
                  <span className="px-4 text-[#263544]">✦</span>
                  {perk}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-10 pt-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" aria-label="CosMate หน้าหลัก" className="inline-block">
            <Image src="/images/logo.png" alt="CosMate" width={1144} height={274} className="h-14 w-auto" />
          </Link>
          <p className="mt-5 max-w-xs text-base leading-relaxed text-[#263544]/80">
            เช่าชุดคอสเพลย์/แฟนซีคุณภาพสูง ส่งตรงถึงบ้าน เพื่อทุกโอกาสพิเศษของคุณ
          </p>
          <Link
            href="/costumes"
            className="pop mt-6 inline-flex items-center gap-2 rounded-full bg-[#E5457F] px-5 py-2.5 text-base font-semibold text-white"
          >
            เริ่มเลือกชุดเลย
            <ArrowRightIcon size={16} weight="bold" />
          </Link>
        </div>

        {LINK_GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <p className="mb-4 text-lg font-bold text-[#263544]">{group.title}</p>
            <ul className="space-y-3 text-base text-[#263544]/80">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-[#E5457F]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <p className="mb-4 text-lg font-bold text-[#263544]">ติดต่อเรา</p>
          <ul className="space-y-3 text-base text-[#263544]/80">
            <li>
              <a href="mailto:support@cosmate.com" className="flex items-center gap-2 transition hover:text-[#E5457F]">
                <EnvelopeSimpleIcon size={18} className="shrink-0 text-[#E5457F]" />
                support@cosmate.com
              </a>
            </li>
            <li>
              <a href="tel:02333333" className="flex items-center gap-2 transition hover:text-[#E5457F]">
                <PhoneIcon size={18} className="shrink-0 text-[#E5457F]" />
                02-333333
              </a>
            </li>
          </ul>
          <p className="mt-5 text-base leading-relaxed text-[#263544]/60">
            มีคำถามเรื่องขนาดชุดหรือการจอง ทักมาได้เลย เรายินดีช่วยเลือกให้
          </p>
        </div>
      </div>

      <div className="border-t border-[#263544]/15">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-base text-[#263544]/70 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} CosMate. All rights reserved.</p>
          <a href="#" className="flex items-center gap-1 transition hover:text-[#E5457F]">
            กลับขึ้นด้านบน
            <ArrowUpIcon size={14} weight="bold" />
          </a>
        </div>
      </div>
    </footer>
  )
}
