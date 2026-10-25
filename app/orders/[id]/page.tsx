'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeftIcon,
  ArrowUUpLeftIcon,
  CheckIcon,
  HourglassIcon,
  ImageIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  StarIcon,
  StorefrontIcon,
  TruckIcon,
  UploadSimpleIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import ReviewForm from '@/app/components/customer/ReviewForm'
import { StarDisplay } from '@/app/components/customer/StarRating'
import { fetchMyReviewsByOrderItem, type Review } from '@/utils/customer/reviews'
import { createClient } from '@/utils/client'
import { fetchOrder, type OrderSummary } from '@/utils/customer/fetchOrders'
import { translateRpcError } from '@/utils/bookingErrors'
import {
  CUSTOMER_STEPS,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  customerStepIndex,
} from '@/utils/orderStatus'
import { addDays, formatBaht, formatDateTime, formatThaiDateWithWeekday } from '@/utils/dateUtils'
import { DEFAULT_BOOKING_SETTINGS, fetchBookingSettings, type PickupLocation } from '@/utils/customer/bookingSettings'
import { RETURN_CARRIERS, SHIP_CARRIER, normalizeTracking, trackingProblem, trackingUrl } from '@/utils/tracking'
import { submitSlip } from '@/utils/submitSlip'

const SLIP_MAX_BYTES = 5 * 1024 * 1024

export default function OrderPage() {
  const params = useParams()
  const orderId = String(params.id)

  const [order, setOrder] = useState<OrderSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shipBufferBefore, setBufferBefore] = useState(DEFAULT_BOOKING_SETTINGS.bufferDaysBefore)
  const [pickupLocation, setPickupLocation] = useState<PickupLocation | null>(null)
  const [acting, setActing] = useState<'pay' | 'cancel' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [myReviews, setMyReviews] = useState<Record<string, Review>>({})
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewThanks, setReviewThanks] = useState(false)
  const [slip, setSlip] = useState<{ name: string; url: string; file: File } | null>(null)
  const [slipError, setSlipError] = useState<string | null>(null)

  // คืนหน่วยความจำของรูปพรีวิวเมื่อเปลี่ยนสลิปหรือออกจากหน้า
  useEffect(() => {
    return () => {
      if (slip) URL.revokeObjectURL(slip.url)
    }
  }, [slip])

  function pickSlip(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setSlipError('กรุณาเลือกไฟล์รูปภาพ (JPG หรือ PNG)')
    if (file.size > SLIP_MAX_BYTES) return setSlipError('ไฟล์ใหญ่เกิน 5 MB')
    setSlipError(null)
    setSlip({ name: file.name, url: URL.createObjectURL(file), file })
  }

  // ดึงข้อมูลครบก่อน แล้วค่อย set state ทีเดียว (effect จะได้ set state เฉพาะใน callback)
  const fetchPageData = useCallback(async () => {
    const [res, settings] = await Promise.all([fetchOrder(orderId), fetchBookingSettings()])
    const reviews =
      res.data?.status === 'completed' ? await fetchMyReviewsByOrderItem(res.data.lines.map((l) => l.id)) : null
    return { res, settings, reviews }
  }, [orderId])

  const apply = useCallback(({ res, settings, reviews }: Awaited<ReturnType<typeof fetchPageData>>) => {
    setBufferBefore(settings.bufferDaysBefore)
    setPickupLocation(settings.pickupLocation)
    if (res.error || !res.data) setLoadError(res.error ?? 'ไม่พบออเดอร์นี้')
    else {
      setOrder(res.data)
      if (reviews) setMyReviews(reviews)
    }
    setLoading(false)
  }, [])

  const load = useCallback(() => fetchPageData().then(apply), [fetchPageData, apply])

  useEffect(() => {
    let alive = true
    fetchPageData().then((data) => alive && apply(data))
    return () => {
      alive = false
    }
  }, [fetchPageData, apply])

  async function runAction(kind: 'pay' | 'cancel') {
    const supabase = createClient()
    if (!supabase || !order) return
    if (kind === 'cancel' && !confirm('ยกเลิกออเดอร์นี้? ชุดจะถูกปล่อยให้คนอื่นจองได้ทันที')) return

    setActing(kind)
    setActionError(null)

    if (kind === 'pay') {
      if (!slip) return setActing(null)
      // อัปโหลดสลิป → เซิร์ฟเวอร์ตรวจตามโหมดใน app_settings (manual / mock / slip2go)
      // ผลลัพธ์: PAID / MANUAL_REVIEW / EXPIRED_REFUND = ไปต่อ · REJECTED_* = ให้แนบสลิปใหม่
      const res = await submitSlip(supabase, order.id, slip.file)
      if (!res.ok) {
        setActionError(res.message)
        setSlip(null)
      }
    } else {
      const { error } = await supabase.rpc('cancel_my_order', { p_order_id: order.id })
      if (error) setActionError(translateRpcError(error.message))
    }

    await load()
    setActing(null)
  }

  const stepIndex = order ? customerStepIndex(order.status) : -1
  const firstUseDate = useMemo(() => order?.lines[0]?.startDate ?? null, [order])
  // รับเองที่ร้าน: ไม่มีวันขนส่ง วันรับชุด = วันใส่
  const isPickup = order?.deliveryMethod === 'pickup'
  const bufferBefore = isPickup ? 0 : shipBufferBefore

  if (loading) {
    return (
      <CustomerLayout>
        <div className="h-96 animate-pulse rounded-3xl bg-gray-100" />
      </CustomerLayout>
    )
  }

  if (loadError || !order) {
    return (
      <CustomerLayout>
        <div className="rounded-3xl bg-[#F7F7F8] px-6 py-16 text-center">
          <p className="text-[#263544]/60">{loadError}</p>
          <Link href="/orders" className="mt-4 inline-block font-semibold text-[#E5457F] hover:underline">
            ไปที่ออเดอร์ของฉัน
          </Link>
        </div>
      </CustomerLayout>
    )
  }

  const closed = order.status === 'cancelled' || order.status === 'expired'

  return (
    <CustomerLayout>
      {/* design v2 (design-system.md): เส้น 1px · เงาแข็งเฉพาะตอน hover (.lift) */}
      <div className="theme-v2">
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center gap-1 text-base font-medium text-[#263544]/60 hover:text-[#263544]"
      >
        <ArrowLeftIcon size={16} />
        ออเดอร์ของฉัน
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-base text-[#263544]/60">เลขที่ออเดอร์</p>
          <h1 className="font-mono text-2xl font-bold text-[#263544]">{order.orderNumber}</h1>
          <p className="text-base text-[#263544]/50">สั่งเมื่อ {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-4 py-1.5 text-base font-semibold ${ORDER_STATUS_BADGE[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>
      </div>

      {/* ความคืบหน้า */}
      {closed ? (
        <div className="mb-6 space-y-3">
          <div className="flex items-start gap-3 rounded-2xl bg-gray-100 px-5 py-4 text-base text-gray-600">
            <XCircleIcon size={22} className="flex-shrink-0" />
            <div>
              <p className="font-semibold text-[#263544]">
                {order.status === 'cancelled' ? 'ออเดอร์นี้ถูกยกเลิกแล้ว' : 'ออเดอร์นี้หมดอายุ'}
              </p>
              <p className="mt-0.5">
                {order.status === 'expired'
                  ? 'ไม่ได้ชำระเงินภายในเวลาที่กำหนด'
                  : order.cancelReason ?? 'ชุดถูกปล่อยให้คนอื่นจองได้ตามปกติ'}
              </p>
            </div>
          </div>

          {order.refundStatus && (
            <div
              className={`rounded-card border px-5 py-4 text-base ${
                order.refundStatus === 'transferred'
                  ? 'border-[#B8E2C8] bg-[#E3F5EA] text-[#1B6E45]'
                  : order.refundStatus === 'failed'
                    ? 'border-[#F5C2C0] bg-[#FDE8E8] text-[#B42318]'
                    : 'border-line bg-[#FFF3B0] text-[#263544]'
              }`}
            >
              <p className="font-bold">
                {order.refundStatus === 'transferred'
                  ? `คืนเงิน ${formatBaht(order.refundAmount ?? 0)} เรียบร้อยแล้ว`
                  : order.refundStatus === 'failed'
                    ? 'โอนเงินคืนไม่สำเร็จ'
                    : `ร้านกำลังโอนเงินคืน ${formatBaht(order.refundAmount ?? 0)} เต็มจำนวน`}
              </p>
              <p className="mt-1">
                {order.refundStatus === 'transferred'
                  ? `โอนเมื่อ ${order.refundedAt ? formatDateTime(order.refundedAt) : '—'}`
                  : order.refundStatus === 'failed'
                    ? 'กรุณาตรวจเลขบัญชีในหน้า "บัญชีของฉัน" แล้วติดต่อร้าน'
                    : 'เข้าบัญชีที่ระบุไว้ตอนจอง'}
                {order.refundAccountNumber &&
                  ` · ${order.refundBank} ลงท้าย ${order.refundAccountNumber.slice(-4)}`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <ol className="mb-6 flex overflow-x-auto rounded-card border border-line bg-white p-4">
          {CUSTOMER_STEPS.map((step, i) => {
            const done = i < stepIndex
            const current = i === stepIndex
            return (
              <li key={step.label} className="flex min-w-[88px] flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done || current ? 'bg-[#E5457F]' : 'bg-gray-200'}`} />
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${
                      done
                        ? 'border-line bg-[#E5457F] text-white'
                        : current
                          ? 'border-line bg-[#FFF3B0] text-[#263544]'
                          : 'border-line-subtle bg-white text-muted'
                    }`}
                  >
                    {done ? <CheckIcon size={14} weight="bold" /> : i + 1}
                  </span>
                  <span
                    className={`h-0.5 flex-1 ${i === CUSTOMER_STEPS.length - 1 ? 'invisible' : done ? 'bg-[#E5457F]' : 'bg-gray-200'}`}
                  />
                </div>
                <span className={`mt-1.5 text-sm ${current ? 'font-bold text-[#263544]' : 'text-[#263544]/50'}`}>
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* การชำระเงิน */}
          {order.status === 'pending_payment' && (
            <section className="rounded-card border border-line bg-white p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#263544]">ชำระเงิน</h2>
                  <p className="text-base text-[#263544]/60">สแกน QR เพื่อโอนยอดด้านล่าง แล้วแนบสลิปเพื่อยืนยันการจอง</p>
                </div>
                <PaymentCountdown orderId={order.id} onExpire={load} />
              </div>

              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <PaymentQr seed={order.orderNumber} />
                <div className="w-full flex-1 space-y-2 text-base">
                  <p className="text-[#263544]/60">ยอดที่ต้องชำระ</p>
                  <p className="text-3xl font-extrabold text-brand">{formatBaht(order.grandTotal)}</p>
                  <p className="text-[#263544]/70">
                    ชื่อบัญชี: <span className="font-semibold text-[#263544]">CosMate</span>
                  </p>
                </div>
              </div>

              {/* แนบสลิป */}
              <div className="mt-6 border-t border-line-subtle pt-5">
                <p className="mb-2 text-base font-semibold text-[#263544]">แนบสลิปการโอนเงิน</p>
                {slip ? (
                  <div className="flex items-center gap-4 rounded-card border border-line bg-[#FFFAFC] p-3">
                    <img
                      src={slip.url}
                      alt="สลิปการโอนเงิน"
                      className="h-28 w-20 flex-shrink-0 rounded-lg border border-line-subtle bg-white object-cover"
                    />
                    <div className="min-w-0 flex-1 text-base">
                      <p className="flex items-center gap-1.5 font-semibold text-[#1B6E45]">
                        <CheckIcon size={16} weight="bold" />
                        แนบสลิปแล้ว
                      </p>
                      <p className="truncate text-[#263544]/60">{slip.name}</p>
                      <div className="mt-2 flex gap-4">
                        <label className="cursor-pointer font-semibold text-[#E5457F] hover:underline">
                          เปลี่ยนรูป
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => pickSlip(e.target.files?.[0])}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setSlip(null)}
                          className="font-medium text-[#263544]/60 hover:text-red-600"
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // hover: เส้นประเข้มขึ้น + พื้นขาว (ไม่ใช้ชมพูตอน hover)
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-line-subtle bg-[#F7F7F8] px-4 py-8 text-center transition hover:border-line hover:bg-white">
                    <UploadSimpleIcon size={32} className="text-[#E5457F]" />
                    <span className="text-base font-semibold text-[#263544]">กดเพื่อเลือกรูปสลิป</span>
                    <span className="text-base text-[#263544]/50">รองรับ JPG, PNG ขนาดไม่เกิน 5 MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => pickSlip(e.target.files?.[0])}
                    />
                  </label>
                )}
                {slipError && (
                  <p role="alert" className="mt-2 rounded-xl bg-red-50 px-4 py-2.5 text-base text-red-600">
                    {slipError}
                  </p>
                )}
              </div>

              {actionError && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-base text-red-600">
                  {actionError}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => runAction('pay')}
                  disabled={acting !== null || !slip}
                  className="lift focus-ring flex-1 rounded-full border border-line bg-brand py-3 text-base font-bold text-white active:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {acting === 'pay' ? 'กำลังส่งข้อมูล...' : slip ? 'ยืนยันการจอง' : 'แนบสลิปก่อนยืนยันการจอง'}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('cancel')}
                  disabled={acting !== null}
                  className="lift focus-ring rounded-full border border-line bg-white px-5 py-3 text-base font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {acting === 'cancel' ? 'กำลังยกเลิก...' : 'ยกเลิกออเดอร์'}
                </button>
              </div>
            </section>
          )}

          {order.status === 'manual_review' && (
            <section className="flex gap-4 rounded-card border border-line bg-[#EDE6FA] p-6">
              <HourglassIcon size={32} className="flex-shrink-0 text-[#263544]" />
              <div>
                <h2 className="font-bold text-[#263544]">ได้รับแจ้งชำระเงินแล้ว</h2>
                <p className="mt-1 text-base text-[#263544]/70">
                  {isPickup
                    ? `ร้านกำลังตรวจสอบยอดเงิน เมื่อยืนยันแล้วมารับชุดที่ร้านได้${firstUseDate ? `ในวันที่ ${formatThaiDateWithWeekday(firstUseDate)}` : ''}`
                    : <>
                        ร้านกำลังตรวจสอบยอดเงิน เมื่อยืนยันแล้วสถานะจะเปลี่ยนเป็น &quot;ชำระแล้ว รอจัดส่ง&quot;
                        {firstUseDate && ` และชุดจะถึงมือคุณภายใน ${formatThaiDateWithWeekday(addDays(firstUseDate, -bufferBefore))}`}
                      </>}
                </p>
              </div>
            </section>
          )}

          {/* รับเองที่ร้าน: จ่ายแล้ว รอมารับ — บอกวัน เวลา ที่ร้าน และสิ่งที่ต้องแสดง */}
          {isPickup && (order.status === 'paid' || order.status === 'manual_review') && (
            <section className="flex gap-4 rounded-card border border-line bg-[#FFF3B0] p-6">
              <StorefrontIcon size={32} className="flex-shrink-0 text-[#263544]" />
              <div className="min-w-0 text-base">
                <h2 className="font-bold text-[#263544]">
                  มารับชุดได้{firstUseDate ? `วันที่ ${formatThaiDateWithWeekday(firstUseDate)}` : 'ในวันใส่'}
                </h2>
                {pickupLocation ? (
                  <p className="mt-1 text-[#263544]/80">
                    ที่ <b>{pickupLocation.name}</b> · {pickupLocation.address}
                    {pickupLocation.hours && ` · ${pickupLocation.hours}`}
                    {pickupLocation.phone && ` · โทร ${pickupLocation.phone}`}
                  </p>
                ) : (
                  <p className="mt-1 text-[#263544]/80">ติดต่อร้านเพื่อนัดเวลารับชุด</p>
                )}
                <p className="mt-2 text-[#263544]/80">
                  แสดงเลขออเดอร์ <b className="font-mono">{order.orderNumber}</b> ให้พนักงาน และตรวจชุดต่อหน้าพนักงานก่อนรับ
                </p>
                <p className="mt-1 text-[#263544]/60">
                  ให้ไรเดอร์มารับแทน: ส่งเลขออเดอร์และชื่อผู้จอง ({order.shipName}) ให้ไรเดอร์
                </p>
                {pickupLocation?.mapUrl && (
                  <a href={pickupLocation.mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-[#E5457F] underline">
                    ดูแผนที่
                  </a>
                )}
              </div>
            </section>
          )}

          {(order.status === 'shipped' || order.status === 'active') && (
            <TrackingSection key={order.status} order={order} onSaved={load} canWalkIn={!!pickupLocation} />
          )}

          {PACKING_VISIBLE.includes(order.status) && <PackingProof orderId={order.id} returning={order.status === 'active'} />}

          {(order.status === 'returned' || order.status === 'inspecting') && (
            <section className="flex gap-4 rounded-card border border-line bg-[#EDE6FA] p-6">
              <MagnifyingGlassIcon size={32} className="flex-shrink-0 text-[#263544]" />
              <div>
                <h2 className="font-bold text-[#263544]">ส่งคืนแล้ว รอร้านตรวจสภาพ</h2>
                <p className="mt-1 text-base text-[#263544]/70">
                  หยุดนับค่าปรับตั้งแต่ที่คุณแจ้งเลขพัสดุ{order.returnTrackingNo && ` (${order.returnTrackingNo})`} เมื่อร้านได้รับและตรวจเรียบร้อยจะโอนมัดจำ{' '}
                  {formatBaht(order.depositTotal)} หักรายการ (ถ้ามี) คืนเข้าบัญชีที่คุณระบุไว้
                </p>
              </div>
            </section>
          )}

          {order.status === 'completed' && (
            <section className="flex gap-4 rounded-card border border-line bg-[#FFF3B0] p-6">
              <StarIcon size={32} weight="fill" className="flex-shrink-0 text-[#F5B400]" />
              <div>
                <h2 className="font-bold text-[#263544]">
                  {reviewThanks ? 'ขอบคุณสำหรับรีวิว!' : 'จบการเช่าเรียบร้อย ขอบคุณที่ใช้บริการ'}
                </h2>
                <p className="mt-1 text-base text-[#263544]/70">
                  {order.lines.every((l) => myReviews[l.id])
                    ? 'คุณรีวิวครบทุกชุดแล้ว รีวิวของคุณช่วยให้คนอื่นเลือกชุดและไซส์ได้ง่ายขึ้น'
                    : 'ช่วยรีวิวชุดที่เช่าหน่อยนะ โดยเฉพาะเรื่องไซส์และสภาพชุด จะช่วยคนที่กำลังตัดสินใจได้มาก'}
                </p>
              </div>
            </section>
          )}

          {/* รายการชุด */}
          <section className="rounded-3xl bg-[#F7F7F8] p-6">
            <h2 className="mb-4 text-lg font-bold text-[#263544]">ชุดที่เช่า</h2>
            <ul className="space-y-4">
              {order.lines.map((line) => (
                <li key={line.id} className="flex gap-4">
                  <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-[#FDE3EE]">
                    {line.coverImageUrl ? (
                      <img src={line.coverImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#E5457F]/40">
                        <ImageIcon size={24} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-base">
                    {line.productId ? (
                      <Link href={`/costumes/${line.productId}`} className="font-bold text-[#263544] hover:underline">
                        {line.productName}
                      </Link>
                    ) : (
                      <p className="font-bold text-[#263544]">{line.productName}</p>
                    )}
                    {line.size && <p className="text-[#263544]/60">ไซส์ {line.size}</p>}
                    {line.pieceNames && (
                      <p className="text-[#263544]/60">เช่าแยกชิ้น: {line.pieceNames.join(', ')}</p>
                    )}
                    <p className="text-[#263544]/60">
                      เช่า {line.rentalDays} วัน · ค่าเช่า {formatBaht(line.rentalPrice)}
                      {line.extraDaysFee > 0 &&
                        ` (วันแรก ${formatBaht(line.baseRentalPrice)} + ${line.rentalDays - 1} วัน × ${formatBaht(line.extraDayRate)})`}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <DateChip label={isPickup ? 'รับที่ร้าน' : 'ได้รับชุด'} date={addDays(line.startDate, -bufferBefore)} />
                      <DateChip label="วันใช้งาน" date={line.startDate} highlight />
                      <DateChip label="ส่งคืนภายใน" date={line.endDate} />
                    </div>

                    {order.status === 'completed' &&
                      (myReviews[line.id] ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2">
                          <StarDisplay value={myReviews[line.id].rating} size={14} />
                          <span className="text-base font-medium text-[#263544]">รีวิวแล้ว</span>
                          {myReviews[line.id].isHidden && (
                            <span className="text-base text-[#263544]/50">(ร้านซ่อนรีวิวนี้ไว้)</span>
                          )}
                          {line.productId && !myReviews[line.id].isHidden && (
                            <Link
                              href={`/costumes/${line.productId}#reviews`}
                              className="ml-auto text-base font-semibold text-[#E5457F] hover:underline"
                            >
                              ดูในหน้าชุด
                            </Link>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReviewingId(line.id)}
                          className="lift focus-ring mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-brand px-4 py-1.5 text-base font-bold text-white active:bg-brand-strong"
                        >
                          <StarIcon size={14} weight="fill" />
                          เขียนรีวิว
                        </button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="h-fit space-y-4">
          <section className="rounded-3xl bg-[#F7F7F8] p-5">
            <h2 className="mb-3 font-bold text-[#263544]">สรุปยอด</h2>
            <dl className="space-y-1.5 text-base">
              <PriceRow label="ค่าเช่าชุด" value={order.rentalTotal} />
              <PriceRow label="ค่ามัดจำ (ได้คืน)" value={order.depositTotal} />
              {order.laundryTotal > 0 && <PriceRow label="ค่าซักรีด" value={order.laundryTotal} />}
              <PriceRow label={isPickup ? 'ค่าจัดส่ง (รับเองที่ร้าน)' : 'ค่าจัดส่ง'} value={order.shippingFee} />
              <div className="flex items-center justify-between border-t border-dashed border-line-subtle pt-2">
                <dt className="font-bold text-[#263544]">รวมทั้งหมด</dt>
                <dd className="text-lg font-extrabold text-brand">{formatBaht(order.grandTotal)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl bg-[#F7F7F8] p-5 text-base">
            <h2 className="mb-2 font-bold text-[#263544]">{isPickup ? 'รับเองที่ร้าน' : 'จัดส่งถึง'}</h2>
            <p className="font-semibold text-[#263544]">
              {isPickup && <span className="font-normal text-[#263544]/60">ผู้ติดต่อ: </span>}
              {order.shipName} · {order.shipPhone}
            </p>
            <p className="mt-1 text-[#263544]/70">
              {isPickup
                ? pickupLocation
                  ? `${pickupLocation.name} · ${pickupLocation.address}`
                  : ''
                : [order.shipAddress, order.shipSubdistrict, order.shipDistrict, order.shipProvince, order.shipPostalCode]
                    .filter(Boolean)
                    .join(' ')}
            </p>
            {order.handoverTo && (
              <p className="mt-1 text-[#263544]/70">
                ส่งมอบให้ {order.handoverTo}
                {order.handedOverAt && ` · ${formatDateTime(order.handedOverAt)}`}
              </p>
            )}
            {order.customerNote && (
              <p className="mt-2 rounded-xl bg-[#FFFAFC] px-3 py-2 text-base text-[#263544]/70">
                หมายเหตุ: {order.customerNote}
              </p>
            )}
          </section>
        </aside>
      </div>
      {reviewingId &&
        (() => {
          const line = order.lines.find((l) => l.id === reviewingId)
          if (!line) return null
          return (
            <ReviewForm
              orderItemId={line.id}
              productName={line.productName}
              size={line.size}
              coverImageUrl={line.coverImageUrl}
              onClose={() => setReviewingId(null)}
              onSubmitted={async () => {
                setReviewingId(null)
                setReviewThanks(true)
                setMyReviews(await fetchMyReviewsByOrderItem(order.lines.map((l) => l.id)))
              }}
            />
          )
        })()}
      </div>
    </CustomerLayout>
  )
}

// รูปและเช็กลิสต์ที่ร้านบันทึกตอนแพ็ก (ฝั่งแอดมินบอกว่า "ลูกค้าเห็นรูปนี้")
// แสดงเฉพาะช่วงที่ใช้จริง: ตอนชุดกำลังมาส่ง (เทียบตอนเปิดกล่อง) และตอนต้องส่งคืน (เช็กก่อนแพ็กกลับ)
const PACKING_VISIBLE: OrderSummary['status'][] = ['shipped', 'active']

type Packing = { photos: string[]; checklist: { name: string; checked: boolean }[]; packedAt: string }

function PackingProof({ orderId, returning }: { orderId: string; returning: boolean }) {
  // undefined = กำลังโหลด · null = ไม่มีข้อมูลตอนแพ็ก (ไม่ต้องแสดงส่วนนี้)
  const [packing, setPacking] = useState<Packing | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    fetch(`/api/orders/${orderId}/evidence`)
      .then((r) => (r.ok ? r.json() : { packing: null }))
      .then((d: { packing: Packing | null }) => alive && setPacking(d.packing ?? null))
      .catch(() => alive && setPacking(null))
    return () => {
      alive = false
    }
  }, [orderId])

  if (packing === undefined) return <div className="h-40 animate-pulse rounded-card bg-sunken" />
  if (!packing) return null
  const items = packing.checklist.filter((c) => c.checked)
  if (packing.photos.length === 0 && items.length === 0) return null

  return (
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-[#263544]">
        <PackageIcon size={22} className="text-[#E5457F]" />
        ของที่ร้านแพ็กให้คุณ
      </h2>
      <p className="mt-1 text-base text-[#263544]/70">
        {returning
          ? 'ก่อนแพ็กส่งคืน เทียบกับรายการนี้ให้ครบทุกชิ้น ของที่ขาดจะถูกหักจากมัดจำ'
          : 'เปิดกล่องแล้วเทียบกับรูปและรายการนี้ได้เลย ถ้าของไม่ครบหรือชุดมีปัญหา แจ้งร้านภายในวันที่ได้รับ'}
      </p>

      {packing.photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {packing.photos.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="focus-ring block overflow-hidden rounded-xl border border-line-subtle">
              <img src={url} alt={`รูปตอนแพ็ก ${i + 1}`} className="aspect-square w-full object-cover transition-transform hover:scale-105" />
            </a>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-5">
          <h3 className="text-base font-semibold text-[#263544]">
            ในกล่องมี <span className="tabular-nums">{items.length}</span> รายการ
          </h3>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-base text-[#263544]/80 sm:grid-cols-2">
            {items.map((c) => (
              <li key={c.name} className="flex items-start gap-2">
                <CheckIcon size={16} weight="bold" className="mt-1 flex-shrink-0 text-success" />
                {c.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-sm text-[#263544]/50">ร้านบันทึกไว้เมื่อ {formatDateTime(packing.packedAt)}</p>
    </section>
  )
}

// shipped = แสดงเลขพัสดุที่ร้านส่งมา / active = ให้ลูกค้ากรอกเลขพัสดุส่งคืน (ก่อนร้านจะยืนยันรับคืนได้)
function TrackingSection({
  order,
  onSaved,
  canWalkIn,
}: {
  order: OrderSummary
  onSaved: () => Promise<void>
  canWalkIn: boolean // ร้านเปิดหน้าร้าน → นำชุดมาคืนเองได้ ไม่ต้องกรอกเลขพัสดุ
}) {
  const [editing, setEditing] = useState(!order.returnTrackingNo)
  const [carrier, setCarrier] = useState(order.returnCarrier ?? RETURN_CARRIERS[0])
  const [trackingNo, setTrackingNo] = useState(order.returnTrackingNo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const problem = trackingProblem(trackingNo)
    if (problem) return setError(problem)
    const supabase = createClient()
    if (!supabase) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.rpc('submit_return_tracking', {
      p_order_id: order.id,
      p_carrier: carrier,
      p_tracking_no: normalizeTracking(trackingNo),
    })
    setSaving(false)
    if (error) return setError(translateRpcError(error.message))
    setEditing(false)
    await onSaved()
  }

  if (order.status === 'shipped') {
    const shipUrl = order.shipTrackingNo ? trackingUrl(SHIP_CARRIER, order.shipTrackingNo) : null
    return (
      <section className="rounded-card border border-line bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#263544]">
          <TruckIcon size={22} className="text-[#E5457F]" />
          ชุดกำลังเดินทางไปหาคุณ
        </h2>
        <div className="rounded-2xl bg-[#F7F7F8] p-4 text-base">
          <p className="text-[#263544]/60">ร้านส่งชุดให้คุณด้วย {SHIP_CARRIER}</p>
          {order.shipTrackingNo ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="font-mono text-lg font-bold tracking-wide text-[#263544]">{order.shipTrackingNo}</p>
              {shipUrl && (
                <a href={shipUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#E5457F] hover:underline">
                  ติดตามพัสดุ
                </a>
              )}
            </div>
          ) : (
            <p className="mt-1 text-[#263544]/50">ร้านยังไม่ได้ระบุเลขพัสดุ</p>
          )}
        </div>
        <ConfirmReceived orderId={order.id} onSaved={onSaved} />
      </section>
    )
  }

  const returnUrl = order.returnTrackingNo ? trackingUrl(order.returnCarrier, order.returnTrackingNo) : null

  return (
    <section className="rounded-card border border-line bg-white p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#263544]">
        <ArrowUUpLeftIcon size={22} className="text-[#E5457F]" />
        ส่งชุดคืน
      </h2>

      {editing ? (
        <div className="space-y-3">
          <p className="text-base text-[#263544]/60">
            ส่งชุดคืนแล้วกรอกเลขพัสดุที่นี่ ร้านจะยืนยันรับชุดคืนได้หลังคุณกรอกเลขพัสดุแล้วเท่านั้น
            {canWalkIn && ' · หรือนำชุดมาคืนที่ร้านภายในวันคืน ไม่ต้องกรอกอะไร'}
          </p>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              aria-label="บริษัทขนส่ง"
              className={trackingInputClass}
            >
              {RETURN_CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              placeholder="เช่น EF123456789TH"
              aria-label="เลขพัสดุ"
              autoCapitalize="characters"
              className={`${trackingInputClass} font-mono uppercase`}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-base text-red-600">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="lift focus-ring rounded-full border border-line bg-brand px-6 py-2.5 text-base font-bold text-white active:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'กำลังบันทึก...' : 'แจ้งเลขพัสดุส่งคืน'}
            </button>
            {order.returnTrackingNo && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-base font-medium text-[#263544]/60 hover:text-[#263544]"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-[#EDE6FA] p-4 text-base">
          <div className="min-w-0 flex-1">
            <p className="text-[#263544]/60">{order.returnCarrier}</p>
            <p className="font-mono text-lg font-bold tracking-wide text-[#263544]">{order.returnTrackingNo}</p>
            {order.returnSubmittedAt && (
              <p className="text-[#263544]/50">แจ้งเมื่อ {formatDateTime(order.returnSubmittedAt)}</p>
            )}
          </div>
          {returnUrl && (
            <a href={returnUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#E5457F] hover:underline">
              ติดตามพัสดุ
            </a>
          )}
          <button type="button" onClick={() => setEditing(true)} className="font-semibold text-[#263544] hover:underline">
            แก้ไข
          </button>
        </div>
      )}
    </section>
  )
}

// ลูกค้ากดยืนยันว่าได้รับชุด (ถ้าไม่กด ระบบเปลี่ยนให้เองเมื่อถึงวันใช้งาน)
function ConfirmReceived({ orderId, onSaved }: { orderId: string; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmIt() {
    const supabase = createClient()
    if (!supabase) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.rpc('confirm_received', { p_order_id: orderId })
    setSaving(false)
    if (error) return setError(translateRpcError(error.message))
    await onSaved()
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={confirmIt}
        disabled={saving}
        className="lift focus-ring rounded-full border border-line bg-brand px-6 py-2.5 text-base font-bold text-white active:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? 'กำลังบันทึก...' : 'ได้รับชุดแล้ว'}
      </button>
      <p className="text-base text-[#263544]/60">เปิดกล่องเช็กของให้ครบ ถ้าไม่ครบหรือเสียหายให้ทักร้านภายใน 24 ชม.</p>
      {error && (
        <p role="alert" className="w-full rounded-xl bg-red-50 px-4 py-2.5 text-base text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

// ช่องกรอก design v2: เส้น 1px มุม 10px · focus เส้นชมพู + วงชมพูโปร่ง 3px (แบบเดียวกับหน้าชำระเงิน)
const trackingInputClass =
  'w-full rounded-control border border-line bg-white px-4 py-2.5 text-base text-[#263544] outline-none transition placeholder:text-muted focus:border-brand-strong focus:ring-[3px] focus:ring-brand/25'

function DateChip({ label, date, highlight = false }: { label: string; date: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${highlight ? 'bg-[#E5457F] text-white' : 'bg-[#FDE3EE] text-[#263544]'}`}>
      <p className={highlight ? 'text-white/80' : 'text-[#263544]/60'}>{label}</p>
      <p className="font-bold">{formatThaiDateWithWeekday(date)}</p>
    </div>
  )
}

function PriceRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[#263544]/70">{label}</dt>
      <dd className="font-medium text-[#263544]">{formatBaht(value)}</dd>
    </div>
  )
}

// นับถอยหลังเวลาชำระ อ่าน payment_expires_at (Step 16) แยกเอง ไม่ต้องแก้ fetchOrder
// ชุดถูกกันไว้ให้ระหว่างนี้ เลยเวลาแล้ว pg_cron จะเปลี่ยนเป็น expired และปลดล็อกชุด
function PaymentCountdown({ orderId, onExpire }: { orderId: string; onExpire: () => void }) {
  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase
      .from('orders')
      .select('payment_expires_at')
      .eq('id', orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.payment_expires_at) setDeadline(new Date(data.payment_expires_at).getTime())
      })
  }, [orderId])

  useEffect(() => {
    if (deadline === null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadline])

  const left = deadline === null ? null : Math.max(0, deadline - now)
  const expired = left === 0

  useEffect(() => {
    if (expired) onExpire()
  }, [expired, onExpire])

  if (left === null) return null

  const mm = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')

  return (
    <div
      role="timer"
      aria-live="off"
      className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-base font-semibold ${
        expired
          ? 'border-[#F5C2C0] bg-[#FDE8E8] text-[#B42318]'
          : left < 5 * 60000
            ? 'border-line bg-[#FFF3B0] text-[#263544]'
            : 'border-line-subtle bg-[#F7F7F8] text-[#263544]'
      }`}
    >
      <HourglassIcon size={18} />
      {expired ? 'หมดเวลาชำระแล้ว' : (
        <span>
          ชำระภายใน <span className="font-mono tabular-nums">{mm}:{ss}</span>
        </span>
      )}
    </div>
  )
}

// ลาย QR สร้างจากเลขออเดอร์ (ยังไม่ได้ผูกกับ PromptPay จริง)
function PaymentQr({ seed }: { seed: string }) {
  const size = 21
  const cells: boolean[] = []
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  for (let i = 0; i < size * size; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    cells.push((h >>> 16) % 2 === 0)
  }
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
  const finderOn = (x: number, y: number) => {
    const fx = x >= size - 7 ? x - (size - 7) : x
    const fy = y >= size - 7 ? y - (size - 7) : y
    return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)
  }

  return (
    <div className="rounded-card border border-line bg-white p-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-40 w-40" shapeRendering="crispEdges" aria-label="QR พร้อมเพย์">
        {Array.from({ length: size * size }).map((_, i) => {
          const x = i % size
          const y = Math.floor(i / size)
          const on = inFinder(x, y) ? finderOn(x, y) : cells[i]
          return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#263544" /> : null
        })}
      </svg>
    </div>
  )
}