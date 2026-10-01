'use client'
/* eslint-disable @next/next/no-img-element */

import { Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftIcon,
  BankIcon,
  CheckIcon,
  ImageIcon,
  MapPinIcon,
  NotePencilIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import StepProgress from '@/app/components/customer/StepProgress'
import { createClient } from '@/utils/client'
import { decodeCheckoutItems, removeFromCart, type CartKey } from '@/utils/customer/cart'
import { useRequireLogin } from '@/utils/customer/authUser'
import { fetchVariantSummaries, type VariantSummary } from '@/utils/customer/fetchVariantSummaries'
import {
  DEFAULT_BOOKING_SETTINGS,
  fetchBookingSettings,
  getRentalTimeline,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'
import { isDateProblem, translateRpcError } from '@/utils/bookingErrors'
import { addDays, formatBaht, formatThaiDateLong, isISODate, todayISO } from '@/utils/dateUtils'

// ---------------------------------------------------------------------------
// ข้อมูลฟอร์ม
// ---------------------------------------------------------------------------
type Address = {
  name: string
  phone: string
  line: string
  subdistrict: string
  district: string
  province: string
  postalCode: string
}

type RefundAccount = { accountName: string; bank: string; accountNumber: string }

const EMPTY_ADDRESS: Address = { name: '', phone: '', line: '', subdistrict: '', district: '', province: '', postalCode: '' }
const EMPTY_REFUND: RefundAccount = { accountName: '', bank: '', accountNumber: '' }

const BANKS = [
  'พร้อมเพย์ (เบอร์โทร/เลขบัตรประชาชน)',
  'กสิกรไทย',
  'ไทยพาณิชย์',
  'กรุงเทพ',
  'กรุงไทย',
  'กรุงศรีอยุธยา',
  'ทหารไทยธนชาต (ttb)',
  'ออมสิน',
  'ธ.ก.ส.',
  'ยูโอบี',
  'ซีไอเอ็มบี ไทย',
  'เกียรตินาคินภัทร',
  'แลนด์ แอนด์ เฮ้าส์',
]

const onlyDigits = (s: string) => s.replace(/[^0-9]/g, '')

function addressProblem(a: Address): string | null {
  if (!a.name.trim() || !a.line.trim() || !a.province.trim()) return 'กรอกชื่อผู้รับ ที่อยู่ และจังหวัดให้ครบ'
  if (!/^0\d{8,9}$/.test(a.phone)) return 'เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0'
  if (!/^\d{5}$/.test(a.postalCode)) return 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'
  return null
}

function refundProblem(r: RefundAccount): string | null {
  if (!r.accountName.trim() || !r.bank) return 'กรอกชื่อเจ้าของบัญชีและเลือกธนาคารให้ครบ'
  const n = onlyDigits(r.accountNumber).length
  if (n < 10 || n > 15) return 'เลขบัญชี/พร้อมเพย์ต้องเป็นตัวเลข 10–15 หลัก'
  return null
}

function maskAccount(n: string) {
  const d = onlyDigits(n)
  return d.length <= 4 ? d : `${'x'.repeat(d.length - 4)}${d.slice(-4)}`
}

// แต่ละขั้นเป็นหน้าแยกผ่าน ?step= — ปุ่มย้อนกลับของเบราว์เซอร์จึงถอยทีละขั้น
type StepKey = 'address' | 'refund' | 'review'
const STEP_INDEX: Record<StepKey, number> = { address: 1, refund: 2, review: 3 }

function stepHref(search: string, step: StepKey) {
  const params = new URLSearchParams(search)
  params.set('step', step)
  return `/checkout?${params.toString()}`
}

const backLinkClass =
  'inline-flex items-center gap-1 text-sm font-medium text-[#263544]/60 hover:text-[#263544]'

const inputClass =
  'w-full rounded-lg bg-[#EFEFEF] px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#E5457F]/30'

// ---------------------------------------------------------------------------
// หน้า
// ---------------------------------------------------------------------------
function CheckoutInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // create_booking() เรียกได้เฉพาะผู้ที่ล็อกอินแล้ว — ยังไม่ล็อกอินให้ไปหน้าเข้าสู่ระบบก่อน
  const loggedIn = useRequireLogin()

  // รองรับ 2 แบบ: ?items=v:d,v:d (จากตะกร้า) และ ?variant=..&date=.. (กด "เช่าเลย")
  // อิงค่าสตริงแทน searchParams ทั้งก้อน — เปลี่ยน ?step= แล้วต้องไม่โหลดข้อมูลใหม่ทับที่ลูกค้ากรอกไว้
  const itemsParam = searchParams.get('items')
  const variantParam = searchParams.get('variant')
  const dateParam = searchParams.get('date')
  const requested: CartKey[] = useMemo(() => {
    const fromCart = decodeCheckoutItems(itemsParam)
    if (fromCart.length > 0) return fromCart
    return decodeCheckoutItems(variantParam && isISODate(dateParam) ? `${variantParam}:${dateParam}` : null)
  }, [itemsParam, variantParam, dateParam])
  const fromCart = !!itemsParam
  const stepParam = searchParams.get('step')

  const [variants, setVariants] = useState<Record<string, VariantSummary>>({})
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS)
  const [saveAsDefault, setSaveAsDefault] = useState(true)
  const [hadDefaultAddress, setHadDefaultAddress] = useState(false)
  const [refund, setRefund] = useState<RefundAccount>(EMPTY_REFUND)
  const [note, setNote] = useState('')
  const [accepted, setAccepted] = useState(false)

  const [sectionError, setSectionError] = useState<{ address?: string; refund?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [dateProblem, setDateProblem] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (requested.length === 0) {
        setLoadError('ไม่พบรายการเช่า กรุณาเลือกชุดและวันใช้งานใหม่')
        setLoading(false)
        return
      }
      const supabase = createClient()
      if (!supabase) {
        setLoadError('Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค')
        setLoading(false)
        return
      }

      const [variantRes, s, userRes] = await Promise.all([
        fetchVariantSummaries(requested.map((r) => r.variantId)),
        fetchBookingSettings(),
        supabase.auth.getUser(),
      ])
      if (cancelled) return
      setSettings(s)
      if (variantRes.error) setLoadError(variantRes.error)
      setVariants(variantRes.data)

      // เติมที่อยู่/บัญชีคืนมัดจำให้อัตโนมัติ จากที่อยู่หลักและออเดอร์ล่าสุด
      const user = userRes.data.user
      if (user) {
        const [{ data: profile }, { data: saved }, refundRes] = await Promise.all([
          supabase.from('profiles').select('first_name, last_name, phone').eq('id', user.id).maybeSingle(),
          supabase
            .from('user_addresses')
            .select('recipient_name, recipient_phone, address_line, subdistrict, district, province, postal_code')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .maybeSingle(),
          // คอลัมน์นี้มาจาก Step 10 — ถ้ายังไม่ได้รันจะ error เฉย ๆ แล้วข้ามไป
          supabase
            .from('orders')
            .select('refund_account_name, refund_bank, refund_account_number')
            .eq('user_id', user.id)
            .not('refund_account_number', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        if (cancelled) return

        const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        const prefilled: Address = {
          name: saved?.recipient_name ?? fullName ?? '',
          phone: onlyDigits(saved?.recipient_phone ?? profile?.phone ?? ''),
          line: saved?.address_line ?? '',
          subdistrict: saved?.subdistrict ?? '',
          district: saved?.district ?? '',
          province: saved?.province ?? '',
          postalCode: saved?.postal_code ?? '',
        }
        setAddress(prefilled)
        setHadDefaultAddress(!!saved)
        setSaveAsDefault(!saved)

        const r = refundRes.error ? null : refundRes.data
        const prefilledRefund: RefundAccount = r?.refund_account_number
          ? {
              accountName: r.refund_account_name ?? '',
              bank: r.refund_bank ?? '',
              accountNumber: r.refund_account_number ?? '',
            }
          : { ...EMPTY_REFUND, accountName: fullName }
        setRefund(prefilledRefund)

        // ลูกค้าเก่าที่มีที่อยู่และบัญชีครบแล้ว ข้ามไปหน้าตรวจสอบเลย (ยังกดแก้ไขย้อนกลับได้)
        const search = window.location.search
        if (!new URLSearchParams(search).get('step') && !addressProblem(prefilled) && !refundProblem(prefilledRefund)) {
          router.replace(stepHref(search, 'review'), { scroll: false })
        }
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [requested, router])

  const minStart = addDays(todayISO(), Math.max(settings.minLeadDays, settings.bufferDaysBefore))
  const lines = requested.map((r) => {
    const v = variants[r.variantId]
    return {
      key: `${r.variantId}:${r.startDate}`,
      request: r,
      variant: v,
      timeline: v ? getRentalTimeline(r.startDate, v.packageDays, settings) : null,
      problem: !v
        ? 'ชุดหรือไซส์นี้ปิดให้เช่าแล้ว'
        : r.startDate < minStart
          ? `วันใช้งานกระชั้นเกินไป (ต้องจองล่วงหน้าอย่างน้อย ${settings.minLeadDays} วัน)`
          : null,
    }
  })
  const hasProblem = lines.some((l) => l.problem)
  const totals = lines.reduce(
    (acc, l) =>
      l.variant
        ? {
            rental: acc.rental + l.variant.packagePrice,
            deposit: acc.deposit + l.variant.depositAmount,
            laundry: acc.laundry + l.variant.laundryFee,
          }
        : acc,
    { rental: 0, deposit: 0, laundry: 0 },
  )
  const grandTotal = totals.rental + totals.deposit + totals.laundry + settings.shippingFlatRate
  const returnHours = Math.max(...lines.map((l) => l.variant?.depositReturnHours ?? 72), 72)
  const latestReturn = lines.reduce<string | null>(
    (max, l) => (l.timeline && (!max || l.timeline.returnBy > max) ? l.timeline.returnBy : max),
    null,
  )
  const backHref = fromCart ? '/cart' : lines[0]?.variant ? `/costumes/${lines[0].variant.productId}` : '/costumes'

  // ขั้นแรก (ตะกร้า/เลือกชุด) ผ่านแล้วเสมอ, "ชำระเงิน" เกิดที่หน้าออเดอร์หลังกดยืนยัน
  const checkoutSteps = [fromCart ? 'ตะกร้า' : 'เลือกชุด', 'ที่อยู่จัดส่ง', 'บัญชีคืนมัดจำ', 'ตรวจสอบและยืนยัน', 'ชำระเงิน']
  // เปิดลิงก์ขั้นหลัง ๆ ตรง ๆ ทั้งที่ขั้นก่อนยังไม่ครบ → พากลับไปขั้นที่ยังไม่ครบ
  const wanted: StepKey = stepParam === 'refund' || stepParam === 'review' ? stepParam : 'address'
  const step: StepKey =
    wanted !== 'address' && addressProblem(address)
      ? 'address'
      : wanted === 'review' && refundProblem(refund)
        ? 'refund'
        : wanted

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step])

  function goTo(next: StepKey) {
    router.push(stepHref(searchParams.toString(), next))
  }

  function nextFromAddress() {
    const problem = addressProblem(address)
    setSectionError((e) => ({ ...e, address: problem ?? undefined }))
    if (!problem) goTo('refund')
  }

  function nextFromRefund() {
    const problem = refundProblem(refund)
    setSectionError((e) => ({ ...e, refund: problem ?? undefined }))
    if (!problem) goTo('review')
  }

  // ปุ่ม "ถัดไป" และการกด Enter ในช่องกรอก ส่งฟอร์มมาที่นี่ — จองจริงเฉพาะขั้นตรวจสอบ
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (step === 'address') return nextFromAddress()
    if (step === 'refund') return nextFromRefund()
    if (addressProblem(address)) return goTo('address')
    if (refundProblem(refund)) return goTo('refund')
    if (hasProblem || !accepted) return

    const supabase = createClient()
    if (!supabase) return

    setSubmitting(true)
    setSubmitError(null)
    setDateProblem(false)

    const { data, error } = await supabase.rpc('create_booking', {
      p_items: requested.map((r) => ({ variant_id: r.variantId, start_date: r.startDate })),
      p_ship_name: address.name.trim(),
      p_ship_phone: address.phone,
      p_ship_address: address.line.trim(),
      p_ship_subdistrict: address.subdistrict.trim() || null,
      p_ship_district: address.district.trim() || null,
      p_ship_province: address.province.trim(),
      p_ship_postal_code: address.postalCode,
      p_note: note.trim() || null,
    })

    if (error) {
      setSubmitting(false)
      setSubmitError(translateRpcError(error.message))
      setDateProblem(isDateProblem(error.message))
      return
    }

    const orderId = (data as { order_id: string }).order_id

    // งานต่อท้าย: ถ้าพลาดไม่กระทบออเดอร์ที่จองสำเร็จแล้ว (แอดมินขอข้อมูลเพิ่มจากลูกค้าได้)
    const { error: refundError } = await supabase.rpc('set_order_refund_account', {
      p_order_id: orderId,
      p_account_name: refund.accountName.trim(),
      p_bank: refund.bank,
      p_account_number: onlyDigits(refund.accountNumber),
    })
    if (refundError) console.warn('บันทึกบัญชีคืนมัดจำไม่สำเร็จ:', refundError.message)

    if (saveAsDefault) await saveDefaultAddress(address)

    removeFromCart(requested)
    router.push(`/orders/${orderId}`)
  }

  if (loading || !loggedIn) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    )
  }

  if (loadError && lines.every((l) => !l.variant)) {
    return (
      <div className="rounded-3xl bg-[#F7F7F8] px-6 py-16 text-center">
        <p className="text-[#263544]/60">{loadError}</p>
        <Link href="/costumes" className="mt-4 inline-block font-semibold text-[#E5457F] hover:underline">
          กลับไปหน้าสำรวจชุด
        </Link>
      </div>
    )
  }

  const backToCart = (
    <Link href={backHref} className={backLinkClass}>
      <ArrowLeftIcon size={16} />
      {fromCart ? 'กลับไปตะกร้า' : 'กลับไปแก้ไซส์หรือวันที่'}
    </Link>
  )
  const backTo = (target: StepKey, label: string) => (
    <button type="button" onClick={() => goTo(target)} className={backLinkClass}>
      <ArrowLeftIcon size={16} />
      {label}
    </button>
  )

  return (
    <>
      <h1 className="mb-5 text-3xl font-bold text-[#263544]">ชำระเงิน</h1>
      <StepProgress steps={checkoutSteps} current={STEP_INDEX[step]} className="mb-8" />

      <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div>
          {/* ---------------- ขั้นที่ 2: ที่อยู่จัดส่ง ---------------- */}
          {step === 'address' && (
            <>
              <StepCard
                icon={<MapPinIcon size={26} weight="fill" />}
                title="ที่อยู่สำหรับจัดส่ง"
                subtitle="ร้านจะส่งชุดทางไปรษณีย์ไทย (EMS) ไปที่อยู่นี้"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="ชื่อผู้รับ">
                    <input
                      value={address.name}
                      onChange={(e) => setAddress({ ...address, name: e.target.value })}
                      autoComplete="name"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="เบอร์โทรผู้รับ">
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      value={address.phone}
                      onChange={(e) => setAddress({ ...address, phone: onlyDigits(e.target.value) })}
                      autoComplete="tel"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="บ้านเลขที่ ซอย ถนน" wide>
                    <input
                      value={address.line}
                      onChange={(e) => setAddress({ ...address, line: e.target.value })}
                      autoComplete="street-address"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="ตำบล/แขวง">
                    <input
                      value={address.subdistrict}
                      onChange={(e) => setAddress({ ...address, subdistrict: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="อำเภอ/เขต">
                    <input
                      value={address.district}
                      onChange={(e) => setAddress({ ...address, district: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="จังหวัด">
                    <input
                      value={address.province}
                      onChange={(e) => setAddress({ ...address, province: e.target.value })}
                      autoComplete="address-level1"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="รหัสไปรษณีย์">
                    <input
                      inputMode="numeric"
                      maxLength={5}
                      value={address.postalCode}
                      onChange={(e) => setAddress({ ...address, postalCode: onlyDigits(e.target.value) })}
                      autoComplete="postal-code"
                      className={inputClass}
                    />
                  </Field>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#263544] sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      className="h-4 w-4 accent-[#263544]"
                    />
                    {hadDefaultAddress ? 'อัปเดตเป็นที่อยู่หลักของฉัน' : 'บันทึกเป็นที่อยู่หลักของฉัน'}
                  </label>
                  {sectionError.address && <ErrorText>{sectionError.address}</ErrorText>}
                </div>
              </StepCard>
              <StepNav back={backToCart} nextLabel="ถัดไป: บัญชีคืนมัดจำ" />
            </>
          )}

          {/* ---------------- ขั้นที่ 3: บัญชีรับเงินมัดจำคืน ---------------- */}
          {step === 'refund' && (
            <>
              <StepCard
                icon={<BankIcon size={26} />}
                title="บัญชีรับเงินมัดจำคืน"
                subtitle={`ร้านโอนมัดจำ ${formatBaht(totals.deposit)} คืนภายใน ${returnHours} ชม. หลังได้รับชุดคืนและตรวจสภาพเรียบร้อย`}
              >
                <div className="space-y-3">
                  <RefundRow label="ชื่อเจ้าของบัญชี:">
                    <input
                      value={refund.accountName}
                      onChange={(e) => setRefund({ ...refund, accountName: e.target.value })}
                      className={inputClass}
                    />
                  </RefundRow>
                  <RefundRow label="ธนาคาร:">
                    <select
                      value={refund.bank}
                      onChange={(e) => setRefund({ ...refund, bank: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">เลือกธนาคาร</option>
                      {BANKS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </RefundRow>
                  <RefundRow label="เลขที่บัญชี:">
                    <input
                      inputMode="numeric"
                      maxLength={18}
                      value={refund.accountNumber}
                      onChange={(e) => setRefund({ ...refund, accountNumber: e.target.value.replace(/[^0-9-]/g, '') })}
                      placeholder="xxx-x-xxxxx-x"
                      className={`${inputClass} font-mono`}
                    />
                  </RefundRow>
                  {sectionError.refund && <ErrorText>{sectionError.refund}</ErrorText>}
                </div>
              </StepCard>
              <StepNav back={backTo('address', 'กลับไปแก้ที่อยู่')} nextLabel="ถัดไป: ตรวจสอบคำสั่งเช่า" />
            </>
          )}

          {/* ---------------- ขั้นที่ 4: ตรวจสอบและยืนยัน ---------------- */}
          {step === 'review' && (
            <div className="space-y-6">
              <StepCard
                icon={<MapPinIcon size={26} weight="fill" />}
                title="ที่อยู่สำหรับจัดส่ง"
                action={<EditButton onClick={() => goTo('address')} label="แก้ไขที่อยู่" />}
              >
                <p className="text-sm font-semibold text-[#263544]">
                  {address.name} ({address.phone})
                </p>
                <p className="mt-1 text-sm text-[#263544]/70">
                  {[address.line, address.subdistrict, address.district, address.province, address.postalCode]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              </StepCard>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h2 className="mb-3 text-lg font-medium text-[#263544]">การจัดส่ง</h2>
                  <FixedChoice label="ไปรษณีย์ไทย (ส่งด่วน EMS)" />
                </div>
                <div>
                  <h2 className="mb-3 text-lg font-medium text-[#263544]">วิธีการชำระ</h2>
                  <FixedChoice label="QR พร้อมเพย์" />
                </div>
              </div>

              <StepCard
                icon={<BankIcon size={26} />}
                title="บัญชีรับเงินมัดจำคืน"
                action={<EditButton onClick={() => goTo('refund')} label="แก้ไขบัญชี" />}
              >
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-[#263544]/70">ชื่อเจ้าของบัญชี:</dt>
                  <dd className="font-medium text-[#263544]">{refund.accountName}</dd>
                  <dt className="text-[#263544]/70">ธนาคาร:</dt>
                  <dd className="font-medium text-[#263544]">{refund.bank}</dd>
                  <dt className="text-[#263544]/70">เลขที่บัญชี:</dt>
                  <dd className="font-mono font-medium text-[#263544]">{maskAccount(refund.accountNumber)}</dd>
                </dl>
              </StepCard>

              <div>
                <h2 className="mb-3 text-lg font-medium text-[#263544]">หมายเหตุถึงร้าน (ไม่บังคับ)</h2>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น ใช้ไปงาน Comic Con อยากได้ของก่อนเที่ยง"
                  className={`${inputClass} border border-gray-200`}
                />
              </div>

              <StepNav back={backTo('refund', 'กลับไปแก้บัญชีคืนมัดจำ')} />
            </div>
          )}
        </div>

        {/* ---------------- สรุปการเช่า (ทุกขั้น) ---------------- */}
        <aside className="h-fit rounded-2xl border border-[#263544] bg-white p-6 lg:sticky lg:top-24">
          <h2 className="mb-5 text-2xl font-medium text-[#263544]">สรุปการเช่า: {lines.length} รายการ</h2>

          <ul className="space-y-5">
            {lines.map((l) => (
              <li key={l.key} className="flex gap-4">
                <div className="h-28 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#FDE3EE]">
                  {l.variant?.coverImageUrl ? (
                    <img src={l.variant.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#E5457F]/40">
                      <ImageIcon size={28} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-lg font-medium leading-snug text-[#263544]">
                    {l.variant?.productName ?? 'ชุดที่ปิดให้เช่าแล้ว'}
                  </p>
                  {l.variant && <p className="text-[#263544]/80">ไซส์: {l.variant.size}</p>}
                  {l.timeline && (
                    <div className="mt-2">
                      <p className="text-[#263544]/60">วันที่เช่า:</p>
                      <p className="text-[#263544]">
                        {formatThaiDateLong(l.timeline.receiveDate)} ถึง {formatThaiDateLong(l.timeline.returnBy)}
                      </p>
                      <p className="text-xs text-[#E5457F]">วันใช้งาน {formatThaiDateLong(l.request.startDate)}</p>
                    </div>
                  )}
                  {l.problem && (
                    <p className="mt-2 flex gap-1 rounded-lg bg-[#FFF3B0] px-2 py-1 text-xs text-[#263544]">
                      <WarningCircleIcon size={14} className="mt-0.5 flex-shrink-0" />
                      {l.problem}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="my-5 border-t-2 border-gray-200" />
          <dl className="space-y-3 text-sm">
            <PriceRow label="จำนวนเงินค่าเช่า:" value={totals.rental} />
            <PriceRow label="เงินค่ามัดจำ:" value={totals.deposit} />
            <PriceRow label="ค่าซักรีด:" value={totals.laundry} />
            <PriceRow label="ค่าขนส่ง:" value={settings.shippingFlatRate} />
          </dl>
          <div className="my-5 border-t-2 border-gray-200" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#263544]">จำนวนเงินสุทธิ:</span>
            <span className="text-3xl font-bold text-[#263544]">{formatBaht(grandTotal)}</span>
          </div>

          {step === 'review' && (
            <>
              <label className="mt-5 flex cursor-pointer gap-2 text-xs leading-relaxed text-[#263544]/70">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#263544]"
                />
                <span>
                  ยอมรับเงื่อนไขการเช่า: ส่งชุดคืน
                  {latestReturn ? `ภายใน ${formatThaiDateLong(latestReturn)}` : 'ตามวันที่กำหนด'} หากคืนช้าคิดค่าปรับวันละ{' '}
                  {formatBaht(settings.lateFeePerDay)} และได้รับมัดจำคืนหลังร้านตรวจสภาพชุดเรียบร้อย
                </span>
              </label>

              {submitError && (
                <div role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  {submitError}
                  {dateProblem && (
                    <Link href={backHref} className="mt-1 block font-semibold underline">
                      {fromCart ? 'กลับไปตะกร้าเพื่อเลือกวันใหม่' : 'กลับไปเลือกวันใหม่'}
                    </Link>
                  )}
                  {submitError.includes('ยังไม่ได้ชำระเงิน') && (
                    <Link href="/orders" className="mt-1 block font-semibold underline">
                      ไปที่ออเดอร์ของฉัน
                    </Link>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !accepted || hasProblem}
                className="mt-5 w-full rounded-xl bg-[#263544] py-4 text-base font-semibold text-white transition hover:bg-[#1a2632] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? 'กำลังจองชุด...' : 'ยืนยันและไปชำระเงิน'}
              </button>
            </>
          )}
          {hasProblem && (
            <p className="mt-2 text-center text-xs text-red-600">มีบางรายการจองไม่ได้ กรุณากลับไปแก้ไขก่อน</p>
          )}
        </aside>
      </form>
    </>
  )
}

// บันทึกที่อยู่หลักไว้เติมอัตโนมัติครั้งหน้า (พลาดก็ไม่เป็นไร ไม่กระทบการจอง)
async function saveDefaultAddress(a: Address) {
  const supabase = createClient()
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const payload = {
    recipient_name: a.name.trim(),
    recipient_phone: a.phone,
    address_line: a.line.trim(),
    subdistrict: a.subdistrict.trim() || null,
    district: a.district.trim() || null,
    province: a.province.trim(),
    postal_code: a.postalCode,
  }
  const { data: existing } = await supabase
    .from('user_addresses')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('user_addresses').update(payload).eq('id', existing.id)
    : await supabase
        .from('user_addresses')
        .insert({ ...payload, user_id: user.id, label: 'ที่อยู่หลัก', is_default: true })
  if (error) console.warn('บันทึกที่อยู่หลักไม่สำเร็จ:', error.message)
}

export default function CheckoutPage() {
  return (
    <CustomerLayout>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-gray-100" />}>
        <CheckoutInner />
      </Suspense>
    </CustomerLayout>
  )
}

// ---------------------------------------------------------------------------
// ชิ้นส่วนย่อย
// ---------------------------------------------------------------------------
function StepCard({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[#263544] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 text-[#263544]">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-medium text-[#263544]">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-[#263544]/60">{subtitle}</p>}
            </div>
            {action}
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </section>
  )
}

function StepNav({ back, nextLabel }: { back: ReactNode; nextLabel?: string }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {back}
      {nextLabel && (
        <button
          type="submit"
          className="rounded-xl bg-[#263544] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2632]"
        >
          {nextLabel}
        </button>
      )}
    </div>
  )
}

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-[#263544] transition hover:bg-[#FDE3EE] hover:text-[#E5457F]"
    >
      <NotePencilIcon size={26} />
    </button>
  )
}

function FixedChoice({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#263544] bg-white px-5 py-4">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#263544] text-white">
        <CheckIcon size={16} weight="bold" />
      </span>
      <span className="text-sm text-[#263544]">{label}</span>
    </div>
  )
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-[#263544]/70">{label}</span>
      {children}
    </label>
  )
}

function RefundRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid items-center gap-1 sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="text-sm text-[#263544]">{label}</span>
      <span className="sm:max-w-sm">{children}</span>
    </label>
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 sm:col-span-2">
      {children}
    </p>
  )
}

function PriceRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[#263544]/80">{label}</dt>
      <dd className="font-medium text-[#263544]">{formatBaht(value)}</dd>
    </div>
  )
}
