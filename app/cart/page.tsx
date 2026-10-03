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
  removeFromCart,
  useCart,
  type CartItem,
} from '@/utils/customer/cart'
import { fetchPieces, priceLine, type PieceInfo } from '@/utils/customer/pieces'
import {
  fetchUnavailableDates,
  fetchVariantSummaries,
  type VariantSummary,
} from '@/utils/customer/fetchVariantSummaries'
import { fetchCatalog, type CatalogCostume } from '@/utils/customer/fetchCatalog'
import { useRequireLogin } from '@/utils/customer/authUser'
import {
  DEFAULT_BOOKING_SETTINGS,
  customerHeldDays,
  fetchBookingSettings,
  getRentalTimeline,
  type BookingSettings,
} from '@/utils/customer/bookingSettings'
import { addDays, formatBaht, formatThaiDateLong, todayISO } from '@/utils/dateUtils'

type ItemStatus = 'ok' | 'closed' | 'pieces_changed' | 'too_soon' | 'booked'

const STATUS_MESSAGE: Record<Exclude<ItemStatus, 'ok'>, string> = {
  closed: 'ชุดหรือไซส์นี้ปิดให้เช่าแล้ว',
  pieces_changed: 'บางชิ้นที่เลือกไม่เปิดให้เช่าแยกแล้ว กรุณาเลือกชิ้นใหม่',
  too_soon: 'วันที่เลือกกระชั้นเกินไปแล้ว กรุณาเลือกวันใหม่',
  booked: 'วันที่เลือกถูกจองไปแล้ว กรุณาเลือกวันใหม่',
}

export default function CartPage() {
  const router = useRouter()
  const loggedIn = useRequireLogin()
  const { items: cart, ready } = useCart()

  const [variants, setVariants] = useState<Record<string, VariantSummary>>({})
  const [unavailable, setUnavailable] = useState<Record<string, Set<string>>>({})
  const [pieces, setPieces] = useState<Record<string, PieceInfo>>({})
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [selectionReady, setSelectionReady] = useState(false)
  const [recommended, setRecommended] = useState<CatalogCostume[]>([])

  // โหลดใหม่เมื่อชุดของไซส์ในตะกร้าเปลี่ยน (เพิ่ม/ลบไซส์ใหม่)
  const variantKey = useMemo(() => Array.from(new Set(cart.map((i) => i.variantId))).sort().join(','), [cart])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const ids = variantKey ? variantKey.split(',') : []
    Promise.all([fetchVariantSummaries(ids), fetchUnavailableDates(ids), fetchBookingSettings()]).then(
      async ([v, u, s]) => {
        const p = await fetchPieces(Object.values(v.data).map((x) => x.productId))
        if (cancelled) return
        setVariants(v.data)
        setUnavailable(u)
        setPieces(p)
        setSettings(s)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [ready, variantKey])

  const minStart = addDays(todayISO(), Math.max(settings.minLeadDays, settings.bufferDaysBefore))

  function statusOf(item: CartItem): ItemStatus {
    const v = variants[item.variantId]
    if (!v) return 'closed'
    if (priceLine(v, item.pieces, pieces).invalid) return 'pieces_changed'
    if (item.startDate < minStart) return 'too_soon'
    if (unavailable[item.variantId]?.has(item.startDate)) return 'booked'
    return 'ok'
  }

  // ครั้งแรกที่โหลดเสร็จ เลือกทุกรายการที่ยังจองได้ไว้ให้ (สูงสุด 10 รายการต่อออเดอร์)
  useEffect(() => {
    if (loading || selectionReady) return
    setSelected(cart.filter((i) => statusOf(i) === 'ok').slice(0, MAX_ITEMS_PER_ORDER).map(keyOf))
    setSelectionReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // ชุดแนะนำ: ไม่ซ้ำกับของที่อยู่ในตะกร้า
  useEffect(() => {
    if (loading) return
    const inCart = new Set(Object.values(variants).map((v) => v.productId))
    fetchCatalog(12).then(({ data }) => setRecommended(data.filter((c) => !inCart.has(c.id)).slice(0, 4)))
  }, [loading, variants])

  const selectedItems = cart.filter((i) => selected.includes(keyOf(i)) && statusOf(i) === 'ok')
  const totals = selectedItems.reduce(
    (acc, i) => {
      const v = variants[i.variantId]
      if (!v) return acc
      const p = priceLine(v, i.pieces, pieces)
      return {
        rental: acc.rental + p.rental,
        deposit: acc.deposit + p.deposit,
        laundry: acc.laundry + p.laundry,
      }
    },
    { rental: 0, deposit: 0, laundry: 0 },
  )
  const shipping = selectedItems.length > 0 ? settings.shippingFlatRate : 0
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
    router.push(`/checkout?items=${encodeCheckoutItems(selectedItems)}`)
  }

  const showSkeleton = !loggedIn || !ready || (cart.length > 0 && loading)

  return (
    <CustomerLayout>
      <h1 className="mb-6 text-3xl font-bold text-[#263544]">ตะกร้าของฉัน</h1>

      {showSkeleton ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-2xl bg-gray-100" />
            <div className="h-44 animate-pulse rounded-2xl bg-gray-100" />
          </div>
          <div className="h-80 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      ) : cart.length === 0 ? (
        <EmptyState
          className="rounded-3xl border-2 border-dashed border-[#263544]/20"
          title="ตะกร้ายังว่างอยู่เลย"
          description={<>ไปเลือกชุดที่ชอบ กำหนดวันใช้งาน แล้วกด &quot;เพิ่มลงตะกร้า&quot; ได้เลยนะ</>}
          action={
            <Link
              href="/costumes"
              className="pop inline-block rounded-full bg-[#E5457F] px-6 py-2.5 text-base font-bold text-white"
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
                const timeline = v ? getRentalTimeline(item.startDate, v.packageDays, settings) : null
                const line = v ? priceLine(v, item.pieces, pieces) : null

                return (
                  <li
                    key={keyOf(item)}
                    className={`flex gap-4 rounded-2xl border-2 bg-white p-4 transition ${
                      isSelected
                        ? 'border-[#263544] shadow-[4px_4px_0_0_#263544]'
                        : 'border-[#263544]/15'
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
                    <div className="h-28 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2 border-[#263544] bg-[#FDE3EE] sm:h-32 sm:w-28">
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
                              className="line-clamp-2 text-lg font-bold text-[#263544] hover:text-[#E5457F]"
                            >
                              {v.productName}
                            </Link>
                          ) : (
                            <p className="text-lg font-semibold text-[#263544]/50">ชุดที่ไม่เปิดให้เช่าแล้ว</p>
                          )}
                          {v && <p className="text-base text-[#263544]/70">ไซส์: {v.size}</p>}
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
                              ชุดถึงมือคุณ {formatThaiDateLong(timeline.receiveDate)} (ไม่นับวันเช่า)
                            </p>
                          </div>
                        )}
                        {v && line && (
                          <p className="text-xl font-extrabold text-[#E5457F]">
                            {formatBaht(line.rental)}
                            <span className="text-base font-semibold text-[#263544]/60"> / {customerHeldDays(v.packageDays)} วัน</span>
                          </p>
                        )}
                      </div>

                      {status !== 'ok' && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#FFF3B0] px-3 py-2 text-base text-[#263544]">
                          <WarningCircleIcon size={16} className="flex-shrink-0" />
                          {STATUS_MESSAGE[status]}
                          {v && status !== 'closed' && (
                            <Link href={`/costumes/${v.productId}`} className="font-semibold underline">
                              {status === 'pieces_changed' ? 'เลือกชิ้นใหม่' : 'เลือกวันใหม่'}
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

          <aside className="h-fit rounded-2xl border-2 border-[#263544] bg-white p-6 shadow-[4px_4px_0_0_#263544] lg:sticky lg:top-24">
            <h2 className="mb-4 border-b border-[#263544]/10 pb-4 text-2xl font-bold text-[#263544]">
              สรุปยอด <span className="text-[#E5457F]">{selectedItems.length} รายการ</span>
            </h2>
            <dl className="space-y-2 text-base">
              <Row label="ค่าเช่าชุด" value={formatBaht(totals.rental)} />
              <Row label="ค่ามัดจำ (ได้คืนหลังตรวจชุด)" value={formatBaht(totals.deposit)} />
              <Row label="ค่าซักรีด" value={formatBaht(totals.laundry)} />
              <Row label="ค่าจัดส่ง" value={formatBaht(shipping)} />
              <div className="flex items-center justify-between border-t-2 border-dashed border-gray-200 pt-3">
                <dt className="font-bold text-[#263544]">ยอดชำระทั้งหมด</dt>
                <dd className="text-3xl font-extrabold text-[#E5457F]">{formatBaht(grandTotal)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={selectedItems.length === 0}
              className="pop mt-5 w-full rounded-full bg-[#E5457F] py-4 text-lg font-bold text-white disabled:bg-gray-200 disabled:text-gray-400"
            >
              {selectedItems.length === 0 ? 'เลือกรายการก่อน' : 'ไปชำระเงิน'}
            </button>
          </aside>
        </div>
      )}

      {recommended.length > 0 && (
        <section className="mt-12 border-t-2 border-gray-200 pt-10">
          <h2 className="mb-6 text-2xl font-bold text-[#263544]">ชุดที่คุณอาจสนใจ</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {recommended.map((c) => (
              <CostumeGridCard key={c.id} costume={c} heldDays={customerHeldDays(c.minPricePackageDays)} />
            ))}
          </div>
        </section>
      )}
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
