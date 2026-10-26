'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  ArrowUUpLeftIcon,
  CalendarCheckIcon,
  CaretDownIcon,
  CheckIcon,
  DressIcon,
  HandCoinsIcon,
  MapPinIcon,
  PackageIcon,
  QrCodeIcon,
  SparkleIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import {
  DEFAULT_BOOKING_SETTINGS,
  fetchBookingSettings,
  minStartOffset,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'
import { formatBaht } from '@/utils/dateUtils'

// จำนวนวันเช่าตัวอย่างบนหน้านี้เท่านั้น — ลูกค้าเลือกจำนวนวันเองตอนจอง (min_rental_days–max_rental_days)
const EXAMPLE_RENTAL_DAYS = 2

// นโยบายร้านที่ยังไม่อยู่ใน booking_settings (ดู PRODUCT.md) ถ้าเปลี่ยนนโยบาย แก้ที่นี่ที่เดียว
const CANCEL_FREE_DAYS_BEFORE = 3
const PENDING_EXPIRE_MINUTES = 30
const DEPOSIT_REFUND_HOURS = 72

// ที่อยู่หน้าร้าน แสดงในหัวข้อ "ร้านอยู่ที่ไหน"
const STORE_NAME = 'CosMate'
const STORE_ADDRESS_LINES = ['88/24 ซอยรัชดาภิเษก 36 แขวงจันทรเกษม', 'เขตจตุจักร กรุงเทพมหานคร 10900']
const STORE_HOURS = 'เปิดให้บริการทุกวัน 10:00–19:00 น.'
const STORE_CLOSED = 'หยุดทุกวันอังคาร'
const STORE_MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${STORE_NAME} ${STORE_ADDRESS_LINES.join(' ')}`,
)}`

type Step = { title: string; when: string; icon: Icon; text: ReactNode; tip?: ReactNode }
type Phase = { name: string; steps: Step[] }

// จองล่วงหน้าขั้นต่ำแบบจัดส่ง — ไม่ขึ้นกับเวลา จึงใช้ minStartOffset ได้ตรง ๆ
function shipLeadDays(s: BookingSettings) {
  return minStartOffset(s, 'ship')
}

// รับเองที่ร้าน: ไม่เรียก minStartOffset เพราะผลขึ้นกับเวลาปัจจุบัน แสดงเป็นกติกาแทน
function pickupLeadText(s: BookingSettings) {
  return s.pickupLeadDays === 0
    ? `จองก่อน ${s.pickupCutoffHour}:00 รับได้วันนี้`
    : `จองล่วงหน้าอย่างน้อย ${s.pickupLeadDays} วัน`
}

// ตัวอย่างราคาบนหน้านี้เท่านั้น: ทั้งชุดราคา 1 วัน ฿500 / ชิ้นเดี่ยว ฿120 เช่า 3 วัน
const EXAMPLE_FULL_PRICE = 500
const EXAMPLE_PIECE_PRICE = 120
const EXAMPLE_PRICE_DAYS = 3

function exampleFullTotal(s: BookingSettings) {
  return EXAMPLE_FULL_PRICE + (EXAMPLE_PRICE_DAYS - 1) * s.extraDayRate
}

function examplePieceDayRate(s: BookingSettings) {
  return Math.ceil(Math.min((EXAMPLE_PIECE_PRICE * s.pieceExtraDayPercent) / 100, s.extraDayRate))
}

function buildPhases(s: BookingSettings): Phase[] {
  const pickup = s.pickupLocation
  return [
    {
      name: 'ก่อนวันงาน',
      steps: [
        {
          title: 'เลือกชุด',
          icon: DressIcon,
          when: 'ตามสบาย',
          text: 'ค้นตามชื่อตัวละคร ชื่อเรื่อง สี หรือไซส์ ในหน้าชุดมีรูป ตารางไซส์ และรีวิวจากคนที่เช่าไปแล้ว',
          tip: 'กดหัวใจเก็บชุดที่ชอบไว้ แล้วค่อยกลับมาเทียบทีหลัง',
        },
        {
          icon: CalendarCheckIcon,
          title: pickup ? 'เลือกไซส์ จำนวนวัน วิธีรับชุด และวันที่จะใส่' : 'เลือกไซส์ จำนวนวัน และวันที่จะใส่',
          when: `ล่วงหน้าอย่างน้อย ${shipLeadDays(s)} วัน`,
          text: (
            <>
              เลือกว่าจะเช่ากี่วัน ({s.minRentalDays}–{s.maxRentalDays} วัน)
              {pickup && <> แล้วเลือกว่าจะให้ร้านจัดส่งหรือมารับเองที่ร้าน</>} จากนั้นเลือก
              <b className="font-semibold text-brand">วันที่จะใส่ชุด</b> ปฏิทินให้กดได้เฉพาะวันที่ไซส์นั้นว่างตลอดช่วงที่เช่า
              ระบบคำนวณวันรับชุดและวันส่งคืนให้เอง
            </>
          ),
          tip: pickup ? (
            <>ปฏิทินเปลี่ยนตามวิธีรับชุด แบบจัดส่งต้องเผื่อวันขนส่ง ส่วนรับเองที่ร้าน{pickupLeadText(s)}</>
          ) : undefined,
        },
        {
          title: 'จ่ายเงินและแนบสลิป',
          icon: QrCodeIcon,
          when: `จ่ายภายใน ${PENDING_EXPIRE_MINUTES} นาที`,
          text: (
            <>
              เข้าสู่ระบบ (สมัครด้วยอีเมลอย่างเดียว) กรอกที่อยู่รับชุด
              {pickup && <> (รับเองที่ร้านกรอกแค่ชื่อและเบอร์โทร)</>} และบัญชีสำหรับรับมัดจำคืน แล้วสแกน QR จ่ายเงิน
              ระบบ<b className="font-semibold text-brand">ตรวจสลิปอัตโนมัติภายในไม่กี่นาที</b>
            </>
          ),
          tip: (
            <>
              ชุดถูกกันไว้ให้คุณตั้งแต่กดสร้างออเดอร์ ถ้าไม่จ่ายภายใน {PENDING_EXPIRE_MINUTES} นาที
              ออเดอร์จะหมดอายุและชุดกลับไปให้คนอื่นจองได้
            </>
          ),
        },
        {
          icon: PackageIcon,
          title: pickup ? 'รับชุดที่บ้าน หรือมารับที่ร้าน' : 'รับชุดที่บ้าน',
          when: pickup ? `ส่ง ${s.bufferDaysBefore} วันก่อนงาน · รับที่ร้านวันงาน` : `${s.bufferDaysBefore} วันก่อนวันงาน`,
          text: (
            <>
              ร้านแพ็กชุดส่งให้ถึงก่อนวันงาน ติดตามพัสดุได้ในหน้า &ldquo;ออเดอร์ของฉัน&rdquo;
              {pickup && <> ถ้าเลือกรับเองที่ร้าน มารับได้ในวันใส่ชุดตามเวลาเปิดร้าน แจ้งชื่อผู้มารับกับพนักงาน</>}{' '}
              <b className="font-semibold text-brand">ลองใส่ทันทีที่ได้รับ</b> ถ้าไซส์ไม่ได้หรือชุดมีปัญหา แจ้งร้านภายในวันนั้น
            </>
          ),
          tip: pickup ? (
            <>
              ต้องการชุดด่วน? เลือก &ldquo;รับเองที่ร้าน&rdquo; ตอนจอง ไม่มีค่าส่ง {pickupLeadText(s)}
              จะมารับเองหรือเรียกไรเดอร์มารับแทนก็ได้ ที่ {pickup.name}
              {pickup.hours && <> (เปิด {pickup.hours})</>}
            </>
          ) : undefined,
        },
      ],
    },
    {
      name: 'วันงาน',
      steps: [
        {
          title: 'ใส่ชุดไปงาน',
          icon: SparkleIcon,
          when: `ใช้ได้ ${EXAMPLE_RENTAL_DAYS} วัน*`,
          text: 'ใส่ไปงานคอสเพลย์ ปาร์ตี้ หรือถ่ายรูปได้เต็มที่ ระวังแค่สีทาตัวที่ล้างไม่ออก ของมีคมที่เกี่ยวผ้าขาด และการเปียกน้ำนาน ๆ',
          tip: `*ตัวอย่าง เลือกได้ ${s.minRentalDays}–${s.maxRentalDays} วันตอนจอง`,
        },
      ],
    },
    {
      name: 'หลังวันงาน',
      steps: [
        {
          icon: ArrowUUpLeftIcon,
          title: pickup ? 'ส่งชุดคืน หรือนำมาคืนที่ร้าน' : 'ส่งชุดคืน',
          when: 'ภายในวันส่งคืน',
          text: (
            <>
              พับชุดและอุปกรณ์ทั้งหมดใส่ถุงหรือกล่องเดิม ส่งพัสดุกลับแล้วกรอกเลขพัสดุในหน้าออเดอร์
              ภายในวันที่ระบุในออเดอร์{pickup && <> หรือนำมาคืนที่ร้านเองก็ได้ ไม่ต้องกรอกอะไร</>}{' '}
              <b className="font-semibold text-brand">ไม่ต้องซักเอง</b> ร้านทำความสะอาดให้
            </>
          ),
          tip: 'ถ่ายรูปชุดก่อนคืน และเก็บเลขพัสดุไว้จนกว่าจะได้มัดจำคืน',
        },
        {
          title: 'ได้มัดจำคืน',
          icon: HandCoinsIcon,
          when: `ภายใน ${DEPOSIT_REFUND_HOURS} ชม.`,
          text: (
            <>
              ร้านตรวจสภาพชุดเมื่อได้รับคืน ถ้าเรียบร้อยจะโอนมัดจำเข้าบัญชีที่คุณให้ไว้
              ภายใน {DEPOSIT_REFUND_HOURS} ชั่วโมง จากนั้นคุณรีวิวชุดได้เลย
            </>
          ),
        },
      ],
    },
  ]
}

const FAQS: { q: string; a: (s: BookingSettings) => ReactNode }[] = [
  {
    q: 'ทำไมจองวันใกล้ ๆ ไม่ได้',
    a: (s) => (
      <>
        แบบจัดส่ง ร้านต้องเตรียม แพ็ก และส่งชุดให้ถึงมือคุณก่อน จึงต้องจองล่วงหน้าอย่างน้อย{' '}
        <b className="font-semibold text-brand">{shipLeadDays(s)} วัน</b> ก่อนวันใช้งาน วันที่ใกล้กว่านั้นจะกดเลือกในปฏิทินไม่ได้
        {s.pickupLocation && (
          <>
            {' '}ถ้าต้องการชุดด่วน เลือก &ldquo;รับเองที่ร้าน&rdquo; ได้{' '}
            <b className="font-semibold text-brand">{pickupLeadText(s)}</b>
          </>
        )}
      </>
    ),
  },
  {
    q: 'เช่าหลายวันคิดราคายังไง',
    a: (s) => (
      <>
        ราคาบนหน้าชุดคือ<b className="font-semibold text-brand">ค่าเช่า 1 วัน</b> ตั้งแต่วันที่ 2 เช่าทั้งชุดบวกเพิ่มวันละ{' '}
        {formatBaht(s.extraDayRate)} เช่น ชุด {formatBaht(EXAMPLE_FULL_PRICE)} เช่า {EXAMPLE_PRICE_DAYS} วัน ={' '}
        <b className="font-semibold text-brand">{formatBaht(exampleFullTotal(s))}</b> ส่วนเช่าแยกชิ้น วันถัดไปคิด{' '}
        {s.pieceExtraDayPercent}% ของราคาชิ้นที่เลือก แต่ไม่เกินวันละ {formatBaht(s.extraDayRate)} เช่น ชิ้นราคา{' '}
        {formatBaht(EXAMPLE_PIECE_PRICE)} วันถัดไป +{formatBaht(examplePieceDayRate(s))}/วัน
        เงินมัดจำเท่าเดิมไม่ว่าจะเช่ากี่วัน
      </>
    ),
  },
  {
    q: 'มารับเองที่ร้าน หรือให้ไรเดอร์มารับแทนได้ไหม',
    a: (s) =>
      s.pickupLocation ? (
        <>
          ได้ เลือก &ldquo;รับเองที่ร้าน&rdquo; ตอนจอง ไม่มีค่าส่ง และ{pickupLeadText(s)} มารับที่{' '}
          {s.pickupLocation.name} {s.pickupLocation.address}
          {s.pickupLocation.hours && <> เวลา {s.pickupLocation.hours}</>} ถ้าเรียกไรเดอร์มารับแทน
          ให้ไรเดอร์แจ้งเลขออเดอร์และชื่อผู้จอง ค่าไรเดอร์ลูกค้าจ่ายเอง ชุดทั้งตะกร้าต้องใช้วิธีรับเดียวกัน
        </>
      ) : (
        <>ตอนนี้ร้านยังไม่เปิดให้รับชุดเองที่ร้าน ทุกออเดอร์จัดส่งถึงบ้าน</>
      ),
  },
  {
    q: 'ทำไมบางวันในปฏิทินถึงเป็นสีเทา ทั้งที่ไม่เห็นมีใครใช้วันนั้น',
    a: (s) => (
      <>
        การเช่าหนึ่งครั้งไม่ได้ใช้ชุดแค่วันที่เช่า แบบจัดส่งชุดต้องเดินทางไปถึงคุณก่อน {s.bufferDaysBefore} วัน
        และหลังวันส่งคืนร้านต้องใช้อีก {s.bufferDaysAfter} วันเพื่อรับคืน ตรวจสภาพ และทำความสะอาด
        วันรอบ ๆ การจองของคนอื่นจึงถูกกันไว้ด้วย อีกเรื่องคือชุดต้องว่างครบทุกวันตามจำนวนวันที่คุณเลือกเช่า
        ลองลดจำนวนวัน หรือเลือกไซส์อื่นของชุดเดียวกัน อาจว่างในวันที่คุณต้องการ
      </>
    ),
  },
  {
    q: 'เงินมัดจำจะได้คืนเมื่อไร',
    a: () => (
      <>
        ภายใน <b className="font-semibold text-brand">{DEPOSIT_REFUND_HOURS} ชั่วโมง</b> หลังร้านได้รับชุดคืนและตรวจสภาพเรียบร้อย
        โอนเข้าบัญชีที่คุณระบุไว้ตอนชำระเงิน (หรือบัญชีใน &ldquo;บัญชีของฉัน&rdquo;)
      </>
    ),
  },
  {
    q: 'ถ้าส่งชุดคืนช้าจะเป็นอย่างไร',
    a: (s) => (
      <>
        มีค่าปรับ <b className="font-semibold text-brand">{formatBaht(s.lateFeePerDay)} ต่อวัน</b> ต่อออเดอร์ หักจากเงินมัดจำ
        เพราะคิวเช่าถัดไปของชุดนั้นอาจได้รับผลกระทบ ถ้ามีเหตุจำเป็น แจ้งร้านก่อนถึงวันส่งคืน
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
            สูงสุด <b className="font-semibold text-brand">{s.maxPendingOrders} ออเดอร์</b> พร้อมกัน
          </>
        ) : (
          <>จำนวนจำกัด</>
        )}{' '}
        และแต่ละออเดอร์หมดอายุใน {PENDING_EXPIRE_MINUTES} นาทีถ้ายังไม่จ่าย ถ้าต้องการหลายชุด
        ใส่ตะกร้าแล้วชำระรวมในออเดอร์เดียวได้ จ่ายค่าส่งครั้งเดียว แต่ละชุดเลือกจำนวนวันเช่าต่างกันได้
        ส่วนวิธีรับชุดใช้แบบเดียวกันทั้งตะกร้า
      </>
    ),
  },
]

// ปุ่มตามระบบ v2: แคปซูล เส้น 1px เงาแข็งเฉพาะตอน hover (.lift)
const BTN_PRIMARY =
  'lift focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-line bg-brand px-5 text-body font-bold text-white active:bg-brand-strong'
const BTN_SECONDARY =
  'lift focus-ring inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 text-body font-semibold text-ink'

export default function HowItWorksPage() {
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)

  useEffect(() => {
    fetchBookingSettings().then(setSettings)
  }, [])

  const phases = buildPhases(settings)
  // เลขขั้นเรียงต่อกันข้ามช่วง: ช่วงที่ i เริ่มนับต่อจากจำนวนขั้นของช่วงก่อนหน้า
  const phaseStart = phases.map((_, i) => phases.slice(0, i).reduce((n, p) => n + p.steps.length, 0))

  return (
    <CustomerLayout>
      <div className="theme-v2 text-ink">
        {/* หัวหน้า: ชิดซ้าย โล่ง · ตัวเลขสำคัญอยู่ในแถบเส้นบางทางขวา */}
        <header className="pb-12 pt-2 sm:pt-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-12 lg:pb-16">
          <div className="lg:col-span-7">
            <h1 className="text-balance text-[32px] font-extrabold leading-[1.25] sm:text-[44px]">
              เช่าชุด
              <span className="relative inline-block">
                <span
                  aria-hidden
                  className="absolute inset-x-[-0.12em] bottom-[0.14em] h-[0.4em] -rotate-1 bg-brand-soft"
                />
                <span className="relative">ครั้งแรก</span>
              </span>
              ?
              <br />
              อ่านหน้านี้จบ แล้วจองเองได้เลย
            </h1>
            <p className="mt-4 max-w-[34em] text-body text-secondary">
              สมัครด้วย<b className="font-semibold text-brand">อีเมลอย่างเดียว</b> ไม่ต้องใช้บัตรประชาชน
              เลือกจำนวนวันและวันที่จะใส่ชุด จ่ายเงิน แล้วรอรับชุดที่บ้าน
              {settings.pickupLocation && <> หรือมารับเองที่ร้าน</>} ด้านล่างคือทุกเรื่องที่ควรรู้ก่อนจ่าย
              ทั้งเงินมัดจำ วันส่งคืน และเงื่อนไขยกเลิก
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/costumes" className={BTN_PRIMARY}>
                เริ่มเลือกชุด <ArrowRightIcon size={16} weight="bold" />
              </Link>
              <a
                href="#cancel"
                className="focus-ring text-body font-semibold text-ink underline decoration-line-subtle decoration-2 underline-offset-4 hover:decoration-ink"
              >
                อ่านเงื่อนไขยกเลิก
              </a>
            </div>
          </div>

          <dl className="mt-10 grid grid-cols-2 rounded-card border border-brand-soft bg-brand-subtle px-4 lg:col-span-5 lg:mt-0">
            <Fact
              label="จองล่วงหน้าอย่างน้อย"
              value={shipLeadDays(settings)}
              unit={settings.pickupLocation ? 'วัน (จัดส่ง)' : 'วัน'}
            />
            <Fact
              label="ค่าส่งต่อออเดอร์"
              value={formatBaht(settings.shippingFlatRate)}
              unit={settings.pickupLocation ? 'รับที่ร้านฟรี' : undefined}
            />
            <Fact label="ยกเลิกได้ถึง" value={CANCEL_FREE_DAYS_BEFORE} unit="วันก่อนงาน" />
            <Fact label="มัดจำคืนภายใน" value={DEPOSIT_REFUND_HOURS} unit="ชั่วโมง" />
          </dl>
        </header>

        <RentalTimelineExample settings={settings} />

        {/* ขั้นตอน: เส้นเดียวต่อเนื่อง แบ่ง 3 ช่วงตามวันงาน */}
        <section className="border-t border-line py-14 lg:grid lg:grid-cols-12 lg:gap-12 lg:py-20">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <h2 className="text-h1 font-bold">ตั้งแต่เลือกชุด จนได้มัดจำคืน</h2>
              <p className="mt-2 max-w-[28em] text-body text-secondary">
                สามขั้นแรกทำบนเว็บจนจบ ที่เหลือคือรอชุด ใส่ชุด และส่งคืน ทุกขั้นดูสถานะได้ในหน้า
                &ldquo;ออเดอร์ของฉัน&rdquo;
              </p>
            </div>
          </div>

          {/* เส้นชมพูอ่อนวิ่งผ่านกลางวงไอคอน (2.5rem → กึ่งกลาง 1.25rem) */}
          <ol className="relative mt-8 before:absolute before:bottom-5 before:left-[1.25rem] before:top-3 before:w-0.5 before:-translate-x-1/2 before:bg-brand-soft lg:col-span-8 lg:mt-1">
            {phases.map((phase, pi) => (
              <li key={phase.name} className="mb-6 last:mb-0">
                <div className="relative grid grid-cols-[2.5rem_1fr] items-center gap-x-4">
                  <span aria-hidden className="mx-auto h-3 w-3 rotate-45 bg-brand ring-4 ring-surface" />
                  <h3 className="justify-self-start rounded-full bg-brand-subtle px-3 py-0.5 text-body-sm font-bold text-brand">
                    {phase.name}
                  </h3>
                </div>
                <ol>
                  {phase.steps.map((step, si) => {
                    const StepIcon = step.icon
                    return (
                      <li key={step.title} className="relative grid grid-cols-[2.5rem_1fr] gap-x-4 pt-5">
                        <span
                          aria-hidden
                          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white ring-4 ring-surface"
                        >
                          <StepIcon size={20} weight="bold" />
                        </span>
                        <div className="border-b border-line-subtle pb-5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                            <h4 className="text-[18px] font-bold leading-snug">
                              <span className="mr-1.5 tabular-nums text-brand">{phaseStart[pi] + si + 1}.</span>
                              {step.title}
                            </h4>
                            <span className="rounded-full bg-brand-subtle px-2.5 py-0.5 text-body-sm font-semibold tabular-nums text-brand">
                              {step.when}
                            </span>
                          </div>
                          <p className="mt-1.5 max-w-[38em] text-body text-secondary">{step.text}</p>
                          {step.tip && (
                            <p className="mt-3 max-w-[38em] rounded-control border-l-4 border-brand bg-brand-subtle px-3 py-2 text-body-sm text-secondary">
                              {step.tip}
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </li>
            ))}
          </ol>
        </section>

        {/* เงิน + สิ่งที่ต้องเตรียม: แน่น อ่านแบบใบเสร็จ */}
        <section className="border-t border-line py-12 lg:grid lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <h2 className="text-h1 font-bold">จ่ายอะไรบ้าง</h2>
            <p className="mt-2 text-body text-secondary">ทุกยอดแสดงครบในหน้าชำระเงินก่อนกดยืนยัน</p>

            <dl className="mt-6 divide-y divide-line-subtle border-y border-line-subtle">
              <ReceiptRow
                label="ค่าเช่า"
                value={`วันแรกตามชุด · วันถัดไป +${formatBaht(settings.extraDayRate)}/วัน`}
                note={`เช่น ชุด ${formatBaht(EXAMPLE_FULL_PRICE)} เช่า ${EXAMPLE_PRICE_DAYS} วัน = ${formatBaht(
                  exampleFullTotal(settings),
                )} · เช่าแยกชิ้น วันถัดไปคิด ${settings.pieceExtraDayPercent}% ของราคาชิ้น แต่ไม่เกิน ${formatBaht(
                  settings.extraDayRate,
                )}/วัน`}
              />
              <ReceiptRow label="ค่าซักทำความสะอาด" value="บางชุด" />
              <ReceiptRow
                label="เงินมัดจำ"
                value="ตามชุด · ได้คืน"
                note="ไม่เพิ่มตามจำนวนวันเช่า ดูยอดมัดจำของแต่ละชุดในหน้ารายละเอียดชุด"
              />
              <ReceiptRow
                label="ค่าจัดส่ง"
                value={`${formatBaht(settings.shippingFlatRate)} / ออเดอร์`}
                note={
                  settings.pickupLocation
                    ? 'เช่าหลายชุดในออเดอร์เดียว จ่ายค่าส่งครั้งเดียว · รับเองที่ร้านไม่มีค่าส่ง'
                    : 'เช่าหลายชุดในออเดอร์เดียว จ่ายค่าส่งครั้งเดียว'
                }
              />
            </dl>

            <h3 className="mt-10 text-h3 font-bold">ที่อาจถูกหักจากมัดจำ</h3>
            <dl className="mt-3 divide-y divide-line-subtle border-y border-line-subtle">
              <ReceiptRow label="ส่งชุดคืนช้า" value={`${formatBaht(settings.lateFeePerDay)} / วัน`} />
              <ReceiptRow label={`ยกเลิกช้ากว่า ${CANCEL_FREE_DAYS_BEFORE} วันก่อนวันงาน`} value="ยึดมัดจำ" />
              <ReceiptRow label="ชุดเสียหายซ่อมไม่ได้ หรืออุปกรณ์หาย" value="ตามจริง" />
            </dl>
          </div>

          <aside className="mt-12 rounded-card border border-brand-soft bg-brand-subtle p-5 sm:p-6 lg:col-span-5 lg:mt-0 lg:self-start">
            <h2 className="text-h2 font-bold">ต้องเตรียมอะไรบ้าง</h2>
            <p className="mt-1 text-body text-secondary">
              <b className="font-semibold text-brand">ไม่ต้องใช้บัตรประชาชน</b> หรือสำเนาเอกสารใด ๆ แค่มีสี่อย่างนี้
            </p>
            <ul className="mt-4 divide-y divide-brand-soft border-t border-brand-soft">
              <Need title="อีเมล" text="ใช้สมัครสมาชิก" />
              <Need
                title="ที่อยู่รับชุด"
                text={settings.pickupLocation ? 'กรอกตอนจ่ายเงิน (รับที่ร้านใช้แค่ชื่อและเบอร์โทร)' : 'กรอกตอนจ่ายเงิน'}
              />
              <Need title="บัญชีธนาคาร" text={'สำหรับรับมัดจำคืน บันทึกไว้ใน "บัญชีของฉัน" ได้'} />
              <Need title="แอปธนาคาร" text="ใช้สแกน QR จ่ายเงิน" />
            </ul>
          </aside>
        </section>

        {/* เงื่อนไขยกเลิก */}
        <section id="cancel" className="scroll-mt-24 border-t border-line py-12 lg:grid lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <h2 className="text-h1 font-bold">ยกเลิกได้ไหม</h2>
            <p className="mt-2 text-body text-secondary">
              ได้ เส้นตายคือ {CANCEL_FREE_DAYS_BEFORE} วันก่อนวันงาน ถึงจะช้ากว่านั้นก็เสียแค่มัดจำ ค่าเช่ายังได้คืน
            </p>
          </div>

          <div className="mt-8 lg:col-span-8 lg:mt-1">
            <div className="grid grid-cols-[2fr_1fr] text-body-sm" aria-hidden>
              <div className="rounded-tl-control border-t-4 border-brand bg-brand-subtle px-3 py-2">
                <p className="font-bold text-brand">ได้ค่าเช่าและมัดจำคืน</p>
                <p className="text-muted">จ่ายเงินแล้ว ถึง {CANCEL_FREE_DAYS_BEFORE} วันก่อนวันงาน</p>
              </div>
              <div className="rounded-tr-control border-t-4 border-line-subtle bg-sunken px-3 py-2">
                <p className="font-bold">ยึดมัดจำ</p>
                <p className="text-muted">ค่าเช่ายังได้คืน</p>
              </div>
            </div>

            <ul className="mt-8 divide-y divide-line-subtle border-y border-line-subtle text-body">
              <Rule when="ยังไม่ได้จ่ายเงิน">
                กด &ldquo;ยกเลิกออเดอร์&rdquo; ในหน้าออเดอร์ได้ทันที หรือปล่อยไว้ ออเดอร์จะหมดอายุเองใน{' '}
                {PENDING_EXPIRE_MINUTES} นาที <b className="font-semibold text-brand">ไม่เสียอะไรเลย</b>
              </Rule>
              <Rule when={`จ่ายแล้ว เหลือ ${CANCEL_FREE_DAYS_BEFORE} วันขึ้นไป`}>
                ยกเลิกได้ <b className="font-semibold text-brand">ได้ทั้งค่าเช่าและมัดจำคืน</b>
              </Rule>
              <Rule when={`จ่ายแล้ว เหลือน้อยกว่า ${CANCEL_FREE_DAYS_BEFORE} วัน`}>
                ร้าน<b className="font-semibold text-brand">ยึดเงินมัดจำ</b> เพราะชุดถูกกันไว้ให้คุณจนรับคนอื่นไม่ทันแล้ว
                ส่วน<b className="font-semibold text-brand">ค่าเช่าได้คืน</b>
              </Rule>
              <Rule when="ร้านส่งชุดให้ไม่ได้">
                ร้านเปลี่ยนเป็นตัวสำรองให้ ถ้าไม่มีจะยกเลิกและ<b className="font-semibold text-brand">คืนเงินเต็มจำนวน</b>
              </Rule>
            </ul>
          </div>
        </section>

        {/* ควรทำ / อย่าทำ */}
        <section className="border-t border-line py-12">
          <h2 className="text-h1 font-bold">ดูแลชุดยังไงให้ได้มัดจำคืนครบ</h2>
          <div className="mt-6 grid gap-x-12 gap-y-8 md:grid-cols-2">
            <div>
              <h3 className="border-b-2 border-brand pb-2 text-h3 font-bold text-brand">ควรทำ</h3>
              <ul className="divide-y divide-line-subtle text-body text-secondary">
                <ListItem kind="do">
                  <b className="font-semibold text-brand">ลองใส่ทันที</b>ที่ได้รับ เจอปัญหาแจ้งร้านภายในวันนั้น
                </ListItem>
                <ListItem kind="do">
                  <b className="font-semibold text-brand">ถ่ายรูปชุด</b>ก่อนแพ็กส่งคืน เก็บไว้เป็นหลักฐาน
                </ListItem>
                <ListItem kind="do">
                  ส่งคืน<b className="font-semibold text-brand">อุปกรณ์ให้ครบทุกชิ้น</b> ทั้งวิก พร็อพ และเครื่องประดับ
                </ListItem>
                <ListItem kind="do">
                  <b className="font-semibold text-brand">เก็บเลขพัสดุ</b>ตอนส่งคืนไว้จนกว่าจะได้มัดจำ
                </ListItem>
              </ul>
            </div>
            <div>
              <h3 className="border-b-2 border-line pb-2 text-h3 font-bold">อย่าทำ</h3>
              <ul className="divide-y divide-line-subtle text-body text-secondary">
                <ListItem kind="dont">
                  <b className="font-semibold text-ink">ซักหรือรีดเอง</b> ร้านทำความสะอาดให้ตามชนิดผ้า
                </ListItem>
                <ListItem kind="dont">
                  <b className="font-semibold text-ink">ตัด เย็บ ติดกาว</b> หรือดัดแปลงชุดและวิก
                </ListItem>
                <ListItem kind="dont">
                  ใช้<b className="font-semibold text-ink">สีทาตัวหรือสเปรย์สี</b>ที่อาจเปื้อนชุดถาวร
                </ListItem>
                <ListItem kind="dont">
                  <b className="font-semibold text-ink">ให้คนอื่นยืมใส่</b>หรือเช่าต่อ
                </ListItem>
              </ul>
            </div>
          </div>
        </section>

        {/* คำถามที่พบบ่อย */}
        <section id="faq" className="scroll-mt-24 border-t border-line py-14 lg:grid lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <h2 className="text-h1 font-bold lg:sticky lg:top-24">คำถามที่เจอบ่อย</h2>
          </div>
          <div className="mt-6 divide-y divide-line-subtle border-y border-line-subtle lg:col-span-8 lg:mt-0">
            {FAQS.map((f) => (
              <details key={f.q} className="group">
                <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-body font-semibold text-ink transition-colors hover:bg-brand-subtle group-open:text-brand [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <CaretDownIcon
                    size={18}
                    weight="bold"
                    className="flex-shrink-0 text-muted transition-transform group-open:rotate-180 group-open:text-brand"
                  />
                </summary>
                <p className="max-w-[40em] pb-5 text-body text-secondary">{f.a(settings)}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ที่อยู่หน้าร้าน */}
        <section id="store" className="scroll-mt-24 border-t border-line py-12 lg:grid lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <h2 className="text-h1 font-bold">ร้านอยู่ที่ไหน</h2>
            <p className="mt-2 max-w-[28em] text-body text-secondary">มารับหรือคืนชุดเองที่ร้านได้ตามเวลาเปิดร้าน</p>
          </div>
          <div className="mt-6 lg:col-span-8 lg:mt-1">
            <div className="flex gap-4 rounded-card border border-brand-soft bg-brand-subtle p-5 sm:p-6">
              <span
                aria-hidden
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white"
              >
                <MapPinIcon size={20} weight="bold" />
              </span>
              <div>
                <address className="not-italic">
                  <p className="text-h3 font-bold">{STORE_NAME}</p>
                  {STORE_ADDRESS_LINES.map((line) => (
                    <p key={line} className="text-body text-secondary">
                      {line}
                    </p>
                  ))}
                </address>
                <p className="mt-3 text-body font-semibold">
                  {STORE_HOURS} <span className="text-brand">({STORE_CLOSED})</span>
                </p>
                <a
                  href={STORE_MAP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring mt-3 inline-flex items-center gap-1.5 text-body font-semibold text-ink underline decoration-line-subtle decoration-2 underline-offset-4 hover:decoration-ink"
                >
                  เปิดใน Google Maps <ArrowRightIcon size={14} weight="bold" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ปิดท้าย: โล่ง ชิดซ้าย */}
        <section className="border-t border-line pb-8 pt-16 sm:pt-20">
          <h2 className="max-w-[16em] text-[26px] font-extrabold leading-[1.3] sm:text-[32px]">ยังไม่แน่ใจเรื่องไซส์?</h2>
          <p className="mt-3 max-w-[34em] text-body text-secondary">
            ทุกชุดมีตารางไซส์และรีวิวจากคนที่เช่าไปแล้วในหน้าชุด เทียบกับเสื้อผ้าที่ใส่อยู่ก่อนเลือก
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/costumes?category=cosplay" className={BTN_PRIMARY}>
              ดูชุดคอสเพลย์
            </Link>
            <Link href="/costumes?category=fancy" className={BTN_SECONDARY}>
              ดูชุดแฟนซี
            </Link>
          </div>
        </section>
      </div>
    </CustomerLayout>
  )
}

function Fact({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="border-brand-soft py-4 odd:border-r odd:pr-4 even:pl-4 [&:nth-child(-n+2)]:border-b">
      <dt className="text-body-sm text-secondary">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-h1 font-bold tabular-nums text-brand">{value}</span>
        {unit && <span className="text-body-sm font-semibold">{unit}</span>}
      </dd>
    </div>
  )
}

function ReceiptRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <dt className="text-body font-semibold">{label}</dt>
      <dd>
        <p className="text-body font-semibold tabular-nums text-brand">{value}</p>
        {note && <p className="mt-1 text-body-sm text-muted">{note}</p>}
      </dd>
    </div>
  )
}

function Need({ title, text }: { title: string; text: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-3">
      <span className="text-body font-semibold">{title}</span>
      <span className="text-right text-body-sm text-secondary">{text}</span>
    </li>
  )
}

function Rule({ when, children }: { when: string; children: ReactNode }) {
  return (
    <li className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
      <span className="font-bold text-brand">{when}</span>
      <span className="text-secondary">{children}</span>
    </li>
  )
}

function ListItem({ kind, children }: { kind: 'do' | 'dont'; children: ReactNode }) {
  const ItemIcon = kind === 'do' ? CheckIcon : XIcon
  return (
    <li className="flex gap-3 py-3">
      <span
        aria-hidden
        className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
          kind === 'do' ? 'bg-brand text-white' : 'bg-sunken text-muted'
        }`}
      >
        <ItemIcon size={12} weight="bold" />
      </span>
      <span>{children}</span>
    </li>
  )
}

// ไทม์ไลน์ตัวอย่าง: คำนวณจากค่าตั้งค่าจริง แบบเดียวกับ create_booking()
// ล็อก = [วันใช้งาน - before, วันใช้งาน + จำนวนวันเช่า - 1 + after]
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
  for (let i = 1; i < EXAMPLE_RENTAL_DAYS; i++) {
    days.push({
      key: `r${i}`,
      label: i === EXAMPLE_RENTAL_DAYS - 1 ? 'ส่งคืน' : 'ใช้งานต่อ',
      kind: i === EXAMPLE_RENTAL_DAYS - 1 ? 'return' : 'use',
    })
  }
  for (let i = 1; i <= settings.bufferDaysAfter; i++) {
    days.push({ key: `a${i}`, label: 'ร้านตรวจ/ซัก', kind: 'buffer' })
  }

  const useIndex = settings.bufferDaysBefore

  // สีเน้นมีที่เดียวคือวันใช้งาน ที่เหลือแยกด้วยน้ำหนักตัวอักษรและลายเส้น
  const style: Record<Day['kind'], string> = {
    receive: 'bg-surface text-ink font-semibold',
    use: 'bg-brand-soft text-brand font-bold',
    return: 'bg-brand-subtle text-brand font-bold',
    buffer:
      'text-muted font-medium bg-[repeating-linear-gradient(135deg,var(--color-sunken)_0_6px,var(--color-surface)_6px_12px)]',
  }

  return (
    <section className="border-t border-line py-12 lg:grid lg:grid-cols-12 lg:gap-12 lg:py-14">
      <div className="lg:col-span-4">
        <h2 className="text-h1 font-bold">เช่า {EXAMPLE_RENTAL_DAYS} วัน นับยังไง</h2>
        <p className="mt-2 max-w-[30em] text-body text-secondary">
          คุณเลือกแค่<b className="font-semibold text-brand">วันใช้งาน</b> วันเช่านับจากวันใช้งานถึงวันส่งคืน
          ส่วนวันที่ชุดเดินทางมาถึงคุณ<b className="font-semibold text-brand">ไม่นับ</b>เป็นวันเช่า
        </p>
      </div>

      <div className="mt-6 lg:col-span-8 lg:mt-1">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div
            className="flex overflow-hidden rounded-control border border-line"
            style={{ minWidth: days.length * 68 }}
          >
            {days.map((d, i) => {
              const offset = i - useIndex
              return (
                <div key={d.key} className="flex-1 border-l border-line first:border-l-0">
                  <p
                    className={`border-b border-line-subtle py-1.5 text-center text-caption font-semibold tabular-nums ${
                      offset === 0 ? 'bg-brand-strong text-white' : 'text-muted'
                    }`}
                  >
                    {offset === 0 ? 'วันงาน' : offset > 0 ? `+${offset}` : `−${-offset}`}
                  </p>
                  <div className={`flex h-16 items-center justify-center px-1 text-center text-body-sm ${style[d.kind]}`}>
                    {d.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-2 text-body-sm sm:grid-cols-2">
          <TimelineNote term="รับชุด" text="พัสดุถึงมือคุณ ไม่นับเป็นวันเช่า" />
          <TimelineNote term="วันใช้งาน" text="วันที่คุณเลือกในปฏิทิน" />
          <TimelineNote term="ส่งคืน" text="ส่งพัสดุกลับภายในวันนี้" />
          <TimelineNote term="ร้านตรวจ/ซัก" text="ร้านรับคืน ตรวจสภาพ ทำความสะอาด" />
        </dl>

        <p className="mt-6 max-w-[40em] border-t border-line-subtle pt-4 text-body text-secondary">
          เพราะแบบนี้ ชุดหนึ่งตัวจึง<b className="font-semibold text-brand">ไม่ว่างรวม {days.length} วัน</b>ต่อการเช่าหนึ่งครั้ง
          ถ้าวันที่อยากได้ไม่ว่าง ลองเปลี่ยนไซส์ ลดจำนวนวันเช่า หรือเลือกชุดอื่นของตัวละครเดียวกัน
        </p>
        {settings.pickupLocation && (
          <p className="mt-3 max-w-[40em] text-body text-secondary">
            ถ้า<b className="font-semibold text-brand">รับเองที่ร้าน</b> ไม่มีวันชุดเดินทาง รับชุดได้ในวันใช้งานเลย
            ชุดจึงไม่ว่างแค่ {EXAMPLE_RENTAL_DAYS + settings.bufferDaysAfter} วัน
          </p>
        )}
      </div>
    </section>
  )
}

function TimelineNote({ term, text }: { term: string; text: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-bold text-brand">{term}</dt>
      <dd className="text-secondary">{text}</dd>
    </div>
  )
}
