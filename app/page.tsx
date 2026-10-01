'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  MaskHappyIcon,
  PackageIcon,
  SparkleIcon,
  ArrowUUpLeftIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import EmptyState from '@/app/components/EmptyState'
import CostumeGridCard from '@/app/components/customer/CostumeGridCard'
import { fetchCatalog, type CatalogCostume } from '@/utils/customer/fetchCatalog'
import {
  DEFAULT_BOOKING_SETTINGS,
  customerHeldDays,
  fetchBookingSettings,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'

// หน้าแรก — ชั่วคราวระหว่างรอดีไซน์จริง
// ตั้งใจให้ "คอสเพลย์" กับ "แฟนซี" มีน้ำหนักเท่ากัน (การ์ดขนาดเท่ากัน วางคู่กัน)
export default function HomePage() {
  const [latest, setLatest] = useState<CatalogCostume[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)

  useEffect(() => {
    Promise.all([fetchCatalog(4), fetchBookingSettings()]).then(([{ data }, s]) => {
      setLatest(data)
      setSettings(s)
      setLoading(false)
    })
  }, [])

  return (
    <CustomerLayout>
      {/* Hero */}
      <section className="rounded-3xl border-2 border-[#263544] bg-[#FDE3EE] px-6 py-10 shadow-[5px_5px_0_0_#263544] sm:px-10 sm:py-14">
        <p className="mb-3 inline-flex items-center gap-1 rounded-full border-2 border-[#263544] bg-[#FFF3B0] px-3 py-1 text-xs font-bold text-[#263544]">
          <SparkleIcon size={14} weight="fill" />
          เช่าง่าย ส่งถึงบ้าน คืนสะดวก
        </p>
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight text-[#263544] sm:text-4xl">
          ชุดคอสเพลย์และแฟนซี <span className="text-[#E5457F]">พร้อมใส่ทุกงาน</span>
        </h1>
        <p className="mt-3 max-w-xl text-[#263544]/70">
          เลือกชุด เลือกวันใช้งาน ระบบจัดการวันส่งและวันคืนให้อัตโนมัติ ไม่ต้องทักแชตถามคิวว่าง
        </p>
        <Link
          href="/costumes"
          className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-[#263544] bg-[#E5457F] px-6 py-3 text-sm font-bold text-white shadow-[3px_3px_0_0_#263544] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#263544]"
        >
          สำรวจชุดทั้งหมด
          <ArrowRightIcon size={16} weight="bold" />
        </Link>
      </section>

      {/* สองกลุ่มลูกค้า น้ำหนักเท่ากัน */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/costumes?category=cosplay"
          className="group rounded-3xl border-2 border-[#263544] bg-white p-6 transition hover:bg-[#FDE3EE]"
        >
          <MaskHappyIcon size={36} weight="duotone" className="text-[#E5457F]" />
          <h2 className="mt-3 text-xl font-bold text-[#263544]">คอสเพลย์</h2>
          <p className="mt-1 text-sm text-[#263544]/60">
            ชุดตัวละครจากอนิเมะ เกม และซีรีส์ สำหรับงานอีเวนต์และถ่ายรูป
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#E5457F]">
            ดูชุดคอสเพลย์ <ArrowRightIcon size={14} className="transition group-hover:translate-x-1" />
          </span>
        </Link>
        <Link
          href="/costumes?category=fancy"
          className="group rounded-3xl border-2 border-[#263544] bg-white p-6 transition hover:bg-[#EDE6FA]"
        >
          <SparkleIcon size={36} weight="duotone" className="text-[#263544]" />
          <h2 className="mt-3 text-xl font-bold text-[#263544]">แฟนซี</h2>
          <p className="mt-1 text-sm text-[#263544]/60">
            ปาร์ตี้ธีม ฮาโลวีน งานบริษัท งานโรงเรียน ใส่ได้ทุกโอกาส
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#E5457F]">
            ดูชุดแฟนซี <ArrowRightIcon size={14} className="transition group-hover:translate-x-1" />
          </span>
        </Link>
      </section>

      {/* ขั้นตอนเช่า — อธิบายโมเดลล็อก 5 วันให้ลูกค้าเข้าใจตั้งแต่หน้าแรก */}
      <section id="how-it-works" className="mt-10 scroll-mt-24">
        <h2 className="mb-4 text-xl font-bold text-[#263544]">วิธีการเช่า</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { icon: CalendarCheckIcon, title: 'เลือกชุดและวันใช้งาน', text: 'ปฏิทินแสดงเฉพาะวันที่ชุดว่างจริง' },
            { icon: WalletIcon, title: 'ชำระเงิน', text: 'ค่าเช่า + มัดจำ (ได้คืนหลังตรวจชุด)' },
            { icon: PackageIcon, title: 'รับชุดก่อนวันงาน 1 วัน', text: 'มีเวลาลองใส่และเตรียมตัว' },
            { icon: ArrowUUpLeftIcon, title: 'ส่งคืนวันถัดไป', text: 'แพ็กใส่กล่องเดิม ส่งกลับได้เลย' },
          ].map((step, i) => (
            <div key={step.title} className="rounded-2xl border-2 border-[#263544] bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#263544] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <step.icon size={22} className="text-[#E5457F]" />
              </div>
              <p className="mt-3 font-semibold text-[#263544]">{step.title}</p>
              <p className="mt-1 text-xs text-[#263544]/60">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ชุดมาใหม่ */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-bold text-[#263544]">ชุดมาใหม่</h2>
          <Link href="/costumes" className="text-sm font-semibold text-[#E5457F] hover:underline">
            ดูทั้งหมด
          </Link>
        </div>
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
            {latest.map((c) => (
              <CostumeGridCard key={c.id} costume={c} heldDays={customerHeldDays(c.minPricePackageDays, settings)} />
            ))}
          </div>
        )}
      </section>
    </CustomerLayout>
  )
}
