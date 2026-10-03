'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ArrowUUpLeftIcon,
  CaretDownIcon,
  CheckCircleIcon,
  ImageIcon,
  MagnifyingGlassPlusIcon,
  PackageIcon,
  RulerIcon,
  ShoppingCartSimpleIcon,
  StarIcon,
  XIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import BookingCalendar from '@/app/components/customer/BookingCalendar'
import FavoriteButton from '@/app/components/customer/FavoriteButton'
import ProductReviews from '@/app/components/customer/ProductReviews'
import { StarDisplay } from '@/app/components/customer/StarRating'
import { fetchRatingSummaries, type RatingSummary } from '@/utils/customer/reviews'
import { addToCart, encodeCheckoutItems } from '@/utils/customer/cart'
import { loginHref } from '@/utils/customer/authUser'
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
import { fetchEvents, type CalendarEvent } from '@/utils/customer/events'
import { formatBaht, formatThaiDateWithWeekday } from '@/utils/dateUtils'
import { depositForRental } from '@/utils/customer/pricing'
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
  const [rating, setRating] = useState<RatingSummary | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [previewInclusion, setPreviewInclusion] = useState<{ url: string; name: string } | null>(null)
  const [rentMode, setRentMode] = useState<'set' | 'pieces'>('set')
  const [selectedPieces, setSelectedPieces] = useState<Set<string>>(new Set())

  // กด Esc ปิดหน้าต่างดูรูป
  useEffect(() => {
    if (!previewInclusion) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreviewInclusion(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewInclusion])

  useEffect(() => {
    fetchRatingSummaries([productId]).then((r) => setRating(r[productId] ?? null))
  }, [productId])

  useEffect(() => {
    fetchEvents().then(({ events }) => setEvents(events))
  }, [])

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

  const getTimeline = useCallback(
    (useDate: string) => getRentalTimeline(useDate, variant?.packageDays ?? 1, settings),
    [variant, settings],
  )

  const timeline = useMemo(
    () => (variant && selectedDate ? getTimeline(selectedDate) : null),
    [variant, selectedDate, getTimeline],
  )

  const hasSizeChart = detail?.variants.some((v) => v.chart) ?? false

  // โหมดแยกชิ้น → ส่ง id ชิ้นที่เลือกไปด้วย (ราคาจริงคำนวณใหม่ในฐานข้อมูลตอนจอง)
  const chosenPieces = (): string[] | undefined =>
    rentMode === 'pieces' && selectedPieces.size > 0 ? Array.from(selectedPieces) : undefined

  function handleRent() {
    if (!variant || !selectedDate) return
    router.push(
      `/checkout?items=${encodeCheckoutItems([{ variantId: variant.id, startDate: selectedDate, pieces: chosenPieces()?.sort() }])}`,
    )
  }

  function handleAddToCart() {
    if (!variant || !selectedDate) return
    // ยังไม่ล็อกอิน → ไปเข้าสู่ระบบก่อน แล้วกลับมาหน้านี้
    if (addToCart(variant.id, selectedDate, chosenPieces()) === 'login') {
      router.push(loginHref(window.location.pathname + window.location.search))
    }
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

  // ---- เช่าทั้งชุด / เลือกเช่าแยกชิ้น ----
  // ชิ้นที่แอดมินตั้งราคาไว้เท่านั้นที่เลือกแยกได้
  const pricedPieces = detail.inclusions.filter((inc) => inc.price != null)
  const canSplit = pricedPieces.length > 0
  const pieceMode = canSplit && rentMode === 'pieces'
  const piecesTotal = pricedPieces.filter((p) => selectedPieces.has(p.id)).reduce((sum, p) => sum + (p.price ?? 0), 0)
  const pieceDeposit = depositForRental(piecesTotal)
  const piecesLaundry = pricedPieces.filter((p) => selectedPieces.has(p.id)).reduce((sum, p) => sum + p.laundryFee, 0)

  const rentalPrice = pieceMode ? piecesTotal : (variant?.packagePrice ?? 0)
  const depositAmount = pieceMode ? pieceDeposit.amount : (variant?.depositAmount ?? 0)
  const laundryFee = pieceMode ? piecesLaundry : (variant?.laundryFee ?? 0)
  const grandTotal = variant ? rentalPrice + depositAmount + laundryFee + settings.shippingFlatRate : 0

  function togglePiece(id: string) {
    setSelectedPieces((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // โหมดแยกชิ้นต้องเลือกอย่างน้อย 1 ชิ้น
  const bookingBlocked = !selectedDate || (pieceMode && selectedPieces.size === 0)

  return (
    <CustomerLayout>
      <Link
        href="/costumes"
        className="mb-4 inline-flex items-center gap-1 text-base font-medium text-[#263544]/60 hover:text-[#263544]"
      >
        <ArrowLeftIcon size={16} />
        กลับไปหน้าสำรวจชุด
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        {/* ------------- รูป: จอใหญ่ติดหน้าจอไว้ขณะเลื่อนอ่านข้อมูลด้านขวา ------------- */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col-reverse gap-3 lg:flex-row">
            {detail.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[calc(100vh-9rem)] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0">
                {detail.images.map((url, i) => (
                  <button
                    key={url + i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`รูปที่ ${i + 1}`}
                    className={`h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      i === activeImage ? 'border-[#E5457F]' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {/* สูงไม่เกินหน้าจอ เพื่อให้เห็นรูปทั้งรูปตอนติดอยู่ (ถ้าจอเตี้ยจะครอปบน-ล่างเล็กน้อย) */}
            <div className="aspect-[3/4] w-full overflow-hidden rounded-3xl border-2 border-[#263544] bg-[#FDE3EE] lg:max-h-[calc(100vh-9rem)]">
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
          </div>
        </div>

        {/* ---------- ข้อมูลทั้งหมด: รู้จักชุด → ได้อะไร → ไซส์ → วัน → สรุปยอด → รายละเอียด → รีวิว ---------- */}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {detail.costumeCategory && (
              <span className="rounded-full bg-[#FFF3B0] px-3 py-1 text-sm font-semibold text-[#7A5A00]">
                {CATEGORY_LABEL[detail.costumeCategory] ?? detail.costumeCategory}
              </span>
            )}
            {detail.franchiseType && (
              <span className="rounded-full bg-[#FDE3EE] px-3 py-1 text-sm font-semibold text-[#B8285D]">
                {FRANCHISE_LABEL[detail.franchiseType] ?? detail.franchiseType}
              </span>
            )}
            {detail.genderTag && (
              <span className="rounded-full bg-[#EDE6FA] px-3 py-1 text-sm font-semibold text-[#5B3FA8]">
                {GENDER_LABEL[detail.genderTag] ?? detail.genderTag}
              </span>
            )}
            {detail.crossplayFriendly && (
              <span className="rounded-full bg-[#FFF3B0] px-3 py-1 text-sm font-semibold text-[#263544]">
                เหมาะกับ Crossplay
              </span>
            )}
            {detail.isGroupSet && (
              <span className="rounded-full bg-[#FFF3B0] px-3 py-1 text-sm font-semibold text-[#263544]">
                ชุดธีมกลุ่ม/คู่
              </span>
            )}
          </div>

          {detail.seriesName && <p className="mt-4 text-base text-[#263544]/50">{detail.seriesName}</p>}
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-3xl font-extrabold leading-tight text-[#263544]">{detail.name}</h1>
            <FavoriteButton productId={detail.id} size="lg" />
          </div>
          {detail.characterName && <p className="mt-1 text-[#263544]/60">ตัวละคร: {detail.characterName}</p>}
          {rating && rating.reviewCount > 0 && (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-base text-[#263544] hover:text-[#E5457F]">
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
              {customerHeldDays((variant ?? detail.variants[0]).packageDays)} วัน
            </p>
          )}

          {/* สิ่งที่ได้รับ — ให้รู้ก่อนเลือกไซส์/วันว่าชุดนี้ครบแค่ไหน (กดรูปเพื่อดูขนาดใหญ่) */}
          {detail.inclusions.length > 0 && (
            <section className="mt-6 rounded-2xl bg-[#F7F7F8] p-4">
              <h2 className="mb-3 text-base font-bold text-[#263544]">สิ่งที่ได้รับในชุดนี้</h2>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {detail.inclusions.map((inc) => (
                  <li key={inc.id}>
                    {inc.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreviewInclusion({ url: inc.imageUrl!, name: inc.name })}
                        aria-label={`ดูรูป ${inc.name}`}
                        className="group block w-full text-left"
                      >
                        <span className="relative block aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-[#263544]/10 transition group-hover:-translate-y-1 group-hover:ring-2 group-hover:ring-[#263544]">
                          <img
                            src={inc.imageUrl}
                            alt=""
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#263544] opacity-0 shadow transition group-hover:opacity-100">
                            <MagnifyingGlassPlusIcon size={16} weight="bold" />
                          </span>
                        </span>
                        <span className="mt-1.5 block text-sm font-medium leading-snug text-[#263544]">{inc.name}</span>
                      </button>
                    ) : (
                      <div>
                        <span className="flex aspect-square items-center justify-center rounded-xl bg-white text-[#E5457F] ring-1 ring-[#263544]/10">
                          <CheckCircleIcon size={32} weight="fill" />
                        </span>
                        <span className="mt-1.5 block text-sm font-medium leading-snug text-[#263544]">{inc.name}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ขั้นที่ 1: ไซส์ */}
          <section className="mt-6">
            <p className="mb-2 text-base font-semibold text-[#263544]">1. เลือกไซส์</p>
            {detail.variants.length === 0 ? (
              <p className="text-base text-[#263544]/50">ชุดนี้ยังไม่ได้ตั้งไซส์และราคา</p>
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
                      className={`min-w-[64px] rounded-xl px-4 py-2 text-base font-bold disabled:cursor-not-allowed ${
                        active
                          ? 'pop bg-[#E5457F] text-white'
                          : soldOut
                            ? 'border-2 border-gray-200 bg-gray-50 text-gray-300 line-through'
                            : 'pop bg-white text-[#263544]'
                      }`}
                    >
                      {v.size}
                    </button>
                  )
                })}
              </div>
            )}
            {variant && (
              <p className="mt-2 text-base text-[#263544]/60">
                ค่าเช่า {formatBaht(variant.packagePrice)} · เช่า {customerHeldDays(variant.packageDays)} วัน
                นับจากวันใช้งานถึงวันส่งคืน
              </p>
            )}

            {/* ตารางไซส์อยู่ติดกับปุ่มไซส์ ดูประกอบตอนเลือกได้ทันที */}
            {hasSizeChart && (
              <details className="group mt-3 rounded-2xl border border-[#263544]/15 bg-white" open>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-base font-semibold text-[#263544]">
                  <RulerIcon size={18} />
                  ตารางไซส์ (นิ้ว)
                  <CaretDownIcon size={14} className="ml-auto transition group-open:rotate-180" />
                </summary>
                <div className="overflow-x-auto px-4 pb-4">
                  <table className="w-full min-w-[480px] text-center text-base">
                    <thead className="bg-[#FDE3EE] text-[#263544]">
                      <tr>
                        <th className="rounded-l-lg px-2 py-2">ไซส์</th>
                        <th className="px-2 py-2">รอบอก</th>
                        <th className="px-2 py-2">รอบเอว</th>
                        <th className="px-2 py-2">รอบสะโพก</th>
                        <th className="px-2 py-2">ความยาว</th>
                        <th className="rounded-r-lg px-2 py-2">ส่วนสูง (ซม.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[#263544]/80">
                      {detail.variants
                        .filter((v) => v.chart)
                        .map((v) => (
                          <tr key={v.id} className={v.id === variantId ? 'bg-[#FFFAFC] font-semibold' : ''}>
                            <td className="px-2 py-2 font-bold text-[#263544]">{v.size}</td>
                            <td className="px-2 py-2">{v.chart?.chestIn ?? '—'}</td>
                            <td className="px-2 py-2">{v.chart?.waistIn ?? '—'}</td>
                            <td className="px-2 py-2">{v.chart?.hipIn ?? '—'}</td>
                            <td className="px-2 py-2">{v.chart?.lengthIn ?? '—'}</td>
                            <td className="px-2 py-2">
                              {v.chart?.heightMin || v.chart?.heightMax
                                ? `${v.chart?.heightMin ?? '?'}–${v.chart?.heightMax ?? '?'}`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </section>

          {/* ขั้นที่ 2: วันใช้งาน */}
          {variant && (
            <section className="mt-6">
              <p className="mb-1 text-base font-semibold text-[#263544]">2. เลือกวันที่จะใส่ชุด</p>
              <p className="mb-3 text-base text-[#263544]/60">
                จองล่วงหน้าอย่างน้อย {settings.minLeadDays} วัน · วันที่ขีดฆ่าคือวันที่ชุดไซส์นี้ไม่ว่าง
              </p>
              {datesError ? (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-600">{datesError}</p>
              ) : (
                <BookingCalendar
                  unavailable={unavailable}
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  daysAhead={DAYS_AHEAD}
                  loading={datesLoading}
                  getTimeline={getTimeline}
                  events={events}
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
                  <p className="col-span-3 text-sm text-[#263544]/60">
                    เช่า {customerHeldDays(variant.packageDays)} วัน (วันใช้งานถึงวันส่งคืน) · วันที่ชุดถึงมือคุณไม่นับเป็นวันเช่า
                  </p>
                </div>
              ) : (
                <p className="mb-4 rounded-xl bg-[#F7F7F8] px-4 py-2.5 text-center text-base text-[#263544]/75">
                  เลือกวันที่จะใส่ชุดในปฏิทิน เพื่อดูวันรับและวันคืนชุด
                </p>
              )}

              {canSplit && (
                <div className="mb-4 border-b border-[#263544]/10 pb-4">
                  <p className="mb-2 text-base font-semibold text-[#263544]">รูปแบบการเช่า</p>
                  <div role="radiogroup" aria-label="รูปแบบการเช่า" className="grid grid-cols-2 gap-1 rounded-xl border-2 border-[#263544] bg-white p-1">
                    {(
                      [
                        ['set', 'เช่าทั้งชุด'],
                        ['pieces', 'เลือกเช่าแยกชิ้น'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={rentMode === mode}
                        onClick={() => setRentMode(mode)}
                        className={`rounded-lg py-2.5 text-base font-semibold transition ${
                          rentMode === mode ? 'bg-[#E5457F] text-white' : 'text-[#263544]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {pieceMode && (
                    <>
                      <ul className="mt-4 space-y-1">
                        {pricedPieces.map((p) => (
                          <li key={p.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-base text-[#263544]">
                              <input
                                type="checkbox"
                                checked={selectedPieces.has(p.id)}
                                onChange={() => togglePiece(p.id)}
                                className="h-5 w-5 shrink-0 accent-[#E5457F]"
                              />
                              <span className="flex-1 font-medium">
                                {p.name}
                                {p.laundryFee > 0 && (
                                  <span className="block text-sm font-normal text-[#263544]/50">
                                    ค่าซักรีด {formatBaht(p.laundryFee)}
                                  </span>
                                )}
                              </span>
                              <span className="tabular-nums text-[#263544]/70">{formatBaht(p.price)}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <dl className="space-y-1.5 text-base">
                {pieceMode ? (
                  <>
                    <PriceRow label={`ยอดรวมค่าเช่า (${selectedPieces.size} ชิ้น)`} value={piecesTotal} />
                    <PriceRow label="ค่ามัดจำ" value={pieceDeposit.amount} />
                    {piecesLaundry > 0 && <PriceRow label="ค่าซักรีด" value={piecesLaundry} />}
                  </>
                ) : (
                  <>
                    <PriceRow label="ค่าเช่าชุด" value={variant.packagePrice} />
                    <PriceRow label="ค่ามัดจำ (ได้คืนหลังตรวจชุด)" value={variant.depositAmount} />
                    {variant.laundryFee > 0 && <PriceRow label="ค่าซักรีด" value={variant.laundryFee} />}
                  </>
                )}
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
                  disabled={bookingBlocked}
                  className="pop flex items-center justify-center gap-2 rounded-full bg-white py-3 text-base font-bold text-[#263544] disabled:opacity-40"
                >
                  <ShoppingCartSimpleIcon size={18} weight="bold" />
                  เพิ่มลงตะกร้า
                </button>
                <button
                  type="button"
                  onClick={handleRent}
                  disabled={bookingBlocked}
                  className="pop rounded-full bg-[#E5457F] py-3 text-base font-bold text-white disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {!selectedDate ? 'เลือกวันใช้งานก่อน' : pieceMode && selectedPieces.size === 0 ? 'เลือกชิ้นก่อน' : 'เช่าเลย'}
                </button>
              </div>
              <p className="mt-2 text-center text-base text-[#263544]/50">
                มัดจำคืนภายใน {variant.depositReturnHours} ชม. หลังร้านได้รับชุดคืนและตรวจสภาพเรียบร้อย
              </p>
            </section>
          )}
        </div>
      </div>

      {/* รีวิวแยกเป็น section เต็มความกว้างใต้ส่วนจอง */}
      <ProductReviews productId={detail.id} />

      {/* ดูรูปสิ่งที่ได้รับแบบขยาย */}
      {previewInclusion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewInclusion.name}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#263544]/80 p-4"
          onClick={() => setPreviewInclusion(null)}
        >
          <figure className="relative max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewInclusion(null)}
              aria-label="ปิด"
              autoFocus
              className="pop absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#263544]"
            >
              <XIcon size={20} weight="bold" />
            </button>
            <img
              src={previewInclusion.url}
              alt={previewInclusion.name}
              className="max-h-[80vh] w-auto rounded-2xl border-2 border-white object-contain"
            />
            <figcaption className="mt-3 text-center text-base font-semibold text-white">{previewInclusion.name}</figcaption>
          </figure>
        </div>
      )}
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
      <p className={`mt-1 text-sm ${highlight ? 'text-white/80' : 'text-[#263544]/60'}`}>{label}</p>
      <p className="text-base font-bold">{date}</p>
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
