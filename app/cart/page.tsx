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
  encodeCheckoutItems,
  removeFromCart,
  useCart,
  type CartItem,
} from '@/utils/customer/cart'
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

type ItemStatus = 'ok' | 'closed' | 'too_soon' | 'booked'

const STATUS_MESSAGE: Record<Exclude<ItemStatus, 'ok'>, string> = {
  closed: 'ชุดหรือไซส์นี้ปิดให้เช่าแล้ว',
  too_soon: 'วันที่เลือกกระชั้นเกินไปแล้ว กรุณาเลือกวันใหม่',
  booked: 'วันที่เลือกถูกจองไปแล้ว กรุณาเลือกวันใหม่',
}

const keyOf = (i: { variantId: string; startDate: string }) => `${i.variantId}:${i.startDate}`

export default function CartPage() {
  const router = useRouter()
  const loggedIn = useRequireLogin()
  const { items: cart, ready } = useCart()

  const [variants, setVariants] = useState<Record<string, VariantSummary>>({})
  const [unavailable, setUnavailable] = useState<Record<string, Set<string>>>({})
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
      ([v, u, s]) => {
        if (cancelled) return
        setVariants(v.data)
        setUnavailable(u)
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
    if (!variants[item.variantId]) return 'closed'
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
      return {
        rental: acc.rental + v.packagePrice,
        deposit: acc.deposit + v.depositAmount,
        laundry: acc.laundry + v.laundryFee,
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
            <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-base font-medium text-[#263544]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={selectableKeys.length === 0}
                className="h-5 w-5 accent-[#263544]"
              />
              เลือกทั้งหมด ({selectableKeys.length})
            </label>

            <ul className="space-y-4">
              {cart.map((item) => {
                const v = variants[item.variantId]
                const status = statusOf(item)
                const isSelected = selected.includes(keyOf(item)) && status === 'ok'
                const timeline = v ? getRentalTimeline(item.startDate, v.packageDays, settings) : null

                return (
                  <li
                    key={keyOf(item)}
                    className={`flex gap-4 rounded-2xl bg-white p-4 transition ${
                      isSelected ? 'border-[3px] border-[#263544]' : 'border border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={status !== 'ok'}
                      onChange={() => toggleItem(item)}
                      aria-label="เลือกรายการนี้"
                      className="mt-1 h-6 w-6 flex-shrink-0 accent-[#263544] disabled:opacity-30"
                    />
                    <div className="h-28 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#FDE3EE] sm:h-32 sm:w-28">
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
                              className="line-clamp-2 text-lg font-semibold text-[#263544] hover:text-[#E5457F]"
                            >
                              {v.productName}
                            </Link>
                          ) : (
                            <p className="text-lg font-semibold text-[#263544]/50">ชุดที่ไม่เปิดให้เช่าแล้ว</p>
                          )}
                          {v && <p className="text-base text-[#263544]/70">ไซส์: {v.size}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(item)}
                          aria-label="ลบออกจากตะกร้า"
                          className="nudge rounded-full p-1.5 text-[#263544] hover:text-red-600"
                        >
                          <TrashIcon size={24} />
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                        {timeline && (
                          <div className="text-base text-[#263544]">
                            <p className="text-[#263544]/60">วันที่เช่า:</p>
                            <p>
                              {formatThaiDateLong(timeline.receiveDate)} ถึง {formatThaiDateLong(timeline.returnBy)}
                            </p>
                            <p className="text-base text-[#E5457F]">วันใช้งาน {formatThaiDateLong(item.startDate)}</p>
                          </div>
                        )}
                        {v && (
                          <p className="text-lg font-bold text-[#E5457F]">
                            {formatBaht(v.packagePrice)} / {customerHeldDays(v.packageDays, settings)} วัน
                          </p>
                        )}
                      </div>

                      {status !== 'ok' && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#FFF3B0] px-3 py-2 text-base text-[#263544]">
                          <WarningCircleIcon size={16} className="flex-shrink-0" />
                          {STATUS_MESSAGE[status]}
                          {v && status !== 'closed' && (
                            <Link href={`/costumes/${v.productId}`} className="font-semibold underline">
                              เลือกวันใหม่
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

          <aside className="h-fit rounded-2xl border border-gray-300 bg-white p-5 lg:sticky lg:top-24">
            <dl className="space-y-3 text-base">
              <Row label="จำนวนสินค้า:" value={String(selectedItems.length)} />
              <Row label="จำนวนเงินค่าเช่า:" value={formatBaht(totals.rental)} />
              <Row label="เงินค่ามัดจำ:" value={formatBaht(totals.deposit)} />
              <Row label="ค่าซักรีด:" value={formatBaht(totals.laundry)} />
              <Row label="ค่าขนส่ง:" value={formatBaht(shipping)} />
            </dl>
            <div className="my-4 border-t-2 border-gray-200" />
            <div className="flex items-center justify-between">
              <span className="text-base text-[#263544]">จำนวนเงินสุทธิ:</span>
              <span className="text-2xl font-bold text-[#263544]">{formatBaht(grandTotal)}</span>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={selectedItems.length === 0}
              className="pop mt-5 w-full rounded-full bg-[#263544] py-3.5 text-base font-semibold text-white disabled:opacity-40"
            >
              ยืนยัน
            </button>
            <p className="mt-3 text-center text-base text-[#263544]/60">
              ค่าขนส่งคิดครั้งเดียวต่อออเดอร์ เช่าหลายชุดพร้อมกันคุ้มกว่า
            </p>
          </aside>
        </div>
      )}

      {recommended.length > 0 && (
        <section className="mt-12 border-t-2 border-gray-200 pt-10">
          <h2 className="mb-6 text-2xl font-semibold text-[#263544]">ชุดที่คุณอาจสนใจ</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {recommended.map((c) => (
              <CostumeGridCard key={c.id} costume={c} heldDays={customerHeldDays(c.minPricePackageDays, settings)} />
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
      <dt className="text-[#263544]/80">{label}</dt>
      <dd className="font-medium text-[#263544]">{value}</dd>
    </div>
  )
}
