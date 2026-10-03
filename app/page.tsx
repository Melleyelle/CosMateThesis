'use client'

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRightIcon,
  ArrowUUpLeftIcon,
  CalendarCheckIcon,
  DressIcon,
  FacebookLogoIcon,
  HighHeelIcon,
  MapPinIcon,
  MaskHappyIcon,
  PackageIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import EmptyState from '@/app/components/EmptyState'
import CostumeGridCard from '@/app/components/customer/CostumeGridCard'
import Reveal from '@/app/components/Reveal'
import { fetchCatalog, type CatalogCostume } from '@/utils/customer/fetchCatalog'
import { customerHeldDays } from '@/utils/customer/bookingSettings'
import { fetchEvents, type CalendarEvent } from '@/utils/customer/events'
import { todayISO } from '@/utils/dateUtils'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

// อยู่บนสุดของหน้าไหม — ใช้ตัดสินว่าให้ตัวละครบนแบนเนอร์ลอยทับ navbar ได้หรือไม่
function subscribeScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true })
  return () => window.removeEventListener('scroll', onChange)
}
const isNearTop = () => window.scrollY < 16

export default function HomePage() {
  const [latest, setLatest] = useState<CatalogCostume[]>([])
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const nearTop = useSyncExternalStore(subscribeScroll, isNearTop, () => true)

  useEffect(() => {
    fetchCatalog(4).then(({ data }) => {
      setLatest(data)
      setLoading(false)
    })
    // แสดงเฉพาะงานที่ยังไม่จบ เรียงตามวันเริ่ม 4 งาน
    fetchEvents().then(({ events }) => {
      const today = todayISO()
      setEvents(
        events
          .filter((e) => e.endDate >= today)
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .slice(0, 4),
      )
    })
  }, [])

  const steps = [
    { icon: CalendarCheckIcon, title: 'เลือกชุดและวันใช้งาน', text: 'ปฏิทินแสดงเฉพาะวันที่ชุดว่างจริง ไม่ต้องทักถามคิว' },
    { icon: WalletIcon, title: 'ชำระเงิน', text: 'ค่าเช่า + มัดจำ ซึ่งได้คืนหลังร้านตรวจชุดเรียบร้อย' },
    {
      icon: PackageIcon,
      title: `รับชุดก่อนวันงาน 1-2 วัน`,
      text: 'มีเวลาลองใส่ แต่งหน้า และเตรียมตัวแบบไม่รีบ',
    },
    { icon: ArrowUUpLeftIcon, title: 'ส่งคืนวันถัดไป', text: 'แพ็กใส่กล่องเดิมและจัดส่งคืนได้ทันที!' },
  ]

  return (
    <CustomerLayout>
      {/* ===== Banner ===== */}
      {/* จอใหญ่: ปีกตัวละครล้นขอบการ์ดขึ้นไปทับขอบล่าง navbar เป็นลูกเล่น (เฉพาะตอนอยู่บนสุดของหน้า) */}
      <section className="relative">
        <div className="relative rounded-[28px] bg-gradient-to-b from-[#FBDDE8] via-[#FCE8EF] to-[#FEF6F9] lg:min-h-[436px]">
          <div className="dot-field absolute inset-0 rounded-[28px] opacity-70" aria-hidden="true" />

          {/* ประกายวิบวับรอบตัวละคร */}
          <span className="twinkle absolute right-[46%] top-[18%] hidden text-2xl text-[#E5457F] lg:block" style={delay(0)} aria-hidden="true">✦</span>
          <span className="twinkle absolute right-[6%] top-[12%] hidden text-lg text-[#F5B400] lg:block" style={delay(700)} aria-hidden="true">✦</span>
          <span className="twinkle absolute bottom-[22%] right-[50%] hidden text-base text-[#8B6FD6] lg:block" style={delay(1400)} aria-hidden="true">✦</span>

          {/* จอเล็ก: ข้อความจัดกลางกล่อง / จอใหญ่: ชิดซ้ายคู่กับตัวละครด้านขวา */}
          <div className="relative z-10 px-6 pt-10 text-center sm:px-12 sm:pt-14 lg:max-w-[52%] lg:px-16 lg:pb-14 lg:pt-16 lg:text-left">
            <h1 className="text-[32px] font-bold leading-[1.35] text-[#263544] sm:text-[48px]">
              <span className="rise block text-[#E5457F]" style={delay(0)}>เลือกตัวละครที่ใช่</span>
              <span className="rise block" style={delay(120)}>พร้อมออกไปสนุกกับ</span>
              <span className="rise block" style={delay(240)}>งานอีเวนต์ของคุณ</span>
            </h1>
            <p className="rise mx-auto mt-4 max-w-sm text-base leading-relaxed text-[#263544]/85 lg:mx-0" style={delay(380)}>
              เช่าชุดคอสเพลย์ ชุดแฟนซี และพร็อพที่ใช่
              <br />
              พร้อมไปสนุกกับทุกโมเมนต์ของคุณ
            </p>
            <div className="rise mt-8 flex flex-wrap justify-center gap-4 lg:justify-start" style={delay(500)}>
              <Link
                href="/costumes"
                className="pop inline-flex h-14 items-center rounded-full bg-[#E5457F] px-9 text-base font-semibold text-white"
              >
                ไปสำรวจชุด
              </Link>
              <a
                href="#pick-for-you"
                className="pop inline-flex h-14 items-center rounded-full bg-white px-8 text-base font-semibold text-[#263544]"
              >
                ช่วยเลือกชุดให้คุณ
              </a>
            </div>
          </div>

          {/* ภาพตัวละคร — จอใหญ่ล้นขอบบนของการ์ดเหมือนในดีไซน์ */}
          <Image
            src="/images/dec-banner.png"
            alt="นางแบบสวมชุดคอสเพลย์โทนขาวม่วง"
            width={1368}
            height={982}
            priority
            sizes="(min-width: 1024px) 660px, 92vw"
            className={`hero-figure pointer-events-none relative mx-auto mt-6 w-[92%] select-none lg:absolute lg:bottom-0 lg:right-[3%] lg:mt-0 lg:w-[54%] ${
              nearTop ? 'lg:z-50' : ''
            }`}
          />
        </div>
      </section>

      {/* ===== หมวดชุด: 3 การ์ดเท่ากัน ===== */}
      <section className="mt-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.href} delay={i * 120}>
              <CategoryCard {...c} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== ช่วยเลือกชุด: Quiz + กาชาปอง ===== */}
      <section id="pick-for-you" className="mt-20 scroll-mt-28">
        <Reveal>
          <div className="relative text-center">
            <h2 className="text-2xl font-bold text-[#263544] sm:text-3xl">
              ยังไม่รู้จะคอสอะไรให้ <span className="text-[#E5457F]">CosMate ช่วยเลือก!</span>
            </h2>
            <p className="mt-1 text-base text-[#263544]/70">
              ตอบคำถามสั้น ๆ หรือสุ่มตัวละครใหม่ แล้วค้นพบชุดที่เหมาะกับคุณ
            </p>
            <Image
              src="/images/page-top.png"
              alt=""
              width={490}
              height={852}
              className="wobble pointer-events-none absolute -bottom-[90px] right-[8%] z-0 hidden h-56 w-auto select-none lg:block"
            />
          </div>
        </Reveal>

        <div className="relative z-10 mt-8 grid gap-5 md:grid-cols-2">
          <Reveal delay={0}>
            <PickCard image="/images/banner-quiz.png" title={['ทำ Quiz', 'ค้นหาชุดที่ใช่!']} cta="เริ่มทำ Quiz" />
          </Reveal>
          <Reveal delay={120}>
            <PickCard
              image="/images/banner-gashapon.png"
              title={['ใช้ดวงสุ่มกาชาปอง', 'ลุ้นชุดที่จะออกมา!']}
              cta="สุ่มกาชาปอง"
            />
          </Reveal>
        </div>
      </section>

      {/* ===== วิธีการเช่า: เส้นทางซิกแซก ===== */}
      <section id="how-it-works" className="mt-24 scroll-mt-28">
        <Reveal className="text-center">
          <h2 className="text-2xl font-bold text-[#E5457F] sm:text-3xl">เช่าชุดกับ CosMate ใน 4 สเต็ป</h2>
          <p className="mt-1 text-xl font-medium text-[#263544]/45 sm:text-2xl">ง่ายกว่าที่คิด</p>
        </Reveal>

        <div className="relative mt-12">
          <svg
            className="absolute inset-x-0 top-0 hidden h-32 w-full text-[#E5457F]/40 lg:block"
            viewBox="0 0 1000 128"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M125 32 C 250 32, 250 96, 375 96 S 500 32, 625 32 S 750 96, 875 96"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="10 10"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {steps.map((step, i) => (
              <li key={step.title} className={i % 2 === 1 ? 'lg:mt-16' : ''}>
                <Reveal delay={i * 140}>
                  <div className="group flex flex-col items-center text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#263544] bg-white text-[#E5457F] shadow-[3px_3px_0_0_#263544] transition duration-300 group-hover:-rotate-12 group-hover:bg-[#FDE3EE]">
                      <step.icon size={30} weight="duotone" />
                    </span>
                    <span className="mt-4 text-4xl font-extrabold leading-none text-[#E5457F] transition duration-300 group-hover:scale-110">
                      0{i + 1}
                    </span>
                    <p className="mt-3 text-lg font-bold text-[#263544]">{step.title}</p>
                    <p className="mt-1 max-w-[240px] text-base leading-relaxed text-[#263544]/65">{step.text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== อีเวนต์ที่กำลังจะมาถึง (ข้อมูลตัวอย่างชุดเดียวกับปฏิทินหน้าชุด) ===== */}
      <section className="mt-24">
        <div className="grid items-center gap-8 lg:grid-cols-[200px_1fr]">
          <Reveal className="hidden lg:block">
            <Image
              src="/images/dec-1.png"
              alt=""
              width={432}
              height={868}
              className="wobble mx-auto h-64 w-auto select-none"
            />
          </Reveal>

          <div>
            <Reveal>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-[#E5457F]">ปฏิทินสายคอส</p>
                  <h2 className="mt-1 text-2xl font-bold text-[#263544] sm:text-3xl">อีเวนต์ที่กำลังจะมาถึง</h2>
                </div>
                <button
                  type="button"
                  className="pop inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-base font-semibold text-[#263544]"
                >
                  <FacebookLogoIcon size={22} weight="fill" className="text-[#1877F2]" />
                  ติดตามอีเวนต์บน Facebook
                </button>
              </div>
            </Reveal>

            {events.length === 0 ? (
              <p className="rounded-2xl bg-[#F7F7F8] px-4 py-10 text-center text-base text-[#263544]/60">
                ยังไม่มีอีเวนต์ในช่วงนี้
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {events.map((ev, i) => (
                  <Reveal key={ev.id} delay={i * 100}>
                    <EventCard event={ev} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== ชุดมาใหม่ ===== */}
      <section className="mt-24">
        <Reveal>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-[#E5457F]">เพิ่งเข้าร้าน</p>
              <h2 className="mt-1 text-2xl font-bold text-[#263544] sm:text-3xl">ชุดมาใหม่</h2>
            </div>
            <Link
              href="/costumes"
              className="group inline-flex items-center gap-1 text-base font-semibold text-[#E5457F]"
            >
              ดูทั้งหมด
              <ArrowRightIcon size={16} className="transition group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : latest.length === 0 ? (
          <EmptyState
            className="rounded-2xl bg-white"
            title="ชุดสวย ๆ กำลังเดินทางมา"
            description="ร้านกำลังเตรียมชุดใหม่ให้เลือกอยู่ แวะกลับมาดูอีกทีเร็ว ๆ นี้นะ"
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {latest.map((c, i) => (
              <Reveal key={c.id} delay={i * 100}>
                <CostumeGridCard costume={c} heldDays={customerHeldDays(c.minPricePackageDays)} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </CustomerLayout>
  )
}

const CATEGORIES = [
  {
    href: '/costumes?category=cosplay',
    title: 'ชุดคอสเพลย์',
    text: 'ชุดตัวละครอนิเมะ เกม หรือซีรีส์แบบครบเซ็ต',
    icon: DressIcon,
    bg: 'bg-[#FDE3EE]',
  },
  {
    href: '/costumes?category=fancy',
    title: 'ชุดแฟนซี',
    text: 'ชุดสำหรับปาร์ตี้ธีมบริษัทหรืองานอีเวนต์',
    icon: MaskHappyIcon,
    bg: 'bg-[#FFF3B0]',
  },
  {
    href: '/costumes?category=props_shoes',
    title: 'พร็อพเสริม / รองเท้า',
    text: 'จัดเต็มทุกลุคด้วยพร็อพเสริมของร้านเรา',
    icon: HighHeelIcon,
    bg: 'bg-[#EDE6FA]',
  },
]

function CategoryCard({
  href,
  title,
  text,
  icon: Icon,
  bg,
}: {
  href: string
  title: string
  text: string
  icon: typeof MaskHappyIcon
  bg: string
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col items-center rounded-[20px] border-2 border-[#263544] bg-white px-5 py-6 text-center shadow-[4px_4px_0_0_#263544] transition duration-200 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#263544]"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#263544] ${bg} text-[#263544] shadow-[2px_2px_0_0_#263544] transition duration-300 group-hover:-rotate-12`}
      >
        <Icon size={30} />
      </span>
      <h3 className="mt-3 text-lg font-bold text-[#E5457F]">{title}</h3>
      <p className="mt-0.5 text-base text-[#263544]/80">{text}</p>
    </Link>
  )
}

// การ์ดภาพพื้นหลัง + ข้อความและปุ่มครึ่งขวา (การ์ดเองไม่มี hover)
// ปุ่มยังไม่ผูกการทำงาน — รอหน้า Quiz / กาชาปองจริง
function PickCard({ image, title, cta }: { image: string; title: [string, string]; cta: string }) {
  return (
    <div className="relative aspect-[1212/556] w-full overflow-hidden rounded-[24px]">
      <Image src={image} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      <div className="absolute inset-y-0 right-0 flex w-[48%] flex-col items-start justify-center pr-4">
        <p className="text-xl font-bold leading-snug text-[#263544] sm:text-2xl lg:text-3xl">
          {title[0]}
          <br />
          {title[1]}
        </p>
        <button
          type="button"
          className="pop mt-3 inline-flex items-center rounded-full bg-[#E5457F] px-5 py-2 text-sm font-semibold text-white sm:mt-4 sm:px-6 sm:py-2.5 sm:text-base"
        >
          {cta}
        </button>
      </div>
    </div>
  )
}

const EVENT_BG: Record<CalendarEvent['tone'], string> = {
  pink: 'bg-[#FDE3EE]',
  purple: 'bg-[#EDE6FA]',
  yellow: 'bg-[#FFF3B0]',
}

function EventCard({ event }: { event: CalendarEvent }) {
  const start = new Date(`${event.startDate}T00:00:00`)
  const end = new Date(`${event.endDate}T00:00:00`)
  const sameDay = event.startDate === event.endDate
  return (
    <article className="flex h-full items-center gap-4 rounded-2xl border-2 border-[#263544] bg-white p-4 shadow-[4px_4px_0_0_#263544]">
      <span
        className={`flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-xl border-2 border-[#263544] ${EVENT_BG[event.tone]}`}
      >
        <span
          className={`${sameDay ? 'text-2xl' : 'text-xl'} font-extrabold leading-none text-[#263544]`}
        >
          {start.getDate()}
          {!sameDay && `–${end.getDate()}`}
        </span>
        <span className="mt-1 text-sm font-semibold text-[#263544]/70">
          {start.toLocaleDateString('th-TH', { month: 'short' })}
        </span>
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold text-[#263544]">{event.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-base text-[#263544]/65">
          <MapPinIcon size={16} className="flex-shrink-0 text-[#E5457F]" />
          <span className="truncate">{event.location}</span>
        </p>
        <p className="text-sm text-[#263544]/50">
          {start.toLocaleDateString('th-TH', { weekday: 'long' })}
          {!sameDay && ` – ${end.toLocaleDateString('th-TH', { weekday: 'long' })}`}
        </p>
      </div>
    </article>
  )
}
