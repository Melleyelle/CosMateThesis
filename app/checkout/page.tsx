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
import { createClient } from '@/utils/client'
import { decodeCheckoutItems, removeFromCart, type CartKey } from '@/utils/customer/cart'
import { fetchVariantSummaries, type VariantSummary } from '@/utils/customer/fetchVariantSummaries'
import {
  DEFAULT_BOOKING_SETTINGS,
  fetchBookingSettings,
  getRentalTimeline,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'
import { isDateProblem, translateRpcError } from '@/utils/bookingErrors'
import { addDays, formatBaht, formatThaiDateLong, isISODate, todayISO } from '@/utils/dateUtils'
import {
  BANKS,
  EMPTY_ADDRESS,
  EMPTY_BANK,
  addressProblem,
  bankProblem,
  maskAccount,
  onlyDigits,
  saveDefaultAddress,
  saveMyBankAccount,
  type Address,
  type BankAccount,
} from '@/utils/customer/account'

// ---------------------------------------------------------------------------
// ข้อมูลฟอร์ม (ชนิดข้อมูล/การตรวจ ใช้ร่วมกับหน้า "บัญชีของฉัน")
// ---------------------------------------------------------------------------
type RefundAccount = BankAccount
const EMPTY_REFUND = EMPTY_BANK
const refundProblem = bankProblem

const inputClass =
  'w-full rounded-lg bg-[#EFEFEF] px-3 py-2.5 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#E5457F]/30'

// ---------------------------------------------------------------------------
// หน้า
// ---------------------------------------------------------------------------
function CheckoutInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // รองรับ 2 แบบ: ?items=v:d,v:d (จากตะกร้า) และ ?variant=..&date=.. (กด "เช่าเลย")
  const requested: CartKey[] = useMemo(() => {
    const fromCart = decodeCheckoutItems(searchParams.get('items'))
    if (fromCart.length > 0) return fromCart
    const variantId = searchParams.get('variant')
    const date = searchParams.get('date')
    return decodeCheckoutItems(variantId && isISODate(date) ? `${variantId}:${date}` : null)
  }, [searchParams])
  const fromCart = !!searchParams.get('items')

  const [variants, setVariants] = useState<Record<string, VariantSummary>>({})
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS)
  const [editingAddress, setEditingAddress] = useState(true)
  const [saveAsDefault, setSaveAsDefault] = useState(true)
  const [hadDefaultAddress, setHadDefaultAddress] = useState(false)
  const [refund, setRefund] = useState<RefundAccount>(EMPTY_REFUND)
  const [editingRefund, setEditingRefund] = useState(true)
  const [hadSavedBank, setHadSavedBank] = useState(false)
  const [saveBank, setSaveBank] = useState(true)
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
        const [{ data: profile }, { data: saved }, bankRes, refundRes] = await Promise.all([
          supabase.from('profiles').select('first_name, last_name, phone').eq('id', user.id).maybeSingle(),
          supabase
            .from('user_addresses')
            .select('recipient_name, recipient_phone, address_line, subdistrict, district, province, postal_code')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .maybeSingle(),
          // บัญชีค่าเริ่มต้นจากหน้า "บัญชีของฉัน" (Step 13 + 15)
          supabase
            .from('user_bank_accounts')
            .select('account_name, bank, account_number')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .maybeSingle(),
          // สำรอง: บัญชีที่กรอกไว้ในออเดอร์ล่าสุด (กรณียังไม่มีบัญชีถาวร)
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
        setEditingAddress(addressProblem(prefilled) !== null)

        const b = bankRes.error ? null : bankRes.data
        const r = refundRes.error ? null : refundRes.data
        if (b?.account_number) {
          setRefund({ accountName: b.account_name, bank: b.bank, accountNumber: b.account_number })
          setHadSavedBank(true)
          setSaveBank(false)
          setEditingRefund(false)
        } else if (r?.refund_account_number) {
          setRefund({
            accountName: r.refund_account_name ?? '',
            bank: r.refund_bank ?? '',
            accountNumber: r.refund_account_number ?? '',
          })
          setEditingRefund(false)
        } else if (fullName) {
          setRefund((prev) => ({ ...prev, accountName: fullName }))
        }
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [requested])

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

  function confirmAddress() {
    const problem = addressProblem(address)
    setSectionError((e) => ({ ...e, address: problem ?? undefined }))
    if (!problem) setEditingAddress(false)
  }

  function confirmRefund() {
    const problem = refundProblem(refund)
    setSectionError((e) => ({ ...e, refund: problem ?? undefined }))
    if (!problem) setEditingRefund(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const aProblem = addressProblem(address)
    const rProblem = refundProblem(refund)
    setSectionError({ address: aProblem ?? undefined, refund: rProblem ?? undefined })
    if (aProblem) setEditingAddress(true)
    if (rProblem) setEditingRefund(true)
    if (aProblem || rProblem || hasProblem || !accepted) return

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

    if (saveAsDefault) {
      const err = await saveDefaultAddress(address)
      if (err) console.warn('บันทึกที่อยู่หลักไม่สำเร็จ:', err)
    }
    if (saveBank) {
      const err = await saveMyBankAccount(refund)
      if (err) console.warn('บันทึกบัญชีรับเงินคืนไม่สำเร็จ:', err)
    }

    removeFromCart(requested)
    router.push(`/orders/${orderId}`)
  }

  if (loading) {
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

  return (
    <>
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1 text-base font-medium text-[#263544]/60 hover:text-[#263544]"
      >
        <ArrowLeftIcon size={16} />
        {fromCart ? 'กลับไปตะกร้า' : 'กลับไปแก้ไซส์หรือวันที่'}
      </Link>
      <h1 className="mb-8 text-3xl font-bold text-[#263544]">ชำระเงิน</h1>

      <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-7">
          {/* ---------------- ที่อยู่จัดส่ง ---------------- */}
          <section className="rounded-2xl border border-[#263544] bg-white p-5">
            <div className="flex items-start gap-3">
              <MapPinIcon size={26} weight="fill" className="flex-shrink-0 text-[#263544]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-medium text-[#263544]">ที่อยู่สำหรับจัดส่ง:</h2>
                  {!editingAddress && (
                    <EditButton onClick={() => setEditingAddress(true)} label="แก้ไขที่อยู่" />
                  )}
                </div>

                {!editingAddress ? (
                  <div className="mt-2 text-base">
                    <p className="font-semibold text-[#263544]">
                      {address.name} ({address.phone})
                    </p>
                    <p className="mt-1 text-[#263544]/70">
                      {[address.line, address.subdistrict, address.district, address.province, address.postalCode]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                    <label className="flex cursor-pointer items-center gap-2 text-base text-[#263544] sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={saveAsDefault}
                        onChange={(e) => setSaveAsDefault(e.target.checked)}
                        className="h-4 w-4 accent-[#263544]"
                      />
                      {hadDefaultAddress ? 'อัปเดตเป็นที่อยู่หลักของฉัน' : 'บันทึกเป็นที่อยู่หลักของฉัน'}
                    </label>
                    {sectionError.address && <ErrorText>{sectionError.address}</ErrorText>}
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={confirmAddress}
                        className="pop rounded-full bg-[#263544] px-5 py-2 text-base font-semibold text-white"
                      >
                        ใช้ที่อยู่นี้
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ---------------- การจัดส่ง + วิธีชำระ ---------------- */}
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

          {/* ---------------- บัญชีรับเงินมัดจำคืน ---------------- */}
          <div>
            <h2 className="mb-3 text-lg font-medium text-[#263544]">ช่องทางรับเงินมัดจำคืน</h2>
            <section className="rounded-2xl border border-[#263544] bg-white p-5">
              <div className="flex items-start gap-3">
                <BankIcon size={24} className="mt-1 flex-shrink-0 text-[#263544]" />
                <div className="min-w-0 flex-1">
                  {!editingRefund ? (
                    <div className="flex items-start justify-between gap-2">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
                        <dt className="text-[#263544]/70">ชื่อเจ้าของบัญชี:</dt>
                        <dd className="font-medium text-[#263544]">{refund.accountName}</dd>
                        <dt className="text-[#263544]/70">ธนาคาร:</dt>
                        <dd className="font-medium text-[#263544]">{refund.bank}</dd>
                        <dt className="text-[#263544]/70">เลขที่บัญชี:</dt>
                        <dd className="font-medium tabular-nums text-[#263544]">{maskAccount(refund.accountNumber)}</dd>
                      </dl>
                      <EditButton onClick={() => setEditingRefund(true)} label="แก้ไขบัญชี" />
                    </div>
                  ) : (
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
                          className={`${inputClass} tabular-nums`}
                        />
                      </RefundRow>
                      <label className="flex cursor-pointer items-center gap-2 text-base text-[#263544]">
                        <input
                          type="checkbox"
                          checked={saveBank}
                          onChange={(e) => setSaveBank(e.target.checked)}
                          className="h-4 w-4 accent-[#263544]"
                        />
                        {hadSavedBank ? 'อัปเดตเป็นบัญชีของฉัน' : 'บันทึกเป็นบัญชีของฉัน ใช้ครั้งต่อไปได้เลย'}
                      </label>
                      {sectionError.refund && <ErrorText>{sectionError.refund}</ErrorText>}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={confirmRefund}
                          className="pop rounded-full bg-[#263544] px-5 py-2 text-base font-semibold text-white"
                        >
                          ใช้บัญชีนี้
                        </button>
                        <p className="text-base text-[#263544]/60">
                          ร้านโอนมัดจำคืนภายใน {returnHours} ชม. หลังได้รับชุดคืนและตรวจสภาพเรียบร้อย
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

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
        </div>

        {/* ---------------- สรุปการเช่า ---------------- */}
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
                <div className="min-w-0 flex-1 text-base">
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
                      <p className="text-base text-[#E5457F]">วันใช้งาน {formatThaiDateLong(l.request.startDate)}</p>
                    </div>
                  )}
                  {l.problem && (
                    <p className="mt-2 flex gap-1 rounded-lg bg-[#FFF3B0] px-2 py-1 text-base text-[#263544]">
                      <WarningCircleIcon size={14} className="mt-0.5 flex-shrink-0" />
                      {l.problem}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="my-5 border-t-2 border-gray-200" />
          <dl className="space-y-3 text-base">
            <PriceRow label="จำนวนเงินค่าเช่า:" value={totals.rental} />
            <PriceRow label="เงินค่ามัดจำ:" value={totals.deposit} />
            <PriceRow label="ค่าซักรีด:" value={totals.laundry} />
            <PriceRow label="ค่าขนส่ง:" value={settings.shippingFlatRate} />
          </dl>
          <div className="my-5 border-t-2 border-gray-200" />
          <div className="flex items-center justify-between">
            <span className="text-base text-[#263544]">จำนวนเงินสุทธิ:</span>
            <span className="text-3xl font-bold text-[#263544]">{formatBaht(grandTotal)}</span>
          </div>

          <label className="mt-5 flex cursor-pointer gap-2 text-base leading-relaxed text-[#263544]/70">
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
            <div role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-base text-red-600">
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
            className="pop mt-5 w-full rounded-full bg-[#263544] py-4 text-base font-semibold text-white disabled:opacity-40"
          >
            {submitting ? 'กำลังจองชุด...' : 'ยืนยัน'}
          </button>
          {hasProblem && (
            <p className="mt-2 text-center text-base text-red-600">มีบางรายการจองไม่ได้ กรุณากลับไปแก้ไขก่อน</p>
          )}
        </aside>
      </form>
    </>
  )
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
function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="nudge rounded-lg p-1.5 text-[#263544]"
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
      <span className="text-base text-[#263544]">{label}</span>
    </div>
  )
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-base font-medium text-[#263544]/70">{label}</span>
      {children}
    </label>
  )
}

function RefundRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid items-center gap-1 sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="text-base text-[#263544]">{label}</span>
      <span className="sm:max-w-sm">{children}</span>
    </label>
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-base text-red-600 sm:col-span-2">
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
