'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ArrowUUpLeftIcon,
  CheckCircleIcon,
  ImageIcon,
  PackageIcon,
  RulerIcon,
  ShoppingCartSimpleIcon,
  StarIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import BookingCalendar from '@/app/components/customer/BookingCalendar'
import FavoriteButton from '@/app/components/customer/FavoriteButton'
import ProductReviews from '@/app/components/customer/ProductReviews'
import { StarDisplay } from '@/app/components/customer/StarRating'
import { fetchRatingSummaries, type RatingSummary } from '@/utils/customer/reviews'
import { addToCart, encodeCheckoutItems } from '@/utils/customer/cart'
import { COLOR_HEX, colorKeysOf } from '@/utils/customer/filterOptions'
import { fetchCostumeDetail, type CostumeDetail } from '@/utils/customer/fetchCostumeDetail'
import {
  DEFAULT_BOOKING_SETTINGS,
  fetchBookingSettings,
  customerHeldDays,
  getRentalTimeline,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'
import { CATEGORY_LABEL, FRANCHISE_LABEL, GENDER_LABEL } from '@/utils/customer/labels'
import { formatBaht, formatThaiDateWithWeekday } from '@/utils/dateUtils'
import { createClient } from '@/utils/client'

const DAYS_AHEAD = 120

export default function CostumeDetailPage() {
  const params = useParams()
  const productId = String(params.id)
  const router = useRouter()

  const [detail, setDetail] = useState<CostumeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
  const [activeImage, setActiveImage] = useState(0)

  const [variantId, setVariantId] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())
  const [datesLoading, setDatesLoading] = useState(false)
  const [datesError, setDatesError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [cartNotice, setCartNotice] = useState<string | null>(null)
  const [rating, setRating] = useState<RatingSummary | null>(null)

  useEffect(() => {
    fetchRatingSummaries([productId]).then((r) => setRating(r[productId] ?? null))
  }, [productId])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchCostumeDetail(productId), fetchBookingSettings()]).then(([res, s]) => {
      if (cancelled) return
      setSettings(s)
      if (res.error || !res.data) {
        setLoadError(res.error ?? 'ไม่พบชุดนี้')
      } else {
        setDetail(res.data)
        // เลือกไซส์แรกที่ยังมีชุดพร้อมให้เช่าไว้ให้ก่อน ลดขั้นตอนลูกค้า
        const firstAvailable = res.data.variants.find((v) => v.availableUnits > 0)
        setVariantId(firstAvailable?.id ?? null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [productId])

  // เปลี่ยนไซส์ → โหลดวันที่ไม่ว่างของไซส์นั้นใหม่ และล้างวันที่เลือกไว้
  useEffect(() => {
    setSelectedDate(null)
    setUnavailable(new Set())
    setDatesError(null)
    if (!variantId) return

    const supabase = createClient()
    if (!supabase) return

    let cancelled = false
    setDatesLoading(true)
    supabase
      .rpc('get_unavailable_start_dates', { p_variant_id: variantId, p_days_ahead: DAYS_AHEAD })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setDatesError('โหลดปฏิทินไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง')
        else setUnavailable(new Set(((data ?? []) as string[]).map((d) => String(d).slice(0, 10))))
        setDatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [variantId])

  const variant = useMemo(
    () => detail?.variants.find((v) => v.id === variantId) ?? null,
    [detail, variantId],
  )

  const timeline = useMemo(
    () => (variant && selectedDate ? getRentalTimeline(selectedDate, variant.packageDays, settings) : null),
    [variant, selectedDate, settings],
  )

  const hasSizeChart = detail?.variants.some((v) => v.chart) ?? false

  function handleRent() {
    if (!variant || !selectedDate) return
    router.push(`/checkout?items=${encodeCheckoutItems([{ variantId: variant.id, startDate: selectedDate }])}`)
  }

  function handleAddToCart() {
    if (!variant || !selectedDate) return
    const result = addToCart(variant.id, selectedDate)
    setCartNotice(result === 'added' ? 'เพิ่มลงตะกร้าแล้ว' : 'ชุดไซส์นี้วันนี้อยู่ในตะกร้าแล้ว')
    window.setTimeout(() => setCartNotice(null), 4000)
  }

  if (loading) {
    return (
      <CustomerLayout>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="aspect-[3/4] animate-pulse rounded-3xl bg-gray-100" />
          <div className="h-96 animate-pulse rounded-3xl bg-gray-100" />
        </div>
      </CustomerLayout>
    )
  }

  if (loadError || !detail) {
    return (
      <CustomerLayout>
        <div className="rounded-3xl bg-[#F7F7F8] px-6 py-16 text-center">
          <p className="text-[#263544]/60">{loadError}</p>
          <Link href="/costumes" className="mt-4 inline-block font-semibold text-[#E5457F] hover:underline">
            กลับไปหน้าสำรวจชุด
          </Link>
        </div>
      </CustomerLayout>
    )
  }

  const subtotal = variant ? variant.packagePrice + variant.depositAmount + variant.laundryFee : 0
  const grandTotal = variant ? subtotal + settings.shippingFlatRate : 0

  return (
    <CustomerLayout>
      <Link
        href="/costumes"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#263544]/60 hover:text-[#263544]"
      >
        <ArrowLeftIcon size={16} />
        กลับไปหน้าสำรวจชุด
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ------------------------------ รูป ------------------------------ */}
        <div>
          <div className="aspect-[3/4] overflow-hidden rounded-3xl border-2 border-[#263544] bg-[#FDE3EE]">
            {detail.images.length > 0 ? (
              <img
                src={detail.images[activeImage]}
                alt={detail.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[#E5457F]/40">
                <ImageIcon size={64} />
              </div>
            )}
          </div>
          {detail.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {detail.images.map((url, i) => (
                <button
                  key={url + i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${
                    i === activeImage ? 'border-[#E5457F]' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* --------------------------- ข้อมูล + จอง --------------------------- */}
        <div>
          <div className="flex flex-wrap gap-2">
            {detail.costumeCategory && (
              <span className="rounded-full bg-[#E5457F] px-3 py-1 text-xs font-semibold text-white">
                {CATEGORY_LABEL[detail.costumeCategory] ?? detail.costumeCategory}
              </span>
            )}
            {detail.franchiseType && (
              <span className="rounded-full bg-[#263544] px-3 py-1 text-xs font-semibold text-white">
                {FRANCHISE_LABEL[detail.franchiseType] ?? detail.franchiseType}
              </span>
            )}
            {detail.genderTag && (
              <span className="rounded-full bg-[#EDE6FA] px-3 py-1 text-xs font-semibold text-[#263544]">
                {GENDER_LABEL[detail.genderTag] ?? detail.genderTag}
              </span>
            )}
            {detail.crossplayFriendly && (
              <span className="rounded-full bg-[#FFF3B0] px-3 py-1 text-xs font-semibold text-[#263544]">
                เหมาะกับ Crossplay
              </span>
            )}
            {detail.isGroupSet && (
              <span className="rounded-full bg-[#FFF3B0] px-3 py-1 text-xs font-semibold text-[#263544]">
                ชุดธีมกลุ่ม/คู่
              </span>
            )}
          </div>

          {detail.seriesName && <p className="mt-4 text-sm text-[#263544]/50">{detail.seriesName}</p>}
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-3xl font-extrabold leading-tight text-[#263544]">{detail.name}</h1>
            <FavoriteButton productId={detail.id} size="lg" />
          </div>
          {detail.characterName && <p className="mt-1 text-[#263544]/60">ตัวละคร: {detail.characterName}</p>}
          {rating && rating.reviewCount > 0 && (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm text-[#263544] hover:text-[#E5457F]">
              <StarDisplay value={rating.avgRating} size={16} />
              <span className="font-semibold">{rating.avgRating.toFixed(1)}</span>
              <span className="text-[#263544]/60 underline">{rating.reviewCount} รีวิว</span>
            </a>
          )}
          {colorKeysOf(detail.colorTags).length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              {colorKeysOf(detail.colorTags).map((key) => (
                <span
                  key={key}
                  className="h-5 w-5 rounded-full border border-[#263544]/40"
                  style={{ backgroundColor: COLOR_HEX[key] }}
                />
              ))}
            </div>
          )}
          {detail.variants.length > 0 && (
            <p className="mt-3 text-2xl font-bold text-[#E5457F]">
              {formatBaht((variant ?? detail.variants[0]).packagePrice)} /{' '}
              {customerHeldDays((variant ?? detail.variants[0]).packageDays, settings)} วัน
            </p>
          )}

          {/* ขั้นที่ 1: ไซส์ */}
          <section className="mt-6">
            <p className="mb-2 text-sm font-semibold text-[#263544]">1. เลือกไซส์</p>
            {detail.variants.length === 0 ? (
              <p className="text-sm text-[#263544]/50">ชุดนี้ยังไม่ได้ตั้งไซส์และราคา</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {detail.variants.map((v) => {
                  const soldOut = v.availableUnits === 0
                  const active = v.id === variantId
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={soldOut}
                      onClick={() => setVariantId(v.id)}
                      className={`min-w-[64px] rounded-xl border-2 px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${
                        active
                          ? 'border-[#263544] bg-[#E5457F] text-white shadow-[2px_2px_0_0_#263544]'
                          : soldOut
                            ? 'border-gray-200 bg-gray-50 text-gray-300 line-through'
                            : 'border-[#263544] bg-white text-[#263544] hover:bg-[#FDE3EE]'
                      }`}
                    >
                      {v.size}
                    </button>
                  )
                })}
              </div>
            )}
            {variant && (
              <p className="mt-2 text-xs text-[#263544]/60">
                ค่าเช่า {formatBaht(variant.packagePrice)} · ใช้งาน 1 วัน + ส่งคืนวันถัดไป
              </p>
            )}
          </section>

          {/* ขั้นที่ 2: วันใช้งาน */}
          {variant && (
            <section className="mt-6">
              <p className="mb-1 text-sm font-semibold text-[#263544]">2. เลือกวันที่จะใส่ชุด</p>
              <p className="mb-3 text-xs text-[#263544]/60">
                จองล่วงหน้าอย่างน้อย {settings.minLeadDays} วัน · วันที่ขีดฆ่าคือวันที่ชุดไซส์นี้ไม่ว่าง
              </p>
              {datesError ? (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{datesError}</p>
              ) : (
                <BookingCalendar
                  unavailable={unavailable}
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  daysAhead={DAYS_AHEAD}
                  loading={datesLoading}
                  receiveDate={timeline?.receiveDate}
                  returnBy={timeline?.returnBy}
                />
              )}
            </section>
          )}

          {/* สรุปช่วงเช่า + ราคา */}
          {variant && (
            <section className="mt-6 rounded-2xl border-2 border-[#263544] bg-white p-5 shadow-[4px_4px_0_0_#263544]">
              {timeline ? (
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <TimelineStep
                    icon={<PackageIcon size={18} />}
                    label="ได้รับชุด"
                    date={formatThaiDateWithWeekday(timeline.receiveDate)}
                  />
                  <TimelineStep
                    icon={<StarIcon size={18} weight="fill" />}
                    label="วันใช้งาน"
                    date={formatThaiDateWithWeekday(timeline.useDate)}
                    highlight
                  />
                  <TimelineStep
                    icon={<ArrowUUpLeftIcon size={18} />}
                    label="ส่งคืนภายใน"
                    date={formatThaiDateWithWeekday(timeline.returnBy)}
                  />
                </div>
              ) : (
                <p className="mb-4 rounded-xl bg-[#FFF3B0] px-4 py-2.5 text-center text-sm text-[#263544]">
                  เลือกวันที่จะใส่ชุดในปฏิทิน เพื่อดูวันรับและวันคืนชุด
                </p>
              )}

              <dl className="space-y-1.5 text-sm">
                <PriceRow label="ค่าเช่าชุด" value={variant.packagePrice} />
                <PriceRow label="ค่ามัดจำ (ได้คืนหลังตรวจชุด)" value={variant.depositAmount} />
                {variant.laundryFee > 0 && <PriceRow label="ค่าซักรีด" value={variant.laundryFee} />}
                <PriceRow label="ค่าจัดส่ง" value={settings.shippingFlatRate} />
                <div className="flex items-center justify-between border-t-2 border-dashed border-gray-200 pt-2">
                  <dt className="font-bold text-[#263544]">ยอดชำระทั้งหมด</dt>
                  <dd className="text-xl font-extrabold text-[#E5457F]">{formatBaht(grandTotal)}</dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!selectedDate}
                  className="flex items-center justify-center gap-2 rounded-full border-2 border-[#263544] bg-white py-3 text-sm font-bold text-[#263544] transition hover:bg-[#FDE3EE] disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-white"
                >
                  <ShoppingCartSimpleIcon size={18} weight="bold" />
                  เพิ่มลงตะกร้า
                </button>
                <button
                  type="button"
                  onClick={handleRent}
                  disabled={!selectedDate}
                  className="rounded-full border-2 border-[#263544] bg-[#E5457F] py-3 text-sm font-bold text-white shadow-[3px_3px_0_0_#263544] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#263544] disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                >
                  {selectedDate ? 'เช่าเลย' : 'เลือกวันใช้งานก่อน'}
                </button>
              </div>
              {cartNotice && (
                <p className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#EDE6FA] px-3 py-2 text-sm text-[#263544]">
                  <CheckCircleIcon size={18} weight="fill" className="text-[#E5457F]" />
                  {cartNotice}
                  <Link href="/cart" className="font-semibold text-[#E5457F] underline">
                    ไปที่ตะกร้า
                  </Link>
                </p>
              )}
              <p className="mt-2 text-center text-xs text-[#263544]/50">
                มัดจำคืนภายใน {variant.depositReturnHours} ชม. หลังร้านได้รับชุดคืนและตรวจสภาพเรียบร้อย
              </p>
            </section>
          )}
        </div>
      </div>

      {/* ------------------------- รายละเอียดเพิ่มเติม ------------------------- */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {detail.description && (
          <section className="rounded-3xl bg-[#F7F7F8] p-6">
            <h2 className="mb-2 text-lg font-bold text-[#263544]">รายละเอียดชุด</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#263544]/80">{detail.description}</p>
          </section>
        )}

        {detail.inclusions.length > 0 && (
          <section className="rounded-3xl bg-[#F7F7F8] p-6">
            <h2 className="mb-3 text-lg font-bold text-[#263544]">สิ่งที่ได้รับในชุดนี้</h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {detail.inclusions.map((inc) => (
                <li key={inc.id} className="flex items-center gap-2 text-sm text-[#263544]">
                  {inc.imageUrl ? (
                    <img src={inc.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  ) : (
                    <CheckCircleIcon size={20} weight="fill" className="flex-shrink-0 text-[#E5457F]" />
                  )}
                  {inc.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {hasSizeChart && (
          <section className="rounded-3xl bg-[#F7F7F8] p-6 lg:col-span-2">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#263544]">
              <RulerIcon size={20} />
              ตารางไซส์ (นิ้ว)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-center text-sm">
                <thead className="bg-[#FDE3EE] text-[#263544]">
                  <tr>
                    <th className="rounded-l-lg px-3 py-2">ไซส์</th>
                    <th className="px-3 py-2">รอบอก</th>
                    <th className="px-3 py-2">รอบเอว</th>
                    <th className="px-3 py-2">รอบสะโพก</th>
                    <th className="px-3 py-2">ความยาว</th>
                    <th className="rounded-r-lg px-3 py-2">ส่วนสูงแนะนำ (ซม.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[#263544]/80">
                  {detail.variants
                    .filter((v) => v.chart)
                    .map((v) => (
                      <tr key={v.id} className={v.id === variantId ? 'bg-[#FFFAFC] font-semibold' : ''}>
                        <td className="px-3 py-2 font-bold text-[#263544]">{v.size}</td>
                        <td className="px-3 py-2">{v.chart?.chestIn ?? '—'}</td>
                        <td className="px-3 py-2">{v.chart?.waistIn ?? '—'}</td>
                        <td className="px-3 py-2">{v.chart?.hipIn ?? '—'}</td>
                        <td className="px-3 py-2">{v.chart?.lengthIn ?? '—'}</td>
                        <td className="px-3 py-2">
                          {v.chart?.heightMin || v.chart?.heightMax
                            ? `${v.chart?.heightMin ?? '?'}–${v.chart?.heightMax ?? '?'}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <ProductReviews productId={detail.id} />
      </div>
    </CustomerLayout>
  )
}

function TimelineStep({
  icon,
  label,
  date,
  highlight = false,
}: {
  icon: ReactNode
  label: string
  date: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl px-2 py-2.5 ${highlight ? 'bg-[#E5457F] text-white' : 'bg-[#FDE3EE] text-[#263544]'}`}>
      <div className="flex justify-center">{icon}</div>
      <p className={`mt-1 text-[11px] ${highlight ? 'text-white/80' : 'text-[#263544]/60'}`}>{label}</p>
      <p className="text-sm font-bold">{date}</p>
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
