'use client'

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ArrowRightIcon,
  ArrowUUpLeftIcon,
  CalendarCheckIcon,
  CrownIcon,
  MagnifyingGlassIcon,
  MaskHappyIcon,
  PackageIcon,
  SneakerIcon,
  SparkleIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import EmptyState from '@/app/components/EmptyState'
import CostumeGridCard from '@/app/components/customer/CostumeGridCard'
import Reveal from '@/app/components/Reveal'
import { fetchCatalog, type CatalogCostume } from '@/utils/customer/fetchCatalog'
import {
  DEFAULT_BOOKING_SETTINGS,
  customerHeldDays,
  fetchBookingSettings,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

// อยู่บนสุดของหน้าไหม — ใช้ตัดสินว่าให้ตัวละครบนแบนเนอร์ลอยทับ navbar ได้หรือไม่
function subscribeScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true })
  return () => window.removeEventListener('scroll', onChange)
}
const isNearTop = () => window.scrollY < 16

// งานที่ลูกค้ากำลังจะไป → พาไปหมวดที่น่าจะใช่
const OCCASIONS = [
  { label: 'ไปงานคอสเพลย์อีเวนต์', href: '/costumes?category=cosplay', tilt: '-rotate-2' },
  { label: 'ปาร์ตี้ฮาโลวีน', href: '/costumes?category=fancy', tilt: 'rotate-1' },
  { label: 'งานโรงเรียน / งานบริษัท', href: '/costumes?category=fancy', tilt: '-rotate-1' },
  { label: 'ถ่ายรูปกับเพื่อน', href: '/costumes?category=cosplay', tilt: 'rotate-2' },
  { label: 'หาพร็อพ / รองเท้าเพิ่ม', href: '/costumes?category=props_shoes', tilt: '-rotate-2' },
]

export default function HomePage() {
  const router = useRouter()
  const [latest, setLatest] = useState<CatalogCostume[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
  const [query, setQuery] = useState('')
  const nearTop = useSyncExternalStore(subscribeScroll, isNearTop, () => true)

  useEffect(() => {
    Promise.all([fetchCatalog(4), fetchBookingSettings()]).then(([{ data }, s]) => {
      setLatest(data)
      setSettings(s)
      setLoading(false)
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

      {/* ===== หมวดชุด: การ์ดใหญ่เล็กไม่เท่ากัน ===== */}
      <section className="mt-20">
        <Reveal>
          <p className="text-base font-semibold text-[#E5457F]">วันนี้อยากเป็นใคร?</p>
          <h2 className="mt-1 text-2xl font-bold text-[#263544] sm:text-3xl">เลือกสายที่ใช่ แล้วไปลุยกัน</h2>
        </Reveal>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:grid-rows-2">
          <Reveal tilt={-2} className="lg:row-span-2">
            <CategoryCard
              href="/costumes?category=cosplay"
              title="คอสเพลย์"
              text="ชุดตัวละครจากอนิเมะ เกม และซีรีส์ ครบเซ็ตพร้อมวิกและพร็อพ สำหรับงานอีเวนต์และถ่ายรูป"
              icon={MaskHappyIcon}
              bg="bg-[#FDE3EE]"
              sticker="ฮิตสุด!"
              big
            />
          </Reveal>
          <Reveal tilt={2} delay={120}>
            <CategoryCard
              href="/costumes?category=fancy"
              title="แฟนซี"
              text="ปาร์ตี้ธีม ฮาโลวีน งานโรงเรียน งานบริษัท"
              icon={CrownIcon}
              bg="bg-[#EDE6FA]"
            />
          </Reveal>
          <Reveal tilt={-1} delay={240}>
            <CategoryCard
              href="/costumes?category=props_shoes"
              title="พร็อพ / รองเท้า"
              text="เติมลุคให้สุด ด้วยอาวุธ ปีก และรองเท้า"
              icon={SneakerIcon}
              bg="bg-[#FFF3B0]"
            />
          </Reveal>
        </div>
      </section>

      {/* ===== ช่วยเลือกชุด ===== */}
      <section id="pick-for-you" className="mt-24 scroll-mt-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-[#263544] px-6 py-12 text-white sm:px-12 lg:py-14">
            <div className="dot-field absolute inset-0 opacity-[0.12]" aria-hidden="true" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="inline-flex -rotate-2 items-center gap-1 rounded-full bg-[#FFF3B0] px-3 py-1 text-sm font-bold text-[#263544]">
                  <SparkleIcon size={14} weight="fill" />
                  ไม่รู้จะเลือกอะไร? ให้เราช่วย
                </p>
                <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
                  บอกเรามาว่า <span className="text-[#F7A6C4]">อยากเป็นใคร</span> หรือจะไปงานไหน
                </h2>

                <form
                  className="mt-6 flex max-w-xl items-center gap-2 rounded-full bg-white p-1.5 pl-5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const q = query.trim()
                    router.push(q ? `/costumes?q=${encodeURIComponent(q)}` : '/costumes')
                  }}
                >
                  <MagnifyingGlassIcon size={20} className="shrink-0 text-[#263544]/50" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="พิมพ์ชื่อตัวละคร หรือเรื่องที่ชอบ"
                    aria-label="ค้นหาตัวละครหรือเรื่อง"
                    className="min-w-0 flex-1 bg-transparent py-2 text-base text-[#263544] outline-none placeholder:text-[#263544]/45"
                  />
                  <button
                    type="submit"
                    className="pop inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-[#E5457F] px-5 text-base font-semibold text-white"
                  >
                    ค้นหา
                    <ArrowRightIcon size={16} weight="bold" />
                  </button>
                </form>

                <p className="mt-8 text-base text-white/60">หรือเลือกจากงานที่กำลังจะไป</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {OCCASIONS.map((o) => (
                    <Link
                      key={o.label}
                      href={o.href}
                      className={`${o.tilt} rounded-full border-2 border-white/80 px-4 py-2 text-base font-medium transition duration-200 hover:-translate-y-1 hover:rotate-0 hover:border-white`}
                    >
                      {o.label}
                    </Link>
                  ))}
                </div>
              </div>

              <Image
                src="/images/page-top.png"
                alt=""
                width={490}
                height={852}
                className="wobble mx-auto hidden h-64 w-auto select-none lg:block"
              />
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== วิธีการเช่า: เส้นทางซิกแซก ===== */}
      <section id="how-it-works" className="mt-24 scroll-mt-28">
        <Reveal className="text-center">
          <h2 className="text-2xl font-bold text-[#E5457F] sm:text-3xl">เช่าชุดกับ CosMate ใน 4 สเต็ป</h2>
          <p className="mt-1 text-xl font-medium text-[#263544]/45 sm:text-2xl">ง่ายกว่าที่คิด</p>
        </Reveal>

        <div className="relative mt-12">
          {/* เส้นประลากผ่านกึ่งกลางไอคอนแต่ละสเต็ป (จอใหญ่)
              ไอคอนสูง 64px → จุดกลาง y=32 ส่วนสเต็ปคู่เลื่อนลง 64px → y=96
              แกน x คือกึ่งกลางคอลัมน์ 12.5% / 37.5% / 62.5% / 87.5% */}
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
                <CostumeGridCard costume={c} heldDays={customerHeldDays(c.minPricePackageDays, settings)} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </CustomerLayout>
  )
}

function CategoryCard({
  href,
  title,
  text,
  icon: Icon,
  bg,
  sticker,
  big = false,
}: {
  href: string
  title: string
  text: string
  icon: typeof MaskHappyIcon
  bg: string
  sticker?: string
  big?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group relative flex h-full flex-col justify-end overflow-hidden rounded-[28px] border-2 border-[#263544] ${bg} p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#263544] sm:p-8 ${
        big ? 'min-h-[300px] lg:min-h-[420px]' : 'min-h-[190px]'
      }`}
    >
      {/* ไอคอนใหญ่เป็นลายพื้น หมุนเล่นตอนชี้ */}
      <Icon
        size={big ? 260 : 150}
        weight="duotone"
        className={`absolute text-[#263544]/10 transition duration-500 group-hover:-rotate-12 group-hover:scale-110 group-hover:text-[#E5457F]/20 ${
          big ? '-right-8 -top-8' : '-right-6 -top-6'
        }`}
        aria-hidden="true"
      />
      {sticker && (
        <span className="absolute left-6 top-6 rotate-[-6deg] rounded-full border-2 border-[#263544] bg-[#FFF3B0] px-3 py-1 text-sm font-bold text-[#263544] transition group-hover:rotate-[4deg] sm:left-8 sm:top-8">
          {sticker}
        </span>
      )}
      <h3 className={`relative font-bold text-[#263544] ${big ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>{title}</h3>
      <p className={`relative mt-2 text-base leading-relaxed text-[#263544]/70 ${big ? 'max-w-sm' : 'max-w-[260px]'}`}>{text}</p>
      <span className="relative mt-4 inline-flex items-center gap-1 text-base font-semibold text-[#E5457F]">
        ดูชุดทั้งหมด
        <ArrowRightIcon size={16} weight="bold" className="transition duration-300 group-hover:translate-x-2" />
      </span>
    </Link>
  )
}
