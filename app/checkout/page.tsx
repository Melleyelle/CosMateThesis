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
import { cartKeyOf, decodeCheckoutItems, parseDelivery, removeFromCart, type CartKey } from '@/utils/customer/cart'
import { fetchPieces, priceLine, type PieceInfo } from '@/utils/customer/pieces'
import { fetchVariantSummaries, type VariantSummary } from '@/utils/customer/fetchVariantSummaries'
import {
  DEFAULT_BOOKING_SETTINGS,
  fetchBookingSettings,
  getRentalTimeline,
  minStartOffset,
  shippingFee,
  type BookingSettings,
  type DeliveryMethod,
} from '@/utils/customer/bookingSettings'
import type { ShipCarrier } from '@/utils/tracking'
import { isDateProblem, translateRpcError } from '@/utils/bookingErrors'
import { addDays, formatBaht, formatThaiDateLong, isISODate, todayISO } from '@/utils/dateUtils'
import {
  BANKS,
  EMPTY_ADDRESS,
  EMPTY_BANK,
  addressProblem,
  bankProblem,
  contactProblem,
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

// design v2: ช่องกรอกเส้น 1px มุม 10px · focus เส้นชมพู + วงชมพูโปร่ง 3px
const inputClass =
  'w-full rounded-control border border-line bg-white px-4 py-2.5 text-base text-[#263544] outline-none transition placeholder:text-muted focus:border-brand-strong focus:ring-[3px] focus:ring-brand/25'

// กล่องหลัก design v2: เส้น 1px มุม 12px ไม่มีเงา (กล่องกดไม่ได้)
const cardClass = 'rounded-card border border-line bg-white p-5'

const primaryButtonClass =
  'lift focus-ring rounded-full border border-line bg-brand px-6 py-2.5 text-base font-bold text-white active:bg-brand-strong'

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
    return decodeCheckoutItems(variantId && isISODate(date) ? `${variantId}:${date}:${searchParams.get('days') ?? 1}` : null)
  }, [searchParams])
  const fromCart = !!searchParams.get('items')
  const requestedDelivery = parseDelivery(searchParams.get('delivery'))

  const [variants, setVariants] = useState<Record<string, VariantSummary>>({})
  const [pieces, setPieces] = useState<Record<string, PieceInfo>>({})
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
  const [carrierChoice, setCarrierChoice] = useState<ShipCarrier | null>(null)
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
        // ไซส์รองเท้าที่มากับชุดโหลดมาด้วย เพื่อแสดงไซส์และรู้ว่ารองเท้ายังเปิดให้เช่าอยู่ไหม
        fetchVariantSummaries(requested.flatMap((r) => (r.shoeVariantId ? [r.variantId, r.shoeVariantId] : [r.variantId]))),
        fetchBookingSettings(),
        supabase.auth.getUser(),
      ])
      const pieceRes = await fetchPieces(Object.values(variantRes.data).map((v) => v.productId))
      if (cancelled) return
      setSettings(s)
      if (variantRes.error) setLoadError(variantRes.error)
      setVariants(variantRes.data)
      setPieces(pieceRes)

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
        const isPickup = !!s.pickupLocation && requestedDelivery === 'pickup'
        setEditingAddress((isPickup ? contactProblem(prefilled) : addressProblem(prefilled)) !== null)

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
  }, [requested, requestedDelivery])

  // ร้านปิดรับเอง (ไม่มีข้อมูลร้าน) → จัดส่งเท่านั้น
  const delivery: DeliveryMethod = settings.pickupLocation ? requestedDelivery : 'ship'
  const pickup = delivery === 'pickup' ? settings.pickupLocation : null
  // ยังไม่เลือก หรือเจ้าที่เลือกถูกปิดไป → เจ้าแรกที่เปิดอยู่
  const carrier =
    settings.shipCarriers.find((c) => c.code === carrierChoice) ?? settings.shipCarriers[0]
  const shipping = shippingFee(settings, delivery, carrier.code)
  const recipientProblem = (a: Address) => (pickup ? contactProblem(a) : addressProblem(a))

  const minStart = addDays(todayISO(), minStartOffset(settings, delivery))
  const lines = requested.map((r) => {
    const v = variants[r.variantId]
    const price = v ? priceLine(v, r.pieces, pieces, r.rentalDays, settings, r.shoeVariantId) : null
    const shoe = r.shoeVariantId ? variants[r.shoeVariantId] : undefined
    return {
      key: cartKeyOf(r),
      request: r,
      variant: v,
      shoe,
      price,
      timeline: v ? getRentalTimeline(r.startDate, r.rentalDays, settings, delivery) : null,
      problem: !v
        ? 'ชุดหรือไซส์นี้ปิดให้เช่าแล้ว'
        : price?.invalid || (r.shoeVariantId && !shoe)
          ? 'ชิ้นหรือรองเท้าที่เลือกไม่เปิดให้เช่าแล้ว'
          : r.rentalDays < settings.minRentalDays || r.rentalDays > settings.maxRentalDays
            ? `จำนวนวันเช่าต้องอยู่ระหว่าง ${settings.minRentalDays}–${settings.maxRentalDays} วัน`
            : r.startDate < minStart
              ? pickup
                ? `วันใช้งานกระชั้นเกินไป (รับวันนี้ได้ถ้าจองก่อน ${settings.pickupCutoffHour}:00)`
                : `วันใช้งานกระชั้นเกินไป (ต้องจองล่วงหน้าอย่างน้อย ${minStartOffset(settings, 'ship')} วัน)`
              : null,
    }
  })
  const hasProblem = lines.some((l) => l.problem)
  const totals = lines.reduce(
    (acc, l) =>
      l.price
        ? {
            rental: acc.rental + l.price.rental,
            deposit: acc.deposit + l.price.deposit,
            laundry: acc.laundry + l.price.laundry,
          }
        : acc,
    { rental: 0, deposit: 0, laundry: 0 },
  )
  const grandTotal = totals.rental + totals.deposit + totals.laundry + shipping
  const returnHours = Math.max(...lines.map((l) => l.variant?.depositReturnHours ?? 72), 72)
  const latestReturn = lines.reduce<string | null>(
    (max, l) => (l.timeline && (!max || l.timeline.returnBy > max) ? l.timeline.returnBy : max),
    null,
  )
  const backHref = fromCart ? '/cart' : lines[0]?.variant ? `/costumes/${lines[0].variant.productId}` : '/costumes'

  function confirmAddress() {
    const problem = recipientProblem(address)
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
    const aProblem = recipientProblem(address)
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
      p_items: requested.map((r) => ({
        variant_id: r.variantId,
        start_date: r.startDate,
        rental_days: r.rentalDays,
        ...(r.pieces ? { pieces: r.pieces } : {}),
        ...(r.shoeVariantId ? { shoe_variant_id: r.shoeVariantId } : {}),
      })),
      p_ship_name: address.name.trim(),
      p_ship_phone: address.phone,
      // รับเองที่ร้าน: เก็บแค่ชื่อ/เบอร์ผู้ติดต่อ ไม่ส่งที่อยู่
      p_ship_address: pickup ? null : address.line.trim(),
      p_ship_subdistrict: pickup ? null : address.subdistrict.trim() || null,
      p_ship_district: pickup ? null : address.district.trim() || null,
      p_ship_province: pickup ? null : address.province.trim(),
      p_ship_postal_code: pickup ? null : address.postalCode,
      p_note: note.trim() || null,
      p_delivery_method: delivery,
      p_ship_carrier: pickup ? null : carrier.code,
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

    if (saveAsDefault && !pickup) {
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
          <section className={cardClass}>
            <div className="flex items-start gap-3">
              <MapPinIcon size={26} weight="fill" className="flex-shrink-0 text-[#E5457F]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-[#263544]">{pickup ? 'รับชุดที่ร้าน' : 'ที่อยู่สำหรับจัดส่ง'}</h2>
                  {!editingAddress && (
                    <EditButton
                      onClick={() => setEditingAddress(true)}
                      label={pickup ? 'แก้ไขผู้ติดต่อ' : 'แก้ไขที่อยู่'}
                    />
                  )}
                </div>

                {pickup && (
                  <div className="mt-2 rounded-xl bg-[#F7F7F8] px-4 py-3 text-base">
                    <p className="font-semibold text-[#263544]">{pickup.name}</p>
                    <p className="text-[#263544]/70">{pickup.address}</p>
                    {(pickup.hours || pickup.phone) && (
                      <p className="text-[#263544]/70">{[pickup.hours, pickup.phone && `โทร ${pickup.phone}`].filter(Boolean).join(' · ')}</p>
                    )}
                    {pickup.mapUrl && (
                      <a href={pickup.mapUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#E5457F] underline">
                        ดูแผนที่
                      </a>
                    )}
                    <p className="mt-1 text-sm text-[#263544]/60">
                      มารับได้ในวันใส่ แสดงเลขออเดอร์ให้พนักงาน · ให้ไรเดอร์มารับแทนได้
                    </p>
                  </div>
                )}

                {pickup && !editingAddress ? (
                  <p className="mt-3 text-base">
                    <span className="text-[#263544]/70">ผู้ติดต่อ: </span>
                    <span className="font-semibold text-[#263544]">
                      {address.name} ({address.phone})
                    </span>
                  </p>
                ) : pickup ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="ชื่อผู้ติดต่อ">
                      <input
                        value={address.name}
                        onChange={(e) => setAddress({ ...address, name: e.target.value })}
                        autoComplete="name"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="เบอร์โทร">
                      <input
                        inputMode="numeric"
                        maxLength={10}
                        value={address.phone}
                        onChange={(e) => setAddress({ ...address, phone: onlyDigits(e.target.value) })}
                        autoComplete="tel"
                        className={inputClass}
                      />
                    </Field>
                    {sectionError.address && <ErrorText>{sectionError.address}</ErrorText>}
                    <div className="sm:col-span-2">
                      <button type="button" onClick={confirmAddress} className={primaryButtonClass}>
                        ใช้ข้อมูลนี้
                      </button>
                    </div>
                  </div>
                ) : !editingAddress ? (
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
                        className="h-5 w-5 accent-[#E5457F]"
                      />
                      {hadDefaultAddress ? 'อัปเดตเป็นที่อยู่หลักของฉัน' : 'บันทึกเป็นที่อยู่หลักของฉัน'}
                    </label>
                    {sectionError.address && <ErrorText>{sectionError.address}</ErrorText>}
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={confirmAddress}
                        className={primaryButtonClass}
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
          {/* จัดส่ง: ขนส่งหลายเจ้าเต็มความกว้าง วิธีชำระไปอยู่บรรทัดถัดไป */}
          <div className={`grid gap-6 ${pickup ? 'sm:grid-cols-2' : ''}`}>
            <div>
              <h2 className="mb-3 text-lg font-bold text-[#263544]">การจัดส่ง</h2>
              {pickup ? (
                <FixedChoice label="รับเองที่ร้าน" />
              ) : (
                <div role="radiogroup" aria-label="เลือกขนส่ง" className="grid gap-2 sm:grid-cols-2">
                  {settings.shipCarriers.map((c) => (
                    <ShipChoice
                      key={c.code}
                      label={c.name}
                      fee={c.fee}
                      checked={c.code === carrier.code}
                      onSelect={() => setCarrierChoice(c.code)}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className={pickup ? '' : 'sm:w-1/2 sm:pr-1'}>
              <h2 className="mb-3 text-lg font-bold text-[#263544]">วิธีการชำระ</h2>
              <FixedChoice label="QR พร้อมเพย์" />
            </div>
          </div>

          {/* ---------------- บัญชีรับเงินมัดจำคืน ---------------- */}
          <div>
            <h2 className="mb-3 text-lg font-bold text-[#263544]">ช่องทางรับเงินมัดจำคืน</h2>
            <section className={cardClass}>
              <div className="flex items-start gap-3">
                <BankIcon size={24} weight="fill" className="mt-1 flex-shrink-0 text-[#E5457F]" />
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
                          className="h-5 w-5 accent-[#E5457F]"
                        />
                        {hadSavedBank ? 'อัปเดตเป็นบัญชีของฉัน' : 'บันทึกเป็นบัญชีของฉัน ใช้ครั้งต่อไปได้เลย'}
                      </label>
                      {sectionError.refund && <ErrorText>{sectionError.refund}</ErrorText>}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={confirmRefund}
                          className={primaryButtonClass}
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
            <h2 className="mb-3 text-lg font-bold text-[#263544]">
              หมายเหตุถึงร้าน <span className="font-normal text-[#263544]/50">(ไม่บังคับ)</span>
            </h2>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                pickup
                  ? 'ถ้าให้ไรเดอร์มารับ แจ้งชื่อไรเดอร์หรือเวลาที่จะมาถึง'
                  : 'เช่น ใช้ไปงาน Comic Con อยากได้ของก่อนเที่ยง'
              }
              className={inputClass}
            />
          </div>
        </div>

        {/* ---------------- สรุปการเช่า ---------------- */}
        <aside className={`${cardClass} h-fit p-6 lg:sticky lg:top-24`}>
          <h2 className="mb-5 border-b border-line-subtle pb-4 text-2xl font-bold text-[#263544]">
            สรุปการเช่า <span className="text-[#E5457F]">{lines.length} รายการ</span>
          </h2>

          <ul className="space-y-5">
            {lines.map((l) => (
              <li key={l.key} className="flex gap-4">
                <div className="h-28 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-line bg-[#FDE3EE]">
                  {l.variant?.coverImageUrl ? (
                    <img src={l.variant.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#E5457F]/40">
                      <ImageIcon size={28} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-base">
                  <p className="text-lg font-semibold leading-snug text-[#263544]">
                    {l.variant?.productName ?? 'ชุดที่ปิดให้เช่าแล้ว'}
                  </p>
                  {l.variant && <p className="text-[#263544]/80">ไซส์: {l.variant.size}</p>}
                  {l.shoe && <p className="text-[#263544]/80">รองเท้า: EU {l.shoe.size}</p>}
                  {!!l.price?.shoeDiscount && (
                    <p className="text-[#263544]/80">ไม่รับรองเท้า (−{formatBaht(l.price.shoeDiscount)})</p>
                  )}
                  {l.price?.pieceNames && (
                    <p className="text-[#263544]/80">เช่าแยกชิ้น: {l.price.pieceNames.join(', ')}</p>
                  )}
                  {l.price && (
                    <p className="text-[#263544]/80">
                      เช่า {l.price.rentalDays} วัน · {formatBaht(l.price.rental)}
                      {l.price.rentalDays > 1 && (
                        <span className="block text-[#263544]/60">
                          วันแรก {formatBaht(l.price.baseRental)} + {l.price.rentalDays - 1} วัน ×{' '}
                          {formatBaht(l.price.dayRate)}
                        </span>
                      )}
                    </p>
                  )}
                  {l.timeline && (
                    <div className="mt-2">
                      <p className="text-[#263544]/60">วันที่เช่า:</p>
                      <p className="text-[#263544]">
                        {formatThaiDateLong(l.timeline.useDate)} ถึง {formatThaiDateLong(l.timeline.returnBy)}
                      </p>
                      <p className="text-base text-[#263544]/60">
                        {pickup
                          ? `รับชุดที่ร้าน ${formatThaiDateLong(l.timeline.receiveDate)}`
                          : `ชุดถึงมือคุณ ${formatThaiDateLong(l.timeline.receiveDate)} (ไม่นับวันเช่า)`}
                      </p>
                    </div>
                  )}
                  {l.problem && (
                    <p className="mt-2 flex gap-1.5 rounded-xl bg-[#FFF3B0] px-3 py-2 text-base text-[#263544]">
                      <WarningCircleIcon size={14} className="mt-0.5 flex-shrink-0" />
                      {l.problem}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="my-5 border-t border-line-subtle" />
          <dl className="space-y-2 text-base">
            <PriceRow label="ค่าเช่าชุด" value={totals.rental} />
            <PriceRow label="ค่ามัดจำ (ได้คืนหลังตรวจชุด)" value={totals.deposit} />
            <PriceRow label="ค่าซักรีด" value={totals.laundry} />
            <PriceRow label={pickup ? 'ค่าจัดส่ง (รับเองที่ร้าน)' : `ค่าจัดส่ง (${carrier.name})`} value={shipping} />
            <div className="flex items-center justify-between border-t border-dashed border-line-subtle pt-3">
              <dt className="font-bold text-[#263544]">ยอดชำระทั้งหมด</dt>
              <dd className="text-3xl font-extrabold text-brand">{formatBaht(grandTotal)}</dd>
            </div>
          </dl>

          <label className="mt-5 flex cursor-pointer gap-2.5 rounded-xl bg-[#F7F7F8] p-3 text-base leading-relaxed text-[#263544]/80">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-5 w-5 flex-shrink-0 accent-[#E5457F]"
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
            className="lift focus-ring mt-5 w-full rounded-full border border-line bg-brand py-4 text-lg font-bold text-white active:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'กำลังจองชุด...' : 'ยืนยันการเช่า'}
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
      {/* design v2 (design-system.md): เส้น 1px · เงาแข็งเฉพาะตอน hover (.lift) */}
      <div className="theme-v2">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-gray-100" />}>
          <CheckoutInner />
        </Suspense>
      </div>
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
      className="nudge focus-ring rounded-lg p-1.5 text-[#263544]"
    >
      <NotePencilIcon size={26} />
    </button>
  )
}

function FixedChoice({ label }: { label: string }) {
  return (
    // ตัวเลือกที่ถูกเลือกไว้แล้ว (มีทางเดียว) → แสดงเป็นสถานะที่เลือก: พื้น brand-soft เส้น 1px
    <div className="flex items-center gap-4 rounded-card border border-line bg-brand-soft px-5 py-4">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E5457F] text-white">
        <CheckIcon size={16} weight="bold" />
      </span>
      <span className="text-base font-semibold text-[#263544]">{label}</span>
    </div>
  )
}

// ขนส่งที่เลือกได้: เลือกอยู่ = หน้าตาเดียวกับ FixedChoice · ไม่ได้เลือก = พื้นขาว วงว่าง
function ShipChoice({
  label,
  fee,
  checked,
  onSelect,
}: {
  label: string
  fee: number
  checked: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`focus-ring flex items-center gap-4 rounded-card border px-5 py-4 text-left transition ${
        checked ? 'border-line bg-brand-soft' : 'border-line-subtle bg-white hover:border-line'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
          checked ? 'bg-[#E5457F] text-white' : 'border border-line bg-white'
        }`}
      >
        {checked && <CheckIcon size={16} weight="bold" />}
      </span>
      <span className="min-w-0 flex-1 text-base font-semibold text-[#263544]">{label}</span>
      <span className="text-base font-semibold tabular-nums text-[#263544]">{formatBaht(fee)}</span>
    </button>
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
