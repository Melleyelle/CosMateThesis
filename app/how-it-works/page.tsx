'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRightIcon, CaretDownIcon } from '@phosphor-icons/react'
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

// นโยบายร้านที่ยังไม่อยู่ใน booking_settings (ดู PRODUCT.md) ถ้าเปลี่ยนนโยบาย แก้ที่นี่ที่เดียว
const CANCEL_FREE_DAYS_BEFORE = 3
const PENDING_EXPIRE_MINUTES = 30
const DEPOSIT_REFUND_HOURS = 72

type Step = { title: string; when: string; text: ReactNode; tip?: ReactNode }
type Phase = { name: string; steps: Step[] }

function buildPhases(s: BookingSettings): Phase[] {
  return [
    {
      name: 'ก่อนวันงาน',
      steps: [
        {
          title: 'เลือกชุด',
          when: 'ตามสบาย',
          text: 'ค้นตามชื่อตัวละคร ชื่อเรื่อง สี หรือไซส์ ในหน้าชุดมีรูป ตารางไซส์ และรีวิวจากคนที่เช่าไปแล้ว',
          tip: 'กดหัวใจเก็บชุดที่ชอบไว้ แล้วค่อยกลับมาเทียบทีหลัง',
        },
        {
          title: 'เลือกไซส์และวันที่จะใส่',
          when: `ล่วงหน้าอย่างน้อย ${s.minLeadDays} วัน`,
          text: (
            <>
              ปฏิทินให้กดได้เฉพาะวันที่ไซส์นั้นว่างจริง คุณเลือกแค่<b className="font-semibold text-ink">วันที่จะใส่ชุด</b>{' '}
              ระบบคำนวณวันรับชุดและวันส่งคืนให้เอง
            </>
          ),
        },
        {
          title: 'จ่ายเงินและแนบสลิป',
          when: `จ่ายภายใน ${PENDING_EXPIRE_MINUTES} นาที`,
          text: (
            <>
              เข้าสู่ระบบ (สมัครด้วยอีเมลอย่างเดียว) กรอกที่อยู่รับชุดและบัญชีสำหรับรับมัดจำคืน แล้วสแกน QR จ่ายเงิน
              ระบบ<b className="font-semibold text-ink">ตรวจสลิปอัตโนมัติภายในไม่กี่นาที</b>
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
          title: 'รับชุดที่บ้าน',
          when: `${s.bufferDaysBefore} วันก่อนวันงาน`,
          text: (
            <>
              ร้านแพ็กชุดส่งให้ถึงก่อนวันงาน <b className="font-semibold text-ink">ลองใส่ทันทีที่ได้รับ</b>{' '}
              ถ้าไซส์ไม่ได้หรือชุดมีปัญหา แจ้งร้านภายในวันนั้น ติดตามพัสดุได้ในหน้า &ldquo;ออเดอร์ของฉัน&rdquo;
            </>
          ),
        },
      ],
    },
    {
      name: 'วันงาน',
      steps: [
        {
          title: 'ใส่ชุดไปงาน',
          when: `ใช้ได้ ${EXAMPLE_PACKAGE_DAYS} วัน*`,
          text: 'ใส่ไปงานคอสเพลย์ ปาร์ตี้ หรือถ่ายรูปได้เต็มที่ ระวังแค่สีทาตัวที่ล้างไม่ออก ของมีคมที่เกี่ยวผ้าขาด และการเปียกน้ำนาน ๆ',
          tip: '*จำนวนวันขึ้นกับชุด ดูได้ในหน้ารายละเอียดชุด',
        },
      ],
    },
    {
      name: 'หลังวันงาน',
      steps: [
        {
          title: 'ส่งชุดคืน',
          when: 'ภายในวันส่งคืน',
          text: (
            <>
              พับชุดและอุปกรณ์ทั้งหมดใส่ถุงหรือกล่องเดิม ส่งกลับภายในวันที่ระบุในออเดอร์{' '}
              <b className="font-semibold text-ink">ไม่ต้องซักเอง</b> ร้านทำความสะอาดให้
            </>
          ),
          tip: 'ถ่ายรูปชุดก่อนแพ็ก และเก็บเลขพัสดุไว้จนกว่าจะได้มัดจำคืน',
        },
        {
          title: 'ได้มัดจำคืน',
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
        ร้านต้องใช้เวลาเตรียม ทำความสะอาด และจัดส่งชุด จึงต้องจองล่วงหน้าอย่างน้อย{' '}
        <b className="font-semibold text-ink">{s.minLeadDays} วัน</b> ก่อนวันใช้งาน วันที่ใกล้กว่านั้นจะกดเลือกในปฏิทินไม่ได้
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
    q: 'เงินมัดจำจะได้คืนเมื่อไร',
    a: () => (
      <>
        ภายใน <b className="font-semibold text-ink">{DEPOSIT_REFUND_HOURS} ชั่วโมง</b> หลังร้านได้รับชุดคืนและตรวจสภาพเรียบร้อย
        โอนเข้าบัญชีที่คุณระบุไว้ตอนชำระเงิน (หรือบัญชีใน &ldquo;บัญชีของฉัน&rdquo;)
      </>
    ),
  },
  {
    q: 'ถ้าส่งชุดคืนช้าจะเป็นอย่างไร',
    a: (s) => (
      <>
        มีค่าปรับ <b className="font-semibold text-ink">{formatBaht(s.lateFeePerDay)} ต่อวัน</b> ต่อออเดอร์ หักจากเงินมัดจำ
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
            สูงสุด <b className="font-semibold text-ink">{s.maxPendingOrders} ออเดอร์</b> พร้อมกัน
          </>
        ) : (
          <>จำนวนจำกัด</>
        )}{' '}
        และแต่ละออเดอร์หมดอายุใน {PENDING_EXPIRE_MINUTES} นาทีถ้ายังไม่จ่าย ถ้าต้องการหลายชุด
        ใส่ตะกร้าแล้วชำระรวมในออเดอร์เดียวได้ จ่ายค่าส่งครั้งเดียว
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
      <div className="theme-v2 text-ink selection:bg-brand-soft selection:text-ink">
        {/* หัวหน้า: ชิดซ้าย โล่ง · ตัวเลขสำคัญอยู่ในแถบเส้นบางทางขวา */}
        <header className="pb-12 pt-2 sm:pt-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-12 lg:pb-16">
          <div className="lg:col-span-7">
            <h1 className="text-balance text-[32px] font-extrabold leading-[1.25] sm:text-[44px]">
              เช่าชุด
              <span className="relative inline-block">
                <span
                  aria-hidden
                  className="absolute inset-x-[-0.12em] bottom-[0.14em] h-[0.4em] -rotate-1 bg-deco-yellow"
                />
                <span className="relative">ครั้งแรก</span>
              </span>
              ?
              <br />
              อ่านหน้านี้จบ แล้วจองเองได้เลย
            </h1>
            <p className="mt-4 max-w-[34em] text-body text-secondary">
              สมัครด้วย<b className="font-semibold text-ink">อีเมลอย่างเดียว</b> ไม่ต้องใช้บัตรประชาชน
              เลือกวันที่จะใส่ชุด จ่ายเงิน แล้วรอรับชุดที่บ้าน ด้านล่างคือทุกเรื่องที่ควรรู้ก่อนจ่าย
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

          <dl className="mt-10 grid grid-cols-2 border-y border-line lg:col-span-5 lg:mt-0">
            <Fact label="จองล่วงหน้าอย่างน้อย" value={settings.minLeadDays} unit="วัน" />
            <Fact label="ค่าส่งต่อออเดอร์" value={formatBaht(settings.shippingFlatRate)} />
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

          <ol className="relative mt-8 before:absolute before:bottom-3 before:left-[0.9rem] before:top-3 before:w-px before:bg-line-subtle lg:col-span-8 lg:mt-1">
            {phases.map((phase, pi) => (
              <li key={phase.name} className="mb-6 last:mb-0">
                <div className="relative grid grid-cols-[1.8rem_1fr] items-center gap-x-4">
                  <span aria-hidden className="mx-auto h-2.5 w-2.5 bg-ink" />
                  <h3 className="text-body-sm font-bold text-ink">{phase.name}</h3>
                </div>
                <ol>
                  {phase.steps.map((step, si) => {
                    return (
                      <li key={step.title} className="relative grid grid-cols-[1.8rem_1fr] gap-x-4 pt-5">
                        <span className="relative bg-surface py-0.5 text-center text-body font-bold tabular-nums text-muted">
                          {phaseStart[pi] + si + 1}
                        </span>
                        <div className="border-b border-line-subtle pb-5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                            <h4 className="text-[18px] font-bold leading-snug">{step.title}</h4>
                            <span className="text-body-sm font-semibold tabular-nums text-ink">{step.when}</span>
                          </div>
                          <p className="mt-1.5 max-w-[38em] text-body text-secondary">{step.text}</p>
                          {step.tip && <p className="mt-2 max-w-[38em] text-body-sm text-muted">{step.tip}</p>}
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

            <dl className="mt-6">
              <ReceiptRow label="ค่าเช่า" value="ตามชุด" />
              <ReceiptRow label="ค่าซักทำความสะอาด" value="บางชุด" />
              <ReceiptRow label="เงินมัดจำ" value="ตามชุด · ได้คืน" note="ดูยอดมัดจำของแต่ละชุดในหน้ารายละเอียดชุด" />
              <ReceiptRow
                label="ค่าจัดส่ง"
                value={`${formatBaht(settings.shippingFlatRate)} / ออเดอร์`}
                note="เช่าหลายชุดในออเดอร์เดียว จ่ายค่าส่งครั้งเดียว"
              />
            </dl>

            <h3 className="mt-10 text-h3 font-bold">ที่อาจถูกหักจากมัดจำ</h3>
            <dl className="mt-2">
              <ReceiptRow label="ส่งชุดคืนช้า" value={`${formatBaht(settings.lateFeePerDay)} / วัน`} />
              <ReceiptRow label={`ยกเลิกช้ากว่า ${CANCEL_FREE_DAYS_BEFORE} วันก่อนวันงาน`} value="ยึดมัดจำ" />
              <ReceiptRow label="ชุดเสียหายซ่อมไม่ได้ หรืออุปกรณ์หาย" value="ตามจริง" />
            </dl>
          </div>

          <aside className="mt-12 rounded-card bg-sunken p-5 sm:p-6 lg:col-span-5 lg:mt-0 lg:self-start">
            <h2 className="text-h2 font-bold">ต้องเตรียมอะไรบ้าง</h2>
            <p className="mt-1 text-body text-secondary">
              <b className="font-semibold text-ink">ไม่ต้องใช้บัตรประชาชน</b> หรือสำเนาเอกสารใด ๆ แค่มีสี่อย่างนี้
            </p>
            <ul className="mt-4 divide-y divide-line-subtle border-t border-line-subtle">
              <Need title="อีเมล" text="ใช้สมัครสมาชิก" />
              <Need title="ที่อยู่รับชุด" text="กรอกตอนจ่ายเงิน" />
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
              <div className="border-t-2 border-ink pr-3 pt-2">
                <p className="font-bold">ได้ค่าเช่าและมัดจำคืน</p>
                <p className="text-muted">จ่ายเงินแล้ว ถึง {CANCEL_FREE_DAYS_BEFORE} วันก่อนวันงาน</p>
              </div>
              <div className="border-l border-t-2 border-l-line-subtle border-t-line-subtle pl-3 pt-2">
                <p className="font-bold">ยึดมัดจำ</p>
                <p className="text-muted">ค่าเช่ายังได้คืน</p>
              </div>
            </div>

            <ul className="mt-8 divide-y divide-line-subtle border-y border-line-subtle text-body">
              <Rule when="ยังไม่ได้จ่ายเงิน">
                กด &ldquo;ยกเลิกออเดอร์&rdquo; ในหน้าออเดอร์ได้ทันที หรือปล่อยไว้ ออเดอร์จะหมดอายุเองใน{' '}
                {PENDING_EXPIRE_MINUTES} นาที <b className="font-semibold text-ink">ไม่เสียอะไรเลย</b>
              </Rule>
              <Rule when={`จ่ายแล้ว เหลือ ${CANCEL_FREE_DAYS_BEFORE} วันขึ้นไป`}>
                ยกเลิกได้ <b className="font-semibold text-ink">ได้ทั้งค่าเช่าและมัดจำคืน</b>
              </Rule>
              <Rule when={`จ่ายแล้ว เหลือน้อยกว่า ${CANCEL_FREE_DAYS_BEFORE} วัน`}>
                ร้าน<b className="font-semibold text-ink">ยึดเงินมัดจำ</b> เพราะชุดถูกกันไว้ให้คุณจนรับคนอื่นไม่ทันแล้ว
                ส่วน<b className="font-semibold text-ink">ค่าเช่าได้คืน</b>
              </Rule>
              <Rule when="ร้านส่งชุดให้ไม่ได้">
                ร้านเปลี่ยนเป็นตัวสำรองให้ ถ้าไม่มีจะยกเลิกและ<b className="font-semibold text-ink">คืนเงินเต็มจำนวน</b>
              </Rule>
            </ul>
          </div>
        </section>

        {/* ควรทำ / อย่าทำ */}
        <section className="border-t border-line py-12">
          <h2 className="text-h1 font-bold">ดูแลชุดยังไงให้ได้มัดจำคืนครบ</h2>
          <div className="mt-6 grid gap-x-12 gap-y-8 md:grid-cols-2">
            <div>
              <h3 className="border-b border-line pb-2 text-h3 font-bold">ควรทำ</h3>
              <ul className="divide-y divide-line-subtle text-body text-secondary">
                <ListItem>
                  <b className="font-semibold text-ink">ลองใส่ทันที</b>ที่ได้รับ เจอปัญหาแจ้งร้านภายในวันนั้น
                </ListItem>
                <ListItem>
                  <b className="font-semibold text-ink">ถ่ายรูปชุด</b>ก่อนแพ็กส่งคืน เก็บไว้เป็นหลักฐาน
                </ListItem>
                <ListItem>
                  ส่งคืน<b className="font-semibold text-ink">อุปกรณ์ให้ครบทุกชิ้น</b> ทั้งวิก พร็อพ และเครื่องประดับ
                </ListItem>
                <ListItem>
                  <b className="font-semibold text-ink">เก็บเลขพัสดุ</b>ตอนส่งคืนไว้จนกว่าจะได้มัดจำ
                </ListItem>
              </ul>
            </div>
            <div>
              <h3 className="border-b border-line pb-2 text-h3 font-bold">อย่าทำ</h3>
              <ul className="divide-y divide-line-subtle text-body text-secondary">
                <ListItem>
                  <b className="font-semibold text-ink">ซักหรือรีดเอง</b> ร้านทำความสะอาดให้ตามชนิดผ้า
                </ListItem>
                <ListItem>
                  <b className="font-semibold text-ink">ตัด เย็บ ติดกาว</b> หรือดัดแปลงชุดและวิก
                </ListItem>
                <ListItem>
                  ใช้<b className="font-semibold text-ink">สีทาตัวหรือสเปรย์สี</b>ที่อาจเปื้อนชุดถาวร
                </ListItem>
                <ListItem>
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
                <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-body font-semibold text-ink transition-colors hover:bg-sunken [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <CaretDownIcon
                    size={18}
                    weight="bold"
                    className="flex-shrink-0 text-muted transition-transform group-open:rotate-180 group-open:text-ink"
                  />
                </summary>
                <p className="max-w-[40em] pb-5 text-body text-secondary">{f.a(settings)}</p>
              </details>
            ))}
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
    <div className="border-line-subtle py-4 odd:border-r odd:pr-4 even:pl-4 [&:nth-child(-n+2)]:border-b">
      <dt className="text-body-sm text-secondary">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-h1 font-bold tabular-nums">{value}</span>
        {unit && <span className="text-body-sm font-semibold">{unit}</span>}
      </dd>
    </div>
  )
}

function ReceiptRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="py-2.5">
      <div className="flex items-baseline gap-2">
        <dt className="text-body font-semibold">{label}</dt>
        <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-ink/30" />
        <dd className="text-right text-body tabular-nums">{value}</dd>
      </div>
      {note && <p className="mt-0.5 text-body-sm text-muted">{note}</p>}
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
      <span className="font-bold text-ink">{when}</span>
      <span className="text-secondary">{children}</span>
    </li>
  )
}

function ListItem({ children }: { children: ReactNode }) {
  return <li className="py-3">{children}</li>
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

  // สีเน้นมีที่เดียวคือวันใช้งาน ที่เหลือแยกด้วยน้ำหนักตัวอักษรและลายเส้น
  const style: Record<Day['kind'], string> = {
    receive: 'bg-surface text-ink font-semibold',
    use: 'bg-brand-soft text-ink font-bold',
    return: 'bg-surface text-ink font-bold',
    buffer:
      'text-muted font-medium bg-[repeating-linear-gradient(135deg,var(--color-sunken)_0_6px,var(--color-surface)_6px_12px)]',
  }

  return (
    <section className="border-t border-line py-12 lg:grid lg:grid-cols-12 lg:gap-12 lg:py-14">
      <div className="lg:col-span-4">
        <h2 className="text-h1 font-bold">เช่า {EXAMPLE_PACKAGE_DAYS} วัน นับยังไง</h2>
        <p className="mt-2 max-w-[30em] text-body text-secondary">
          คุณเลือกแค่<b className="font-semibold text-ink">วันใช้งาน</b> วันเช่านับจากวันใช้งานถึงวันส่งคืน
          ส่วนวันที่ชุดเดินทางมาถึงคุณ<b className="font-semibold text-ink">ไม่นับ</b>เป็นวันเช่า
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
                      offset === 0 ? 'bg-brand-soft text-ink' : 'text-muted'
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
          <TimelineNote term="รับชุด" text="ชุดถึงมือคุณ ไม่นับเป็นวันเช่า" />
          <TimelineNote term="วันใช้งาน" text="วันที่คุณเลือกในปฏิทิน" />
          <TimelineNote term="ส่งคืน" text="ส่งพัสดุกลับภายในวันนี้" />
          <TimelineNote term="ร้านตรวจ/ซัก" text="ร้านรับคืน ตรวจสภาพ ทำความสะอาด" />
        </dl>

        <p className="mt-6 max-w-[40em] border-t border-line-subtle pt-4 text-body text-secondary">
          เพราะแบบนี้ ชุดหนึ่งตัวจึง<b className="font-semibold text-ink">ไม่ว่างรวม {days.length} วัน</b>ต่อการเช่าหนึ่งครั้ง
          ถ้าวันที่อยากได้ไม่ว่าง ลองเปลี่ยนไซส์ หรือเลือกชุดอื่นของตัวละครเดียวกัน
        </p>
      </div>
    </section>
  )
}

function TimelineNote({ term, text }: { term: string; text: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-bold text-ink">{term}</dt>
      <dd className="text-secondary">{text}</dd>
    </div>
  )
}
