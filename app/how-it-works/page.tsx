'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  ArrowUUpLeftIcon,
  CalendarCheckIcon,
  CaretDownIcon,
  CheckCircleIcon,
  ClockCountdownIcon,
  CoinsIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SparkleIcon,
  StarIcon,
  TruckIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import {
  DEFAULT_BOOKING_SETTINGS,
  fetchBookingSettings,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'
import { formatBaht } from '@/utils/dateUtils'

// แพ็กเกจมาตรฐานของร้าน (วันใช้งาน + วันส่งคืน) ใช้เป็นตัวอย่างบนหน้านี้เท่านั้น
// ชุดแต่ละตัวกำหนด package_days เองได้ หน้ารายละเอียดชุดจะแสดงตามจริง
const EXAMPLE_PACKAGE_DAYS = 2

const STEPS: { icon: typeof MagnifyingGlassIcon; title: string; text: string; tip?: string }[] = [
  {
    icon: MagnifyingGlassIcon,
    title: 'เลือกชุดที่ใช่',
    text: 'ค้นหาตามตัวละคร เรื่อง หมวดคอสเพลย์/แฟนซี สี หรือไซส์ เปิดดูรูป ราคา ตารางไซส์ และรีวิวจากคนที่เคยเช่าจริง',
    tip: 'กดหัวใจเก็บชุดที่ชอบไว้เทียบทีหลังได้',
  },
  {
    icon: CalendarCheckIcon,
    title: 'เลือกไซส์และวันใช้งาน',
    text: 'ปฏิทินจะเปิดให้กดเฉพาะวันที่ชุดไซส์นั้นว่างจริง เลือกวันที่คุณจะใส่ชุด ระบบจะคำนวณวันรับชุดและวันส่งคืนให้อัตโนมัติ',
  },
  {
    icon: QrCodeIcon,
    title: 'ชำระเงินและแนบสลิป',
    text: 'กรอกที่อยู่จัดส่งและบัญชีสำหรับรับเงินมัดจำคืน จากนั้นสแกน QR ชำระเงิน ร้านจะตรวจยอดและยืนยันออเดอร์ให้',
    tip: 'ชุดจะถูกกันไว้ให้คุณทันทีที่สร้างออเดอร์ ไม่มีใครจองซ้อนได้',
  },
  {
    icon: TruckIcon,
    title: 'รับชุดก่อนวันงาน',
    text: 'ร้านแพ็กและส่งชุดให้ถึงมือคุณก่อนวันใช้งาน มีเวลาลองใส่ เช็กไซส์ และเตรียมแต่งหน้าทำผม ติดตามสถานะได้ที่หน้า "ออเดอร์ของฉัน"',
  },
  {
    icon: SparkleIcon,
    title: 'สนุกกับวันงาน',
    text: 'ใส่ชุดไปงานคอสเพลย์ ปาร์ตี้ หรือถ่ายรูปได้เต็มที่ เพียงระวังไม่ให้ชุดเปื้อนสีถาวร ขาด หรือเปียกน้ำนาน ๆ',
  },
  {
    icon: ArrowUUpLeftIcon,
    title: 'ส่งชุดคืนตามกำหนด',
    text: 'พับชุดและอุปกรณ์ทั้งหมดใส่ถุงหรือกล่องเดิม ส่งกลับภายในวันส่งคืนที่ระบุในออเดอร์ ไม่ต้องซักเอง ร้านดูแลการทำความสะอาดให้',
  },
  {
    icon: ShieldCheckIcon,
    title: 'ตรวจสภาพและคืนมัดจำ',
    text: 'ร้านตรวจสภาพชุดเมื่อได้รับคืน ถ้าเรียบร้อยจะโอนเงินมัดจำคืนเข้าบัญชีที่คุณให้ไว้ แล้วคุณจะรีวิวชุดได้ทันที',
    tip: 'รีวิวได้เฉพาะออเดอร์ที่เช่าเสร็จสิ้นแล้ว จึงเป็นรีวิวจากผู้เช่าจริงทุกรีวิว',
  },
]

const FAQS: { q: string; a: (s: BookingSettings) => ReactNode }[] = [
  {
    q: 'ทำไมจองวันใกล้ ๆ ไม่ได้',
    a: (s) => (
      <>
        ร้านต้องใช้เวลาเตรียม ทำความสะอาด และจัดส่งชุด จึงต้องจองล่วงหน้าอย่างน้อย{' '}
        <b>{s.minLeadDays} วัน</b> ก่อนวันใช้งาน วันที่ใกล้กว่านั้นจะกดเลือกในปฏิทินไม่ได้
      </>
    ),
  },
  {
    q: 'ทำไมบางวันในปฏิทินถึงเป็นสีเทา ทั้งที่ไม่เห็นมีใครใช้วันนั้น',
    a: (s) => (
      <>
        การเช่าหนึ่งครั้งไม่ได้ใช้ชุดแค่วันงาน ชุดต้องเดินทางไปถึงคุณก่อน {s.bufferDaysBefore} วัน
        และหลังวันส่งคืนร้านต้องใช้อีก {s.bufferDaysAfter} วันเพื่อรับคืน ตรวจสภาพ และทำความสะอาด
        วันรอบ ๆ การจองของคนอื่นจึงถูกกันไว้ด้วย ลองเลือกไซส์อื่นของชุดเดียวกัน อาจว่างในวันที่คุณต้องการ
      </>
    ),
  },
  {
    q: 'ต้องจ่ายอะไรบ้าง',
    a: (s) => (
      <>
        ยอดชำระ = ค่าเช่า + ค่าซักทำความสะอาด (ถ้าชุดนั้นมี) + เงินมัดจำ + ค่าจัดส่ง{' '}
        <b>{formatBaht(s.shippingFlatRate)}</b> ต่อออเดอร์ เช่าหลายชุดในออเดอร์เดียวจ่ายค่าส่งครั้งเดียว
        ทุกยอดแสดงชัดเจนในหน้าชำระเงินก่อนกดยืนยัน
      </>
    ),
  },
  {
    q: 'เงินมัดจำจะได้คืนเมื่อไร',
    a: () => (
      <>
        หลังร้านได้รับชุดคืนและตรวจสภาพเรียบร้อย ร้านจะโอนเงินมัดจำคืนเข้าบัญชีที่คุณระบุไว้ตอนชำระเงิน
        (หรือบัญชีใน "บัญชีของฉัน") ภายในระยะเวลาที่แสดงในหน้ารายละเอียดชุด
      </>
    ),
  },
  {
    q: 'ถ้าส่งชุดคืนช้าจะเป็นอย่างไร',
    a: (s) => (
      <>
        มีค่าปรับ <b>{formatBaht(s.lateFeePerDay)} ต่อวัน</b> ต่อออเดอร์ หักจากเงินมัดจำ
        เพราะคิวเช่าถัดไปของชุดนั้นอาจได้รับผลกระทบ ถ้ามีเหตุจำเป็น ติดต่อร้านก่อนถึงวันส่งคืน
      </>
    ),
  },
  {
    q: 'ถ้าชุดเสียหายระหว่างใช้งาน',
    a: () => (
      <>
        ความเสียหายเล็กน้อยจากการใช้งานปกติ เช่น ด้ายหลุด กระดุมหลวม ร้านดูแลให้ ส่วนความเสียหายที่ซ่อมไม่ได้
        เช่น ขาดใหญ่ เปื้อนสีถาวร หรืออุปกรณ์หาย จะหักค่าซ่อมหรือค่าชดเชยจากเงินมัดจำตามจริง
      </>
    ),
  },
  {
    q: 'ถ้าร้านไม่สามารถส่งชุดให้ได้ จะเกิดอะไรขึ้น',
    a: () => (
      <>
        ถ้าชุดตัวที่จองไว้ชำรุดก่อนจัดส่ง ร้านจะเปลี่ยนเป็นชุดเดียวกันไซส์เดียวกันอีกตัวให้ทันที
        ถ้าไม่มีตัวสำรอง ร้านจะยกเลิกออเดอร์และคืนเงินเต็มจำนวน คุณจะเห็นเหตุผลและสถานะการคืนเงินในหน้าออเดอร์
      </>
    ),
  },
  {
    q: 'จองค้างไว้หลายออเดอร์ได้ไหม',
    a: (s) => (
      <>
        มีออเดอร์ที่ยังไม่ได้ชำระเงินค้างได้{' '}
        {s.maxPendingOrders ? (
          <>
            สูงสุด <b>{s.maxPendingOrders} ออเดอร์</b> พร้อมกัน
          </>
        ) : (
          <>จำนวนจำกัด</>
        )}
        เพื่อไม่ให้ชุดถูกกันไว้โดยไม่มีคนเช่าจริง ถ้าต้องการหลายชุด ใส่ตะกร้าแล้วชำระรวมในออเดอร์เดียวได้
      </>
    ),
  },
]

export default function HowItWorksPage() {
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)

  useEffect(() => {
    fetchBookingSettings().then(setSettings)
  }, [])

  return (
    <CustomerLayout>
      {/* หัวเรื่อง */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-[#263544] bg-[#FFFAFC] px-6 py-10 shadow-[6px_6px_0_0_#263544] sm:px-10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#FDE3EE]" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-32 w-32 rounded-full bg-[#EDE6FA]" />
        <div className="relative max-w-2xl">
          <p className="text-base font-semibold text-[#C92D67]">วิธีการเช่า</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-[#263544] sm:text-4xl">
            เช่าชุดกับ CosMate
            <br />
            ง่ายใน 7 ขั้นตอน
          </h1>
          <p className="mt-3 text-[#263544]/70">
            ตั้งแต่เลือกชุดจนได้เงินมัดจำคืน ทุกขั้นตอนติดตามได้ในเว็บ ไม่ต้องทักแชตถามคิว
            ปฏิทินบอกวันว่างจริง ราคาบอกครบก่อนจ่าย
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/costumes"
              className="pop inline-flex items-center gap-2 rounded-full bg-[#E5457F] px-5 py-2.5 text-base font-bold text-white"
            >
              เริ่มเลือกชุด <ArrowRightIcon size={16} weight="bold" />
            </Link>
            <a
              href="#faq"
              className="pop inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-base font-bold text-[#263544]"
            >
              คำถามที่พบบ่อย
            </a>
          </div>
        </div>
      </section>

      {/* ไทม์ไลน์ตัวอย่าง */}
      <RentalTimelineExample settings={settings} />

      {/* ขั้นตอน */}
      <section className="mt-14">
        <SectionTitle eyebrow="ขั้นตอน" title="จากคลิกแรกถึงคืนมัดจำ" />
        <ol className="relative mt-6 space-y-4 before:absolute before:bottom-6 before:left-[23px] before:top-6 before:w-0.5 before:bg-[#263544]/15">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex gap-4">
              <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#263544] bg-white text-[#E5457F]">
                <step.icon size={22} weight="duotone" />
              </div>
              <div className="flex-1 rounded-2xl border border-[#E4E3EA] bg-white p-4 sm:p-5">
                <p className="text-base font-bold text-[#C92D67]">ขั้นที่ {i + 1}</p>
                <h3 className="mt-0.5 text-lg font-bold text-[#263544]">{step.title}</h3>
                <p className="mt-1 text-base leading-relaxed text-[#263544]/70">{step.text}</p>
                {step.tip && (
                  <p className="mt-3 inline-flex items-start gap-1.5 rounded-xl bg-[#FFFAFC] px-3 py-2 text-base text-[#263544]/80">
                    <CheckCircleIcon size={14} weight="fill" className="mt-0.5 flex-shrink-0 text-[#E5457F]" />
                    {step.tip}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ค่าใช้จ่ายและเงื่อนไข */}
      <section className="mt-14">
        <SectionTitle eyebrow="ค่าใช้จ่ายและเงื่อนไข" title="รู้ไว้ก่อนเช่า" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RuleCard
            icon={<ClockCountdownIcon size={24} weight="duotone" />}
            value={`${settings.minLeadDays} วัน`}
            label="จองล่วงหน้าขั้นต่ำ"
            text="นับจากวันนี้ถึงวันใช้งาน"
          />
          <RuleCard
            icon={<TruckIcon size={24} weight="duotone" />}
            value={formatBaht(settings.shippingFlatRate)}
            label="ค่าจัดส่งต่อออเดอร์"
            text="เช่าหลายชุดจ่ายค่าส่งครั้งเดียว"
          />
          <RuleCard
            icon={<CoinsIcon size={24} weight="duotone" />}
            value="ได้คืน"
            label="เงินมัดจำ"
            text="โอนคืนหลังตรวจสภาพชุดเรียบร้อย"
          />
          <RuleCard
            icon={<WarningCircleIcon size={24} weight="duotone" />}
            value={`${formatBaht(settings.lateFeePerDay)}/วัน`}
            label="ค่าปรับคืนช้า"
            text="หักจากเงินมัดจำ"
            warn
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#E4E3EA] bg-white p-5">
            <h3 className="flex items-center gap-2 font-bold text-[#263544]">
              <CheckCircleIcon size={20} weight="fill" className="text-[#2E8B57]" /> ควรทำ
            </h3>
            <ul className="mt-3 space-y-2 text-base text-[#263544]/75">
              <li>• ลองใส่ชุดทันทีที่ได้รับ ถ้าพบปัญหาแจ้งร้านภายในวันนั้น</li>
              <li>• ถ่ายรูปชุดก่อนแพ็กส่งคืน เก็บไว้เป็นหลักฐาน</li>
              <li>• ส่งคืนอุปกรณ์ประกอบให้ครบทุกชิ้น (วิก พร็อพ เครื่องประดับ)</li>
              <li>• เก็บเลขพัสดุตอนส่งคืนไว้จนได้รับเงินมัดจำ</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[#E4E3EA] bg-white p-5">
            <h3 className="flex items-center gap-2 font-bold text-[#263544]">
              <WarningCircleIcon size={20} weight="fill" className="text-[#C92D67]" /> ไม่ควรทำ
            </h3>
            <ul className="mt-3 space-y-2 text-base text-[#263544]/75">
              <li>• ซักหรือรีดชุดเอง ร้านทำความสะอาดให้ตามวิธีของเนื้อผ้า</li>
              <li>• ตัด เย็บ ติดกาว หรือดัดแปลงชุดและวิก</li>
              <li>• ใช้สีทาตัวหรือสเปรย์สีที่อาจเปื้อนชุดถาวร</li>
              <li>• ให้ผู้อื่นเช่าต่อหรือยืมใส่</li>
            </ul>
          </div>
        </div>
      </section>

      {/* คำถามที่พบบ่อย */}
      <section id="faq" className="mt-14 scroll-mt-24">
        <SectionTitle eyebrow="FAQ" title="คำถามที่พบบ่อย" />
        <div className="mt-6 divide-y divide-[#EEEDF2] overflow-hidden rounded-2xl border border-[#E4E3EA] bg-white">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-[#263544] transition hover:bg-[#FFFAFC] [&::-webkit-details-marker]:hidden">
                {f.q}
                <CaretDownIcon
                  size={18}
                  weight="bold"
                  className="flex-shrink-0 text-[#263544]/50 transition group-open:rotate-180 group-open:text-[#E5457F]"
                />
              </summary>
              <p className="px-5 pb-5 text-base leading-relaxed text-[#263544]/70">{f.a(settings)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ปิดท้าย */}
      <section className="mt-14 flex flex-col items-center gap-4 rounded-3xl bg-[#263544] px-6 py-10 text-center text-white">
        <StarIcon size={32} weight="fill" className="text-[#E5457F]" />
        <h2 className="text-2xl font-bold">พร้อมแปลงร่างแล้วหรือยัง</h2>
        <p className="max-w-md text-base text-white/70">
          ชุดคอสเพลย์จากตัวละครที่คุณรัก หรือชุดแฟนซีสำหรับทุกปาร์ตี้ เลือกวัน กดจอง แล้วรอรับชุดได้เลย
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/costumes?category=cosplay"
            className="pop pop-light rounded-full bg-[#E5457F] px-5 py-2.5 text-base font-bold text-white"
          >
            ดูชุดคอสเพลย์
          </Link>
          <Link
            href="/costumes?category=fancy"
            className="pop pop-light rounded-full px-5 py-2.5 text-base font-bold text-white"
          >
            ดูชุดแฟนซี
          </Link>
        </div>
      </section>
    </CustomerLayout>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-base font-semibold text-[#C92D67]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold text-[#263544]">{title}</h2>
    </div>
  )
}

function RuleCard({
  icon,
  value,
  label,
  text,
  warn = false,
}: {
  icon: ReactNode
  value: string
  label: string
  text: string
  warn?: boolean
}) {
  return (
    <div className="rounded-2xl border-2 border-[#263544] bg-white p-5">
      <div className={warn ? 'text-[#C92D67]' : 'text-[#E5457F]'}>{icon}</div>
      <p className="mt-3 text-2xl font-bold text-[#263544]">{value}</p>
      <p className="text-base font-semibold text-[#263544]">{label}</p>
      <p className="mt-1 text-base text-[#263544]/60">{text}</p>
    </div>
  )
}

// ไทม์ไลน์ตัวอย่าง: คำนวณจากค่าตั้งค่าจริง แบบเดียวกับ create_booking()
// ล็อก = [วันใช้งาน - before, วันใช้งาน + package_days - 1 + after]
function RentalTimelineExample({ settings }: { settings: BookingSettings }) {
  type Day = { key: string; label: string; kind: 'receive' | 'use' | 'return' | 'buffer' }
  const days: Day[] = []

  for (let i = settings.bufferDaysBefore; i >= 1; i--) {
    days.push({
      key: `b${i}`,
      label: i === 1 ? 'รับชุด' : 'ชุดเดินทาง',
      kind: 'receive',
    })
  }
  days.push({ key: 'use', label: 'วันใช้งาน', kind: 'use' })
  for (let i = 1; i < EXAMPLE_PACKAGE_DAYS; i++) {
    days.push({
      key: `r${i}`,
      label: i === EXAMPLE_PACKAGE_DAYS - 1 ? 'ส่งคืน' : 'ใช้งานต่อ',
      kind: i === EXAMPLE_PACKAGE_DAYS - 1 ? 'return' : 'use',
    })
  }
  for (let i = 1; i <= settings.bufferDaysAfter; i++) {
    days.push({ key: `a${i}`, label: 'ร้านตรวจ/ซัก', kind: 'buffer' })
  }

  const useIndex = settings.bufferDaysBefore
  const heldDays = settings.bufferDaysBefore + EXAMPLE_PACKAGE_DAYS

  const style: Record<Day['kind'], string> = {
    receive: 'bg-[#E8F1FB] text-[#1F5FA8] border-[#2F7FD6]',
    use: 'bg-[#E5457F] text-white border-[#263544]',
    return: 'bg-[#F0EBFA] text-[#5A3DA8] border-[#6E4FC0]',
    buffer:
      'border-dashed border-[#263544]/30 text-[#263544]/60 bg-[repeating-linear-gradient(135deg,#F5F4F8_0_6px,#FFFFFF_6px_12px)]',
  }

  return (
    <section className="mt-14">
      <SectionTitle eyebrow="เช่า 1 ครั้งใช้กี่วัน" title={`ชุดอยู่กับคุณ ${heldDays} วัน`} />
      <p className="mt-2 max-w-2xl text-base text-[#263544]/70">
        คุณเลือกแค่ <b>วันใช้งาน</b> ระบบจะคำนวณให้ว่าชุดถึงมือคุณวันไหน และต้องส่งคืนวันไหน
        ตัวอย่างด้านล่างคือแพ็กเกจมาตรฐาน {EXAMPLE_PACKAGE_DAYS} วัน (วันใช้งาน + วันส่งคืน)
        บางชุดอาจมีจำนวนวันต่างไป ดูได้ในหน้ารายละเอียดชุด
      </p>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="flex min-w-[560px] gap-2">
          {days.map((d, i) => {
            const offset = i - useIndex
            return (
              <div key={d.key} className="flex-1">
                <p className="mb-1.5 text-center text-sm font-semibold text-[#263544]/50">
                  {offset === 0 ? 'วันงาน' : offset > 0 ? `+${offset}` : offset}
                </p>
                <div
                  className={`flex h-20 flex-col items-center justify-center rounded-xl border-2 px-1 text-center text-sm font-bold ${style[d.kind]}`}
                >
                  {d.kind === 'receive' && <PackageIcon size={20} weight="bold" className="mb-1" />}
                  {d.kind === 'use' && <SparkleIcon size={20} weight="fill" className="mb-1" />}
                  {d.kind === 'return' && <ArrowUUpLeftIcon size={20} weight="bold" className="mb-1" />}
                  {d.kind === 'buffer' && <ShieldCheckIcon size={20} className="mb-1" />}
                  {d.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-base text-[#263544]/70">
        <Legend className="bg-[#2F7FD6]" label="ชุดถึงมือคุณ" />
        <Legend className="bg-[#E5457F]" label="วันใช้งาน" />
        <Legend className="bg-[#6E4FC0]" label="ส่งชุดคืน (ภายในวันนี้)" />
        <Legend className="border border-dashed border-[#263544]/40 bg-[#F5F4F8]" label="ร้านรับคืน ตรวจสภาพ และทำความสะอาด" />
      </div>

      <p className="mt-4 rounded-xl bg-[#FFFAFC] px-4 py-3 text-base text-[#263544]/80">
        <b>ทำไมต้องรู้เรื่องนี้?</b> ชุดหนึ่งตัวจะไม่ว่างรวม {days.length} วันต่อการเช่าหนึ่งครั้ง
        ถ้าวันที่คุณอยากได้ไม่ว่าง ลองเปลี่ยนไซส์ หรือเลือกชุดอื่นจากตัวละครเดียวกัน
      </p>
    </section>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  )
}
