'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ArrowUUpLeftIcon,
  CaretDownIcon,
  CheckCircleIcon,
  ImageIcon,
  MagnifyingGlassPlusIcon,
  MinusIcon,
  PackageIcon,
  PlusIcon,
  RulerIcon,
  ShoppingCartSimpleIcon,
  StarIcon,
  XIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import BookingCalendar, { type SizeBooking } from '@/app/components/customer/BookingCalendar'
import { sortSizes } from '@/utils/sizeStock'
import FavoriteButton from '@/app/components/customer/FavoriteButton'
import MeasureGuideButton from '@/app/components/customer/MeasureGuide'
import ProductReviews from '@/app/components/customer/ProductReviews'
import { StarDisplay } from '@/app/components/customer/StarRating'
import { fetchRatingSummaries, type RatingSummary } from '@/utils/customer/reviews'
import { addToCart, encodeCheckoutItems } from '@/utils/customer/cart'
import { loginHref } from '@/utils/customer/authUser'
import { COLOR_HEX, colorKeysOf } from '@/utils/customer/filterOptions'
import { formatRange } from '@/utils/sizeDefaults'
import { fetchCostumeDetail, type CostumeDetail } from '@/utils/customer/fetchCostumeDetail'
import {
  DEFAULT_BOOKING_SETTINGS,
  clampRentalDays,
  fetchBookingSettings,
  getRentalTimeline,
  minStartOffset,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'
import { CATEGORY_LABEL, FRANCHISE_LABEL, GENDER_LABEL } from '@/utils/customer/labels'
import { fetchEvents, type CalendarEvent } from '@/utils/customer/events'
import { addDays, formatBaht, formatThaiDateWithWeekday, todayISO } from '@/utils/dateUtils'
import { depositForRental } from '@/utils/customer/pricing'
import { calcRentalPrice } from '@/utils/customer/rentalPrice'
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  // จำนวนวันเช่า: rentalDays เปลี่ยนทันทีตามปุ่ม · queryDays ตามหลัง 300ms ใช้ยิง RPC (กดรัว ๆ ไม่ยิงทุกครั้ง)
  const [rentalDays, setRentalDays] = useState(1)
  const [queryDays, setQueryDays] = useState(1)
  // วันเริ่มเช่าไม่ได้ ตาม (ไซส์, จำนวนวัน) — เก็บไว้ทุกค่าที่เคยโหลด สลับกลับไปมาไม่ต้องโหลดซ้ำ · 'error' = โหลดไม่สำเร็จ
  const [unavailableCache, setUnavailableCache] = useState<Map<string, Set<string> | 'error'>>(new Map())
  // วันที่ถูกจองจริงของทุกไซส์ (variant id → วันที่) — ไม่ขึ้นกับจำนวนวัน โหลดครั้งเดียวต่อชุด
  const [occupiedByVariant, setOccupiedByVariant] = useState<Map<string, Set<string>>>(new Map())
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
      setRentalDays(s.minRentalDays)
      setQueryDays(s.minRentalDays)
      if (res.error || !res.data) {
        setLoadError(res.error ?? 'ไม่พบชุดนี้')
      } else {
        setDetail(res.data)
        // เลือกไซส์แรกที่ยังมีชุดพร้อมให้เช่าไว้ให้ก่อน ลดขั้นตอนลูกค้า
        // ไม่มีไซส์ไหนพร้อมเลย (เช่น ชุดไซส์เดียวที่เพิ่งคืนมาและอยู่ระหว่างซัก/ซ่อม) ก็ยังเลือกไซส์แรก ให้ปฏิทินแสดงวันที่ไม่ว่างตามเดิม
        const firstAvailable = res.data.variants.find((v) => v.availableUnits > 0) ?? res.data.variants[0]
        setVariantId(firstAvailable?.id ?? null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    const t = setTimeout(() => setQueryDays(rentalDays), 300)
    return () => clearTimeout(t)
  }, [rentalDays])

  // วันเริ่มเช่าไม่ได้ของ (ไซส์, จำนวนวัน) ที่เลือก · ผลของคำขอเก่าที่ตอบช้าก็เก็บลง cache ตาม key ของมันเอง ไม่ทับค่าปัจจุบัน
  const cacheKey = variantId ? `${variantId}:${queryDays}` : null
  const inflight = useRef(new Set<string>())
  useEffect(() => {
    const key = `${variantId}:${queryDays}`
    if (!variantId || unavailableCache.has(key) || inflight.current.has(key)) return
    const supabase = createClient()
    if (!supabase) return
    inflight.current.add(key)
    supabase
      .rpc('get_unavailable_start_dates', { p_variant_id: variantId, p_days_ahead: DAYS_AHEAD, p_rental_days: queryDays })
      .then(({ data, error }) => {
        const value = error ? ('error' as const) : new Set(((data ?? []) as string[]).map((d) => String(d).slice(0, 10)))
        inflight.current.delete(key)
        setUnavailableCache((prev) => new Map(prev).set(key, value))
      })
  }, [variantId, queryDays, unavailableCache])

  // วันที่ถูกจองจริงของทุกไซส์ ครั้งเดียวต่อชุด · ไซส์ไหนโหลดไม่สำเร็จก็แค่ไม่แสดงพื้นเทา/ป้ายไซส์นั้น ปฏิทินยังใช้ได้
  useEffect(() => {
    const supabase = createClient()
    const variantIds = detail?.variants.map((v) => v.id) ?? []
    if (!supabase || variantIds.length === 0) return

    let cancelled = false
    Promise.all(
      variantIds.map((id) =>
        supabase
          .rpc('get_occupied_dates', { p_variant_id: id, p_days_ahead: DAYS_AHEAD })
          .then(({ data, error }) => [id, error ? null : ((data ?? []) as string[])] as const),
      ),
    ).then((rows) => {
      if (cancelled) return
      const map = new Map<string, Set<string>>()
      for (const [id, dates] of rows) if (dates) map.set(id, new Set(dates.map((d) => String(d).slice(0, 10))))
      setOccupiedByVariant(map)
    })
    return () => {
      cancelled = true
    }
  }, [detail])

  const sizeBookings = useMemo<SizeBooking[]>(
    () =>
      sortSizes(detail?.variants ?? [])
        .filter((v) => occupiedByVariant.has(v.id))
        .map((v) => ({ size: v.size, occupied: occupiedByVariant.get(v.id)! })),
    [detail, occupiedByVariant],
  )

  const variant = useMemo(
    () => detail?.variants.find((v) => v.id === variantId) ?? null,
    [detail, variantId],
  )

  const cached = cacheKey ? unavailableCache.get(cacheKey) : undefined
  const datesError = cached === 'error' ? 'โหลดปฏิทินไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง' : null
  // ระหว่างรอ debounce หรือรอ RPC ถือว่ายังโหลดอยู่ — ห้ามใช้ผลของจำนวนวันเดิมตัดสินวันที่เลือก
  const datesLoading = !!variantId && (rentalDays !== queryDays || cached === undefined)
  const unavailable = useMemo(() => (cached instanceof Set ? cached : new Set<string>()), [cached])
  const occupied = useMemo(() => (variantId && occupiedByVariant.get(variantId)) || new Set<string>(), [variantId, occupiedByVariant])

  // เปลี่ยนจำนวนวันแล้ววันใส่ที่เลือกไว้ใช้ไม่ได้ → ไม่นับว่าเลือกไว้ และบอกลูกค้าให้เลือกใหม่
  // (ไม่ลบ state ทิ้ง ถ้าเปลี่ยนจำนวนวันกลับ วันเดิมจะกลับมาเป็นที่เลือก)
  const lastStart = addDays(todayISO(), DAYS_AHEAD - (rentalDays - 1))
  const selectedInvalid =
    !!selectedDate && !datesLoading && (unavailable.has(selectedDate) || selectedDate > lastStart)
  const activeDate = selectedInvalid ? null : selectedDate

  const getTimeline = useCallback(
    (useDate: string) => getRentalTimeline(useDate, rentalDays, settings),
    [rentalDays, settings],
  )

  const timeline = useMemo(
    () => (variant && activeDate ? getTimeline(activeDate) : null),
    [variant, activeDate, getTimeline],
  )

  function selectVariant(id: string) {
    if (id === variantId) return
    setVariantId(id)
    setSelectedDate(null)
  }

  function changeDays(next: number) {
    setRentalDays(clampRentalDays(next, settings))
  }

  const hasSizeChart = detail?.variants.some((v) => v.chart) ?? false
  const isShoes = detail?.sizeSystem === 'shoes'

  // ราคาต่างกันตามไซส์ไหม → ถ้าต่าง แสดงราคาใต้ปุ่มไซส์และในตารางไซส์ ถ้าเท่ากันไม่ต้องแสดงซ้ำ
  const variantPrices = detail?.variants.map((v) => v.packagePrice) ?? []
  const minPrice = variantPrices.length ? Math.min(...variantPrices) : 0
  const maxPrice = variantPrices.length ? Math.max(...variantPrices) : 0
  const pricesVary = minPrice !== maxPrice

  // โหมดแยกชิ้น → ส่ง id ชิ้นที่เลือกไปด้วย (ราคาจริงคำนวณใหม่ในฐานข้อมูลตอนจอง)
  const chosenPieces = (): string[] | undefined =>
    rentMode === 'pieces' && selectedPieces.size > 0 ? Array.from(selectedPieces) : undefined

  function handleRent() {
    if (!variant || !activeDate) return
    router.push(
      `/checkout?items=${encodeCheckoutItems([
        { variantId: variant.id, startDate: activeDate, rentalDays, pieces: chosenPieces()?.sort() },
      ])}`,
    )
  }

  function handleAddToCart() {
    if (!variant || !activeDate) return
    // ยังไม่ล็อกอิน → ไปเข้าสู่ระบบก่อน แล้วกลับมาหน้านี้
    if (addToCart(variant.id, activeDate, rentalDays, chosenPieces()) === 'login') {
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

  // ค่าเช่า = วันแรก + วันเพิ่ม (มัดจำคิดจากราคาวันแรก ไม่ขึ้นตามจำนวนวัน)
  const price = calcRentalPrice({
    baseRental: pieceMode ? piecesTotal : (variant?.packagePrice ?? 0),
    rentalDays,
    isPieces: pieceMode,
    settings,
  })
  const depositAmount = pieceMode ? pieceDeposit.amount : (variant?.depositAmount ?? 0)
  const laundryFee = pieceMode ? piecesLaundry : (variant?.laundryFee ?? 0)
  const grandTotal = variant ? price.rentalPrice + depositAmount + laundryFee + settings.shippingFlatRate : 0
  const noPiecesYet = pieceMode && selectedPieces.size === 0

  function togglePiece(id: string) {
    setSelectedPieces((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // โหมดแยกชิ้นต้องเลือกอย่างน้อย 1 ชิ้น
  const bookingBlocked = !activeDate || noPiecesYet

  return (
    <CustomerLayout>
      {/* design v2 (design-system.md): เส้น 1px · เงาแข็งเฉพาะตอน hover (.lift) · สถานะที่เลือกพื้น brand-soft */}
      <div className="theme-v2">
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
                    className={`focus-ring h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl border transition ${
                      i === activeImage ? 'border-line ring-2 ring-brand-soft' : 'border-line-subtle opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {/* สูงไม่เกินหน้าจอ เพื่อให้เห็นรูปทั้งรูปตอนติดอยู่ (ถ้าจอเตี้ยจะครอปบน-ล่างเล็กน้อย) */}
            <div className="aspect-[3/4] w-full overflow-hidden rounded-3xl border border-line bg-[#FDE3EE] lg:max-h-[calc(100vh-9rem)]">
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
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-base text-[#263544]">
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
          {detail.variants.length > 0 &&
            (variant ? (
              <div className="mt-3">
                <p className="text-2xl font-bold text-brand">เริ่มต้น {formatBaht(variant.packagePrice)}</p>
                <p className="mt-0.5 text-base text-[#263544]/60">
                  ราคาเช่า 1 วัน · วันถัดไป +{formatBaht(settings.extraDayRate)}/วัน
                  {/* บอกชัดว่าราคานี้เป็นของไซส์ไหน — ลูกค้าจะไม่เข้าใจผิดว่าทุกไซส์ราคาเดียวกัน */}
                  {pricesVary && (
                    <>
                      {' '}
                      · ราคาไซส์ {variant.size} (ไซส์อื่น {formatBaht(minPrice)}–{formatBaht(maxPrice)})
                    </>
                  )}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-2xl font-bold text-brand">เริ่มต้น {formatBaht(minPrice)}</p>
            ))}

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
                        className="focus-ring group block w-full rounded-xl text-left"
                      >
                        {/* hover แบบเดียวกับ .lift: ยกซ้ายบน + เงาแข็ง (ยกจากปุ่มแม่ด้วย group) */}
                        <span className="relative block aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-line-subtle transition group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_0_var(--color-ink)] group-hover:ring-line motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0">
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
                        <span className="flex aspect-square items-center justify-center rounded-xl bg-white text-[#E5457F] ring-1 ring-line-subtle">
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
            {/* ปุ่มวิธีวัดตัวอยู่บรรทัดเดียวกับหัวข้อ — เห็นได้แม้ชุดยังไม่มีตารางไซส์ */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-base font-semibold text-[#263544]">1. เลือกไซส์</p>
              {detail.variants.length > 0 && <MeasureGuideButton kind={isShoes ? 'shoes' : 'clothing'} />}
            </div>
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
                      // ไซส์ที่ไม่พร้อมตอนนี้ยังกดดูปฏิทินได้ — การจองถูกกันด้วยวันที่ไม่ว่างในปฏิทินอยู่แล้ว
                      onClick={() => selectVariant(v.id)}
                      aria-pressed={active}
                      aria-label={`ไซส์ ${v.size} ค่าเช่า ${formatBaht(v.packagePrice)}${soldOut ? ' (หมด)' : ''}`}
                      // ไซส์ที่เลือก = พื้น brand ตัวขาว (เด่นกว่า brand-soft เพราะเป็นตัวเลือกหลักของการจอง) · ยังไม่เลือก = ปุ่มรอง .lift · หมด = เส้นจาง
                      className={`focus-ring flex min-w-[64px] flex-col items-center rounded-xl border px-4 py-2 ${
                        active
                          ? 'border-line bg-brand text-white'
                          : soldOut
                            ? 'border-line-subtle bg-canvas text-muted'
                            : 'lift border-line bg-white text-ink'
                      }`}
                    >
                      <span className={`text-base font-bold ${soldOut && !active ? 'line-through' : ''}`}>{v.size}</span>
                      {pricesVary && (
                        <span
                          className={`text-sm tabular-nums ${active ? 'font-semibold text-white' : soldOut ? '' : 'text-secondary'}`}
                        >
                          {soldOut ? 'หมด' : formatBaht(v.packagePrice)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            {variant && (
              <p className="mt-2 text-base text-[#263544]/60">
                ไซส์ {variant.size}: ค่าเช่าวันแรก {formatBaht(variant.packagePrice)} · มัดจำ{' '}
                {formatBaht(variant.depositAmount)} (ได้คืน)
              </p>
            )}

            {/* ตารางไซส์อยู่ติดกับปุ่มไซส์ ดูประกอบตอนเลือกได้ทันที — ตัวเลขเป็นช่วงสัดส่วนร่างกายที่ใส่ได้ */}
            {hasSizeChart && (
              <details className="group mt-3 rounded-card border border-line bg-white" open>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-base font-semibold text-[#263544]">
                  <RulerIcon size={18} />
                  {isShoes ? 'ตารางไซส์รองเท้า (ซม.)' : 'ตารางไซส์ (นิ้ว)'}
                  <CaretDownIcon size={14} className="ml-auto transition group-open:rotate-180" />
                </summary>
                <div className="overflow-x-auto px-4 pb-4">
                  <p className="mb-2 text-sm text-[#5B6472]">
                    {isShoes
                      ? 'วัดความยาวเท้าจากส้นถึงปลายนิ้วที่ยาวที่สุด แล้วเลือกไซส์ที่ช่วงครอบความยาวเท้าคุณ'
                      : 'ตัวเลขคือสัดส่วนร่างกายที่ใส่ได้ ถ้าสัดส่วนคุณอยู่ระหว่างสองไซส์ เลือกไซส์ใหญ่กว่าจะสบายกว่า'}
                  </p>
                  <table className={`w-full text-center text-base ${isShoes ? 'min-w-[280px]' : 'min-w-[480px]'}`}>
                    <thead className="bg-[#FDE3EE] text-[#263544]">
                      <tr>
                        <th className="rounded-l-lg px-2 py-2">ไซส์</th>
                        {isShoes ? (
                          <th className={`px-2 py-2 ${pricesVary ? '' : 'rounded-r-lg'}`}>ความยาวเท้า</th>
                        ) : (
                          <>
                            <th className="px-2 py-2">รอบอก</th>
                            <th className="px-2 py-2">รอบเอว</th>
                            <th className="px-2 py-2">รอบสะโพก</th>
                            <th className="px-2 py-2">ความยาว</th>
                            <th className={`px-2 py-2 ${pricesVary ? '' : 'rounded-r-lg'}`}>ส่วนสูง (ซม.)</th>
                          </>
                        )}
                        {pricesVary && <th className="rounded-r-lg px-2 py-2">ค่าเช่าวันแรก</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-subtle tabular-nums text-[#263544]/80">
                      {detail.variants
                        .filter((v) => v.chart)
                        .map((v) => (
                          <tr key={v.id} className={v.id === variantId ? 'bg-[#FFFAFC] font-semibold' : ''}>
                            <td className="px-2 py-2 font-bold text-[#263544]">{v.size}</td>
                            {isShoes ? (
                              <td className="px-2 py-2">{formatRange(v.chart?.footMinCm ?? null, v.chart?.footMaxCm ?? null) ?? '—'}</td>
                            ) : (
                              <>
                                <td className="px-2 py-2">{formatRange(v.chart?.chestIn ?? null, v.chart?.chestMaxIn ?? null) ?? '—'}</td>
                                <td className="px-2 py-2">{formatRange(v.chart?.waistIn ?? null, v.chart?.waistMaxIn ?? null) ?? '—'}</td>
                                <td className="px-2 py-2">{formatRange(v.chart?.hipIn ?? null, v.chart?.hipMaxIn ?? null) ?? '—'}</td>
                                <td className="px-2 py-2">{v.chart?.lengthIn ?? '—'}</td>
                                <td className="px-2 py-2">
                                  {v.chart?.heightMin || v.chart?.heightMax
                                    ? `${v.chart?.heightMin ?? '?'}–${v.chart?.heightMax ?? '?'}`
                                    : '—'}
                                </td>
                              </>
                            )}
                            {pricesVary && (
                              <td className="px-2 py-2 tabular-nums">{formatBaht(v.packagePrice)}</td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </section>

          {/* ขั้นที่ 2: จำนวนวันเช่า — เลือกก่อนวันใส่ เพราะวันที่ว่างขึ้นกับจำนวนวัน */}
          {variant && (
            <section className="mt-6">
              <p className="mb-2 text-base font-semibold text-[#263544]">2. เช่ากี่วัน</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center rounded-full border border-line bg-white">
                  <button
                    type="button"
                    onClick={() => changeDays(rentalDays - 1)}
                    disabled={rentalDays <= settings.minRentalDays}
                    aria-label="ลดจำนวนวัน"
                    className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <MinusIcon size={18} weight="bold" />
                  </button>
                  <output aria-live="polite" className="min-w-[4.5rem] text-center text-lg font-bold tabular-nums text-ink">
                    {rentalDays} วัน
                  </output>
                  <button
                    type="button"
                    onClick={() => changeDays(rentalDays + 1)}
                    disabled={rentalDays >= settings.maxRentalDays}
                    aria-label="เพิ่มจำนวนวัน"
                    className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <PlusIcon size={18} weight="bold" />
                  </button>
                </div>
                <p className="text-base text-[#263544]/70">
                  {noPiecesYet ? (
                    'เลือกชิ้นที่จะเช่าด้านล่าง เพื่อดูค่าเช่า'
                  ) : rentalDays === 1 ? (
                    <>
                      ค่าเช่า 1 วัน <b className="text-ink">{formatBaht(price.rentalPrice)}</b> · วันถัดไป +
                      {formatBaht(price.dayRate)}/วัน
                    </>
                  ) : (
                    <>
                      วันแรก {formatBaht(price.baseRental)} + เพิ่ม {rentalDays - 1} วัน × {formatBaht(price.dayRate)} ={' '}
                      <b className="text-ink">{formatBaht(price.rentalPrice)}</b>
                    </>
                  )}
                </p>
              </div>
              <p className="mt-1.5 text-sm text-[#263544]/60">
                นับจากวันใส่ถึงวันส่งคืน เช่าได้ {settings.minRentalDays}–{settings.maxRentalDays} วัน
              </p>
            </section>
          )}

          {/* ขั้นที่ 3: วันใช้งาน */}
          {variant && (
            <section className="mt-6">
              <p className="mb-1 text-base font-semibold text-[#263544]">3. เลือกวันที่จะใส่ชุด</p>
              <p className="mb-3 text-base text-[#263544]/60">
                จองล่วงหน้าอย่างน้อย {settings.minLeadDays} วัน · วันที่ขีดฆ่าคือวันที่เริ่มเช่า {rentalDays} วันไม่ได้
              </p>
              {selectedInvalid && (
                <p role="status" className="mb-3 rounded-xl bg-[#FFF3B0] px-4 py-2.5 text-base text-[#263544]">
                  ช่วงวันนี้ไม่ว่างสำหรับการเช่า {rentalDays} วัน กรุณาเลือกวันใหม่
                </p>
              )}
              {datesError ? (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-600">{datesError}</p>
              ) : (
                <BookingCalendar
                  unavailable={unavailable}
                  occupied={occupied}
                  selected={activeDate}
                  onSelect={setSelectedDate}
                  daysAhead={DAYS_AHEAD}
                  loading={datesLoading}
                  rentalDays={rentalDays}
                  getTimeline={getTimeline}
                  events={events}
                  minStartOffset={minStartOffset(settings)}
                  sizeBookings={sizeBookings}
                />
              )}
            </section>
          )}

          {/* สรุปช่วงเช่า + ราคา */}
          {variant && (
            <section className="mt-6 rounded-card border border-line bg-white p-5">
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
                    เช่า {rentalDays} วัน (วันใช้งานถึงวันส่งคืน) · วันที่ชุดถึงมือคุณไม่นับเป็นวันเช่า
                  </p>
                </div>
              ) : (
                <p className="mb-4 rounded-xl bg-[#F7F7F8] px-4 py-2.5 text-center text-base text-[#263544]/75">
                  เลือกวันที่จะใส่ชุดในปฏิทิน เพื่อดูวันรับและวันคืนชุด
                </p>
              )}

              {canSplit && (
                <div className="mb-4 border-b border-line-subtle pb-4">
                  <p className="mb-2 text-base font-semibold text-[#263544]">รูปแบบการเช่า</p>
                  <div role="radiogroup" aria-label="รูปแบบการเช่า" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-white p-1">
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
                        className={`focus-ring rounded-lg py-2.5 text-base transition ${
                          rentMode === mode ? 'bg-brand-soft font-bold text-ink' : 'font-semibold text-ink hover:bg-sunken'
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
                <PriceRow
                  label={pieceMode ? `ค่าเช่าวันแรก (${selectedPieces.size} ชิ้น)` : 'ค่าเช่าชุดวันแรก'}
                  value={price.baseRental}
                />
                {rentalDays > 1 && (
                  <PriceRow
                    label={`ค่าเช่าเพิ่ม ${rentalDays - 1} วัน × ${formatBaht(price.dayRate)}`}
                    value={price.extraFee}
                  />
                )}
                <PriceRow label="ค่ามัดจำ (ได้คืนหลังตรวจชุด)" value={depositAmount} />
                {laundryFee > 0 && <PriceRow label="ค่าซักรีด" value={laundryFee} />}
                <PriceRow label="ค่าจัดส่ง" value={settings.shippingFlatRate} />
                <div className="flex items-center justify-between border-t border-dashed border-line-subtle pt-2">
                  <dt className="font-bold text-[#263544]">ยอดชำระทั้งหมด</dt>
                  <dd className="text-xl font-extrabold text-brand">{formatBaht(grandTotal)}</dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={bookingBlocked}
                  className="lift focus-ring flex items-center justify-center gap-2 rounded-full border border-line bg-white py-3 text-base font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ShoppingCartSimpleIcon size={18} weight="bold" />
                  เพิ่มลงตะกร้า
                </button>
                <button
                  type="button"
                  onClick={handleRent}
                  disabled={bookingBlocked}
                  className="lift focus-ring rounded-full border border-line bg-brand py-3 text-base font-bold text-white active:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {!activeDate ? 'เลือกวันใช้งานก่อน' : noPiecesYet ? 'เลือกชิ้นก่อน' : 'เช่าเลย'}
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
              className="lift focus-ring absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink"
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