'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeftIcon,
  CheckIcon,
  HourglassIcon,
  ImageIcon,
  InfoIcon,
  StarIcon,
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
import { DEFAULT_BOOKING_SETTINGS, fetchBookingSettings } from '@/utils/customer/bookingSettings'

export default function OrderPage() {
  const params = useParams()
  const orderId = String(params.id)

  const [order, setOrder] = useState<OrderSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bufferBefore, setBufferBefore] = useState(DEFAULT_BOOKING_SETTINGS.bufferDaysBefore)
  const [acting, setActing] = useState<'pay' | 'cancel' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [myReviews, setMyReviews] = useState<Record<string, Review>>({})
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewThanks, setReviewThanks] = useState(false)

  const load = useCallback(async () => {
    const [res, settings] = await Promise.all([fetchOrder(orderId), fetchBookingSettings()])
    setBufferBefore(settings.bufferDaysBefore)
    if (res.error || !res.data) setLoadError(res.error ?? 'ไม่พบออเดอร์นี้')
    else {
      setOrder(res.data)
      if (res.data.status === 'completed') {
        setMyReviews(await fetchMyReviewsByOrderItem(res.data.lines.map((l) => l.id)))
      }
    }
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  async function runAction(kind: 'pay' | 'cancel') {
    const supabase = createClient()
    if (!supabase || !order) return
    if (kind === 'cancel' && !confirm('ยกเลิกออเดอร์นี้? ชุดจะถูกปล่อยให้คนอื่นจองได้ทันที')) return

    setActing(kind)
    setActionError(null)
    const { error } = await supabase.rpc(kind === 'pay' ? 'submit_payment_mock' : 'cancel_my_order', {
      p_order_id: order.id,
    })
    if (error) setActionError(translateRpcError(error.message))
    await load()
    setActing(null)
  }

  const stepIndex = order ? customerStepIndex(order.status) : -1
  const firstUseDate = useMemo(() => order?.lines[0]?.startDate ?? null, [order])

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
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#263544]/60 hover:text-[#263544]"
      >
        <ArrowLeftIcon size={16} />
        ออเดอร์ของฉัน
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[#263544]/60">เลขที่ออเดอร์</p>
          <h1 className="font-mono text-2xl font-bold text-[#263544]">{order.orderNumber}</h1>
          <p className="text-xs text-[#263544]/50">สั่งเมื่อ {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${ORDER_STATUS_BADGE[order.status]}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

      {/* ความคืบหน้า */}
      {closed ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-gray-100 px-5 py-4 text-sm text-gray-600">
          <XCircleIcon size={22} />
          {order.status === 'cancelled'
            ? 'ออเดอร์นี้ถูกยกเลิกแล้ว ชุดถูกปล่อยให้คนอื่นจองได้ตามปกติ'
            : 'ออเดอร์นี้หมดอายุเพราะไม่ได้ชำระเงินภายในเวลาที่กำหนด'}
        </div>
      ) : (
        <ol className="mb-6 flex overflow-x-auto rounded-2xl border-2 border-[#263544] bg-white p-4">
          {CUSTOMER_STEPS.map((step, i) => {
            const done = i < stepIndex
            const current = i === stepIndex
            return (
              <li key={step.label} className="flex min-w-[88px] flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done || current ? 'bg-[#E5457F]' : 'bg-gray-200'}`} />
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                      done
                        ? 'border-[#E5457F] bg-[#E5457F] text-white'
                        : current
                          ? 'border-[#263544] bg-[#FFF3B0] text-[#263544]'
                          : 'border-gray-200 bg-white text-gray-300'
                    }`}
                  >
                    {done ? <CheckIcon size={14} weight="bold" /> : i + 1}
                  </span>
                  <span
                    className={`h-0.5 flex-1 ${i === CUSTOMER_STEPS.length - 1 ? 'invisible' : done ? 'bg-[#E5457F]' : 'bg-gray-200'}`}
                  />
                </div>
                <span className={`mt-1.5 text-[11px] ${current ? 'font-bold text-[#263544]' : 'text-[#263544]/50'}`}>
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
            <section className="rounded-3xl border-2 border-[#263544] bg-white p-6 shadow-[4px_4px_0_0_#263544]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#263544]">ชำระเงิน</h2>
                  <p className="text-sm text-[#263544]/60">สแกน QR เพื่อโอนยอดด้านล่าง แล้วกดแจ้งชำระเงิน</p>
                </div>
                <span className="whitespace-nowrap rounded-full border-2 border-[#263544] bg-[#FFF3B0] px-3 py-1 text-xs font-bold text-[#263544]">
                  โหมดทดสอบ
                </span>
              </div>

              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <MockQr seed={order.orderNumber} />
                <div className="w-full flex-1 space-y-2 text-sm">
                  <p className="text-[#263544]/60">ยอดที่ต้องชำระ</p>
                  <p className="text-3xl font-extrabold text-[#E5457F]">{formatBaht(order.grandTotal)}</p>
                  <p className="text-[#263544]/70">
                    ชื่อบัญชี: <span className="font-semibold text-[#263544]">CosMate (บัญชีทดสอบ)</span>
                  </p>
                  <p className="flex gap-1.5 rounded-xl bg-[#EDE6FA] px-3 py-2 text-xs text-[#263544]">
                    <InfoIcon size={16} className="flex-shrink-0" />
                    ระบบยังไม่เชื่อมต่อช่องทางชำระเงินจริง QR นี้เป็นตัวอย่าง สแกนไม่ได้ กดปุ่มด้านล่างเพื่อจำลองการชำระเงิน
                  </p>
                </div>
              </div>

              {actionError && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {actionError}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => runAction('pay')}
                  disabled={acting !== null}
                  className="flex-1 rounded-full border-2 border-[#263544] bg-[#E5457F] py-3 text-sm font-bold text-white shadow-[3px_3px_0_0_#263544] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#263544] disabled:opacity-50"
                >
                  {acting === 'pay' ? 'กำลังส่งข้อมูล...' : 'แจ้งชำระเงินแล้ว (โหมดทดสอบ)'}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('cancel')}
                  disabled={acting !== null}
                  className="rounded-full border-2 border-[#263544] px-5 py-3 text-sm font-semibold text-[#263544] transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {acting === 'cancel' ? 'กำลังยกเลิก...' : 'ยกเลิกออเดอร์'}
                </button>
              </div>
            </section>
          )}

          {order.status === 'manual_review' && (
            <section className="flex gap-4 rounded-3xl border-2 border-[#263544] bg-[#EDE6FA] p-6">
              <HourglassIcon size={32} className="flex-shrink-0 text-[#263544]" />
              <div>
                <h2 className="font-bold text-[#263544]">ได้รับแจ้งชำระเงินแล้ว</h2>
                <p className="mt-1 text-sm text-[#263544]/70">
                  ร้านกำลังตรวจสอบยอดเงิน เมื่อยืนยันแล้วสถานะจะเปลี่ยนเป็น &quot;ชำระแล้ว รอจัดส่ง&quot;
                  {firstUseDate && ` และชุดจะถึงมือคุณภายใน ${formatThaiDateWithWeekday(addDays(firstUseDate, -bufferBefore))}`}
                </p>
              </div>
            </section>
          )}

          {order.status === 'completed' && (
            <section className="flex gap-4 rounded-3xl border-2 border-[#263544] bg-[#FFF3B0] p-6">
              <StarIcon size={32} weight="fill" className="flex-shrink-0 text-[#F5B400]" />
              <div>
                <h2 className="font-bold text-[#263544]">
                  {reviewThanks ? 'ขอบคุณสำหรับรีวิว!' : 'จบการเช่าเรียบร้อย ขอบคุณที่ใช้บริการ'}
                </h2>
                <p className="mt-1 text-sm text-[#263544]/70">
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
                  <div className="min-w-0 flex-1 text-sm">
                    {line.productId ? (
                      <Link href={`/costumes/${line.productId}`} className="font-bold text-[#263544] hover:underline">
                        {line.productName}
                      </Link>
                    ) : (
                      <p className="font-bold text-[#263544]">{line.productName}</p>
                    )}
                    {line.size && <p className="text-[#263544]/60">ไซส์ {line.size}</p>}
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <DateChip label="ได้รับชุด" date={addDays(line.startDate, -bufferBefore)} />
                      <DateChip label="วันใช้งาน" date={line.startDate} highlight />
                      <DateChip label="ส่งคืนภายใน" date={line.endDate} />
                    </div>

                    {order.status === 'completed' &&
                      (myReviews[line.id] ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2">
                          <StarDisplay value={myReviews[line.id].rating} size={14} />
                          <span className="text-xs font-medium text-[#263544]">รีวิวแล้ว</span>
                          {myReviews[line.id].isHidden && (
                            <span className="text-xs text-[#263544]/50">(ร้านซ่อนรีวิวนี้ไว้)</span>
                          )}
                          {line.productId && !myReviews[line.id].isHidden && (
                            <Link
                              href={`/costumes/${line.productId}#reviews`}
                              className="ml-auto text-xs font-semibold text-[#E5457F] hover:underline"
                            >
                              ดูในหน้าชุด
                            </Link>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReviewingId(line.id)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-[#263544] bg-[#E5457F] px-4 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0_0_#263544] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#263544]"
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
            <dl className="space-y-1.5 text-sm">
              <PriceRow label="ค่าเช่าชุด" value={order.rentalTotal} />
              <PriceRow label="ค่ามัดจำ (ได้คืน)" value={order.depositTotal} />
              {order.laundryTotal > 0 && <PriceRow label="ค่าซักรีด" value={order.laundryTotal} />}
              <PriceRow label="ค่าจัดส่ง" value={order.shippingFee} />
              <div className="flex items-center justify-between border-t-2 border-dashed border-gray-200 pt-2">
                <dt className="font-bold text-[#263544]">รวมทั้งหมด</dt>
                <dd className="text-lg font-extrabold text-[#E5457F]">{formatBaht(order.grandTotal)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl bg-[#F7F7F8] p-5 text-sm">
            <h2 className="mb-2 font-bold text-[#263544]">จัดส่งถึง</h2>
            <p className="font-semibold text-[#263544]">
              {order.shipName} · {order.shipPhone}
            </p>
            <p className="mt-1 text-[#263544]/70">
              {[order.shipAddress, order.shipSubdistrict, order.shipDistrict, order.shipProvince, order.shipPostalCode]
                .filter(Boolean)
                .join(' ')}
            </p>
            {order.customerNote && (
              <p className="mt-2 rounded-xl bg-[#FFFAFC] px-3 py-2 text-xs text-[#263544]/70">
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
    </CustomerLayout>
  )
}

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

// QR ตกแต่งสำหรับโหมดทดสอบ (สร้างลายจากเลขออเดอร์ ไม่ใช่ QR จริง สแกนไม่ได้)
function MockQr({ seed }: { seed: string }) {
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
    <div className="relative rounded-2xl border-2 border-[#263544] bg-white p-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-40 w-40" shapeRendering="crispEdges" aria-label="QR ตัวอย่าง">
        {Array.from({ length: size * size }).map((_, i) => {
          const x = i % size
          const y = Math.floor(i / size)
          const on = inFinder(x, y) ? finderOn(x, y) : cells[i]
          return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#263544" /> : null
        })}
      </svg>
      <span className="absolute inset-x-0 -bottom-3 mx-auto w-fit rounded-full bg-[#263544] px-2 py-0.5 text-[10px] font-semibold text-white">
        ตัวอย่าง
      </span>
    </div>
  )
}
