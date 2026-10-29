'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ImageIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import EmptyState from '@/app/components/EmptyState'
import CostumeGridCard from '@/app/components/customer/CostumeGridCard'
import {
  MAX_ITEMS_PER_ORDER,
  cartKeyOf as keyOf,
  encodeCheckoutItems,
  parseDelivery,
  removeFromCart,
  setCartDelivery,
  useCart,
  type CartItem,
} from '@/utils/customer/cart'
import { fetchPieces, priceLine, type PieceInfo } from '@/utils/customer/pieces'
import { quoteLines, type LineQuote } from '@/utils/customer/deposits'
import {
  fetchUnavailableDates,
  fetchVariantSummaries,
  unavailableKey,
  type VariantSummary,
} from '@/utils/customer/fetchVariantSummaries'
import { fetchCatalog, type CatalogCostume } from '@/utils/customer/fetchCatalog'
import { useRequireLogin } from '@/utils/customer/authUser'
import {
  DEFAULT_BOOKING_SETTINGS,
  fetchBookingSettings,
  getRentalTimeline,
  minStartOffset,
  shippingFee,
  shippingFeeVaries,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'
import { addDays, formatBaht, formatThaiDateLong, todayISO } from '@/utils/dateUtils'

type ItemStatus = 'ok' | 'closed' | 'pieces_changed' | 'too_soon' | 'booked' | 'bad_days'

const STATUS_MESSAGE: Record<Exclude<ItemStatus, 'ok'>, string> = {
  closed: 'ชุดหรือไซส์นี้ปิดให้เช่าแล้ว',
  pieces_changed: 'ชิ้นหรือรองเท้าที่เลือกไม่เปิดให้เช่าแล้ว กรุณาเลือกใหม่',
  too_soon: 'วันที่เลือกกระชั้นเกินไปแล้ว กรุณาเลือกวันใหม่',
  booked: 'วันที่เลือกถูกจองไปแล้ว กรุณาเลือกวันใหม่',
  bad_days: 'จำนวนวันเช่านี้ไม่เปิดให้จองแล้ว กรุณาเลือกใหม่',
}

export default function CartPage() {
  const router = useRouter()
  const loggedIn = useRequireLogin()
  const { items: cart, delivery: cartDelivery, ready } = useCart()

  const [variants, setVariants] = useState<Record<string, VariantSummary>>({})
  const [unavailable, setUnavailable] = useState<Record<string, Set<string>>>({})
  const [pieces, setPieces] = useState<Record<string, PieceInfo>>({})
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [selectionReady, setSelectionReady] = useState(false)
  const [recommended, setRecommended] = useState<CatalogCostume[]>([])
  // ค่าเช่า/มัดจำตามชุดจริงตัวที่จะได้ (Step 25) ของรายการที่เลือก · ไม่มี = ใช้ราคาเริ่มต้นของไซส์
  const [quotes, setQuotes] = useState<Record<string, LineQuote | null>>({})

  // ร้านปิดรับเอง (ไม่มีข้อมูลร้าน) → ถือเป็นจัดส่ง แม้ตะกร้าเคยตั้งไว้เป็นรับเอง
  const delivery = settings.pickupLocation ? cartDelivery : 'ship'

  // โหลดใหม่เมื่อ (ไซส์, จำนวนวัน, วิธีรับ) ในตะกร้าเปลี่ยน — วันที่ว่างขึ้นกับทั้งจำนวนวันและวิธีรับ
  const requestKey = useMemo(
    () =>
      Array.from(new Set(cart.map((i) => unavailableKey(i.variantId, i.rentalDays, cartDelivery, i.shoeVariantId))))
        .sort()
        .join(','),
    [cart, cartDelivery],
  )

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const requests = (requestKey ? requestKey.split(',') : []).map((k) => {
      const [variantPart, days, method] = k.split(':')
      const [variantId, shoeVariantId] = variantPart.split('~')
      return { variantId, shoeVariantId: shoeVariantId || undefined, rentalDays: Number(days), delivery: parseDelivery(method) }
    })
    // ไซส์รองเท้าโหลดมาพร้อมไซส์ชุด เพื่อแสดงไซส์ และรู้ว่ารองเท้ายังเปิดให้เช่าอยู่ไหม
    const ids = requests.flatMap((r) => (r.shoeVariantId ? [r.variantId, r.shoeVariantId] : [r.variantId]))
    Promise.all([fetchVariantSummaries(ids), fetchUnavailableDates(requests), fetchBookingSettings()]).then(
      async ([v, u, s]) => {
        const p = await fetchPieces(Object.values(v.data).map((x) => x.productId))
        if (cancelled) return
        setVariants(v.data)
        setUnavailable(u)
        setPieces(p)
        setSettings(s)
        setLoading(false)
        // ร้านปิดรับเองแล้ว แต่ตะกร้ายังตั้งเป็นรับเอง → กลับเป็นจัดส่ง (โหลดวันว่างแบบจัดส่งใหม่เอง)
        if (!s.pickupLocation && requests.some((r) => r.delivery === 'pickup')) setCartDelivery('ship')
      },
    )
    return () => {
      cancelled = true
    }
  }, [ready, requestKey])

  const minStart = addDays(todayISO(), minStartOffset(settings, delivery))
  const priceOf = (v: VariantSummary, item: CartItem) =>
    priceLine(v, item.pieces, pieces, item.rentalDays, settings, item.shoeVariantId, quotes[keyOf(item)])

  function statusOf(item: CartItem): ItemStatus {
    const v = variants[item.variantId]
    if (!v) return 'closed'
    // รองเท้าที่เลือกไว้ถูกปิดขาย/ลบ หรือแอดมินเอารองเท้าออกจากชุด
    if (priceOf(v, item).invalid || (item.shoeVariantId && !variants[item.shoeVariantId])) return 'pieces_changed'
    if (item.rentalDays < settings.minRentalDays || item.rentalDays > settings.maxRentalDays) return 'bad_days'
    if (item.startDate < minStart) return 'too_soon'
    if (unavailable[unavailableKey(item.variantId, item.rentalDays, delivery, item.shoeVariantId)]?.has(item.startDate)) {
      return 'booked'
    }
    return 'ok'
  }

  // ครั้งแรกที่โหลดเสร็จ เลือกทุกรายการที่ยังจองได้ไว้ให้ (สูงสุด 10 รายการต่อออเดอร์)
  // (ปรับ state ระหว่าง render ตามแนวทางของ React แทนการใช้ effect)
  if (!loading && !selectionReady) {
    setSelectionReady(true)
    setSelected(cart.filter((i) => statusOf(i) === 'ok').slice(0, MAX_ITEMS_PER_ORDER).map(keyOf))
  }

  // ชุดแนะนำ: ไม่ซ้ำกับของที่อยู่ในตะกร้า
  useEffect(() => {
    if (loading) return
    const inCart = new Set(Object.values(variants).map((v) => v.productId))
    fetchCatalog(12).then(({ data }) => setRecommended(data.filter((c) => !inCart.has(c.id)).slice(0, 4)))
  }, [loading, variants])

  const selectedItems = cart.filter((i) => selected.includes(keyOf(i)) && statusOf(i) === 'ok')

  // ถามค่าเช่า/มัดจำของรายการที่เลือกพร้อมกัน — ไซส์เดียวกันวันทับกันจะได้คนละตัว เหมือนตอนจองจริง
  const quoteRequest = JSON.stringify({
    delivery,
    items: selectedItems.map((i) => ({ key: keyOf(i), variantId: i.variantId, startDate: i.startDate, rentalDays: i.rentalDays, pieces: i.pieces })),
  })
  useEffect(() => {
    const req = JSON.parse(quoteRequest) as { delivery: typeof delivery; items: ({ key: string } & Parameters<typeof quoteLines>[0][number])[] }
    let cancelled = false
    quoteLines(req.items, req.delivery).then((res) => {
      if (!cancelled) setQuotes(res ? Object.fromEntries(req.items.map((i, idx) => [i.key, res[idx]])) : {})
    })
    return () => {
      cancelled = true
    }
  }, [quoteRequest])
  const totals = selectedItems.reduce(
    (acc, i) => {
      const v = variants[i.variantId]
      if (!v) return acc
      const p = priceOf(v, i)
      return {
        rental: acc.rental + p.rental,
        deposit: acc.deposit + p.deposit,
        laundry: acc.laundry + p.laundry,
      }
    },
    { rental: 0, deposit: 0, laundry: 0 },
  )
  const shipping = selectedItems.length > 0 ? shippingFee(settings, delivery) : 0
  const grandTotal = totals.rental + totals.deposit + totals.laundry + shipping

  const selectableKeys = cart.filter((i) => statusOf(i) === 'ok').map(keyOf)
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((k) => selected.includes(k))

  function toggleItem(item: CartItem) {
    const k = keyOf(item)
    setSelected((prev) => {
      if (prev.includes(k)) return prev.filter((x) => x !== k)
      if (prev.length >= MAX_ITEMS_PER_ORDER) {
        alert(`เลือกได้สูงสุด ${MAX_ITEMS_PER_ORDER} รายการต่อออเดอร์`)
        return prev
      }
      return [...prev, k]
    })
  }

  function toggleAll() {
    setSelected(allSelected ? [] : selectableKeys.slice(0, MAX_ITEMS_PER_ORDER))
  }

  function handleRemove(item: CartItem) {
    removeFromCart([item])
    setSelected((prev) => prev.filter((x) => x !== keyOf(item)))
  }

  function handleCheckout() {
    if (selectedItems.length === 0) return
    router.push(`/checkout?items=${encodeCheckoutItems(selectedItems)}&delivery=${delivery}`)
  }

  const showSkeleton = !loggedIn || !ready || (cart.length > 0 && loading)

  return (
    <CustomerLayout>
      {/* design v2 (design-system.md): เส้น 1px · เงาแข็งเฉพาะตอน hover (.lift) */}
      <div className="theme-v2">
      <h1 className="mb-6 text-3xl font-bold text-[#263544]">ตะกร้าของฉัน</h1>

      {showSkeleton ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-card bg-sunken" />
            <div className="h-44 animate-pulse rounded-card bg-sunken" />
          </div>
          <div className="h-80 animate-pulse rounded-card bg-sunken" />
        </div>
      ) : cart.length === 0 ? (
        <EmptyState
          className="rounded-3xl"
          title="ตะกร้ายังว่างอยู่เลย"
          description={<>ไปเลือกชุดที่ชอบ กำหนดวันใช้งาน แล้วกด &quot;เพิ่มลงตะกร้า&quot; ได้เลยนะ</>}
          action={
            <Link
              href="/costumes"
              className="lift focus-ring inline-block rounded-full border border-line bg-brand px-6 py-2.5 text-base font-bold text-white active:bg-brand-strong"
            >
              สำรวจชุด
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <label className="mb-4 flex w-fit cursor-pointer items-center gap-2.5 text-base font-semibold text-[#263544]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={selectableKeys.length === 0}
                className="h-5 w-5 accent-[#E5457F]"
              />
              เลือกทั้งหมด <span className="font-normal text-[#263544]/60">({selectableKeys.length})</span>
            </label>

            <ul className="space-y-4">
              {cart.map((item) => {
                const v = variants[item.variantId]
                const status = statusOf(item)
                const isSelected = selected.includes(keyOf(item)) && status === 'ok'
                const timeline = v ? getRentalTimeline(item.startDate, item.rentalDays, settings, delivery) : null
                const line = v ? priceOf(v, item) : null

                return (
                  <li
                    key={keyOf(item)}
                    // เลือกอยู่ = เส้นเข้ม · ไม่ได้เลือก = เส้นจาง (กล่องกดไม่ได้ จึงไม่มีเงา)
                    className={`flex gap-4 rounded-card border bg-white p-4 transition ${
                      isSelected ? 'border-line' : 'border-line-subtle'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={status !== 'ok'}
                      onChange={() => toggleItem(item)}
                      aria-label="เลือกรายการนี้"
                      className="mt-1 h-5 w-5 flex-shrink-0 accent-[#E5457F] disabled:opacity-30"
                    />
                    <div className="h-28 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-line bg-[#FDE3EE] sm:h-32 sm:w-28">
                      {v?.coverImageUrl ? (
                        <img src={v.coverImageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[#E5457F]/40">
                          <ImageIcon size={28} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {v ? (
                            <Link
                              href={`/costumes/${v.productId}`}
                              className="line-clamp-2 text-lg font-bold text-[#263544] underline-offset-2 hover:underline"
                            >
                              {v.productName}
                            </Link>
                          ) : (
                            <p className="text-lg font-semibold text-[#263544]/50">ชุดที่ไม่เปิดให้เช่าแล้ว</p>
                          )}
                          {v && <p className="text-base text-[#263544]/70">ไซส์: {v.size}</p>}
                          {item.shoeVariantId && variants[item.shoeVariantId] && (
                            <p className="text-base text-[#263544]/70">รองเท้า: EU {variants[item.shoeVariantId].size}</p>
                          )}
                          {!!line?.shoeDiscount && (
                            <p className="text-base text-[#263544]/70">ไม่รับรองเท้า (−{formatBaht(line.shoeDiscount)})</p>
                          )}
                          {line?.pieceNames && (
                            <p className="text-base text-[#263544]/70">
                              เช่าแยกชิ้น: <span className="text-[#263544]">{line.pieceNames.join(', ')}</span>
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(item)}
                          aria-label="ลบออกจากตะกร้า"
                          className="nudge flex-shrink-0 rounded-full p-1.5 text-[#263544]/60 hover:text-red-600"
                        >
                          <TrashIcon size={22} />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        {timeline && (
                          <div className="rounded-xl bg-[#F7F7F8] px-3 py-2 text-base text-[#263544]">
                            <p className="font-semibold">
                              {formatThaiDateLong(timeline.useDate)} – {formatThaiDateLong(timeline.returnBy)}
                            </p>
                            <p className="text-sm text-[#263544]/60">
                              {delivery === 'pickup'
                                ? 'รับชุดที่ร้านวันใส่'
                                : `ชุดถึงมือคุณ ${formatThaiDateLong(timeline.receiveDate)} (ไม่นับวันเช่า)`}
                            </p>
                          </div>
                        )}
                        {v && line && (
                          <div className="text-right">
                            <p className="text-xl font-extrabold text-brand">
                              {formatBaht(line.rental)}
                              <span className="text-base font-semibold text-[#263544]/60"> / {line.rentalDays} วัน</span>
                            </p>
                            {line.rentalDays > 1 && (
                              <p className="text-sm text-[#263544]/60">
                                วันแรก {formatBaht(line.baseRental)} + {line.rentalDays - 1} วัน ×{' '}
                                {formatBaht(line.dayRate)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {status !== 'ok' && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#FFF3B0] px-3 py-2 text-base text-[#263544]">
                          <WarningCircleIcon size={16} className="flex-shrink-0" />
                          {STATUS_MESSAGE[status]}
                          {v && status !== 'closed' && (
                            <Link href={`/costumes/${v.productId}`} className="font-semibold underline">
                              {status === 'pieces_changed' ? 'เลือกชิ้นใหม่' : status === 'bad_days' ? 'เลือกใหม่' : 'เลือกวันใหม่'}
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <aside className="h-fit rounded-card border border-line bg-white p-6 lg:sticky lg:top-24">
            <h2 className="mb-4 border-b border-line-subtle pb-4 text-2xl font-bold text-[#263544]">
              สรุปยอด <span className="text-[#E5457F]">{selectedItems.length} รายการ</span>
            </h2>
            {settings.pickupLocation && (
              <fieldset className="mb-5 border-b border-line-subtle pb-5">
                <legend className="mb-2 text-base font-semibold text-[#263544]">รับชุดยังไง</legend>
                <div role="radiogroup" aria-label="วิธีรับชุด" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-white p-1">
                  {(
                    [
                      ['ship', 'จัดส่ง'],
                      ['pickup', 'รับเองที่ร้าน'],
                    ] as const
                  ).map(([method, label]) => (
                    <button
                      key={method}
                      type="button"
                      role="radio"
                      aria-checked={delivery === method}
                      onClick={() => setCartDelivery(method)}
                      className={`focus-ring rounded-lg py-2 text-base transition ${
                        delivery === method ? 'bg-brand-soft font-bold text-ink' : 'font-semibold text-ink hover:bg-sunken'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-[#263544]/60">
                  {delivery === 'pickup'
                    ? `รับชุดวันใส่ที่ ${settings.pickupLocation.name} · ให้ไรเดอร์มารับแทนได้`
                    : `ได้รับชุด ${settings.bufferDaysBefore} วันก่อนวันใส่`}
                  {' · '}ใช้วิธีเดียวกันทั้งตะกร้า
                </p>
              </fieldset>
            )}
            <dl className="space-y-2 text-base">
              <Row label="ค่าเช่าชุด" value={formatBaht(totals.rental)} />
              <Row label="ค่ามัดจำ (ได้คืนหลังตรวจชุด)" value={formatBaht(totals.deposit)} />
              <Row label="ค่าซักรีด" value={formatBaht(totals.laundry)} />
              <Row
                label={delivery === 'ship' && shippingFeeVaries(settings) ? 'ค่าจัดส่ง (เริ่มต้น)' : 'ค่าจัดส่ง'}
                value={formatBaht(shipping)}
              />
              <div className="flex items-center justify-between border-t border-dashed border-line-subtle pt-3">
                <dt className="font-bold text-[#263544]">ยอดชำระทั้งหมด</dt>
                <dd className="text-3xl font-extrabold text-brand">{formatBaht(grandTotal)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={selectedItems.length === 0}
              className="lift focus-ring mt-5 w-full rounded-full border border-line bg-brand py-4 text-lg font-bold text-white active:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedItems.length === 0 ? 'เลือกรายการก่อน' : 'ไปชำระเงิน'}
            </button>
          </aside>
        </div>
      )}

      {recommended.length > 0 && (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="mb-6 text-2xl font-bold text-[#263544]">ชุดที่คุณอาจสนใจ</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {recommended.map((c) => (
              <CostumeGridCard
                key={c.id}
                variant="gumroad"
                costume={c}
              />
            ))}
          </div>
        </section>
      )}
      </div>
    </CustomerLayout>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[#263544]/70">{label}</dt>
      <dd className="font-medium text-[#263544]">{value}</dd>
    </div>
  )
}
