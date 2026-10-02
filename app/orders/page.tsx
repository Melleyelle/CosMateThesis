'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CaretRightIcon, ImageIcon, StarIcon } from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import { fetchMyOrders, type OrderSummary } from '@/utils/customer/fetchOrders'
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from '@/utils/orderStatus'
import { formatBaht, formatThaiDateWithWeekday } from '@/utils/dateUtils'
import { fetchMyReviewsByOrderItem } from '@/utils/customer/reviews'

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reviewedItemIds, setReviewedItemIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchMyOrders().then(async ({ data, error }) => {
      if (error) setLoadError(error)
      else {
        setOrders(data)
        const completedItemIds = data.filter((o) => o.status === 'completed').flatMap((o) => o.lines.map((l) => l.id))
        const reviews = await fetchMyReviewsByOrderItem(completedItemIds)
        setReviewedItemIds(new Set(Object.keys(reviews)))
      }
      setLoading(false)
    })
  }, [])

  const pendingCount = orders.filter((o) => o.status === 'pending_payment').length
  const needsReview = (o: OrderSummary) =>
    o.status === 'completed' && o.lines.some((l) => !reviewedItemIds.has(l.id))
  const toReviewCount = orders.filter(needsReview).length

  return (
    <CustomerLayout>
      <h1 className="text-2xl font-bold text-[#263544]">ออเดอร์ของฉัน</h1>
      <p className="mb-6 text-base text-[#263544]/60">ติดตามสถานะการเช่า การจัดส่ง และการคืนชุด</p>

      {pendingCount > 0 && (
        <p className="mb-4 rounded-2xl border-2 border-[#263544] bg-[#FFF3B0] px-4 py-3 text-base text-[#263544]">
          มี {pendingCount} ออเดอร์ที่ยังไม่ได้ชำระเงิน กดเข้าไปเพื่อชำระหรือยกเลิกได้เลย
        </p>
      )}

      {toReviewCount > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl border-2 border-[#263544] bg-[#FDE3EE] px-4 py-3 text-base text-[#263544]">
          <StarIcon size={18} weight="fill" className="flex-shrink-0 text-[#F5B400]" />
          มี {toReviewCount} ออเดอร์ที่จบการเช่าแล้ว รอคุณรีวิวอยู่
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      )}

      {!loading && loadError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-6 text-center text-base text-red-600">
          {loadError}
        </p>
      )}

      {!loading && !loadError && orders.length === 0 && (
        <div className="rounded-3xl bg-[#F7F7F8] px-6 py-16 text-center">
          <p className="text-[#263544]/60">ยังไม่มีออเดอร์</p>
          <Link href="/costumes" className="mt-3 inline-block font-semibold text-[#E5457F] hover:underline">
            เริ่มเลือกชุดกันเลย
          </Link>
        </div>
      )}

      {!loading && !loadError && orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map((order) => {
            const first = order.lines[0]
            return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-4 rounded-2xl border-2 border-[#263544] bg-white p-4 transition hover:bg-[#FFFAFC]"
                >
                  <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-[#FDE3EE]">
                    {first?.coverImageUrl ? (
                      <img src={first.coverImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#E5457F]/40">
                        <ImageIcon size={22} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-[#263544]">{order.orderNumber}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${ORDER_STATUS_BADGE[order.status]}`}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                      {needsReview(order) && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#263544] bg-[#FFF3B0] px-2.5 py-0.5 text-sm font-semibold text-[#263544]">
                          <StarIcon size={12} weight="fill" className="text-[#F5B400]" />
                          รอรีวิว
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-base text-[#263544]">
                      {first ? `${first.productName}${first.size ? ` · ไซส์ ${first.size}` : ''}` : '—'}
                      {order.lines.length > 1 && ` และอีก ${order.lines.length - 1} ชุด`}
                    </p>
                    {first && (
                      <p className="text-base text-[#263544]/60">ใช้งาน {formatThaiDateWithWeekday(first.startDate)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#E5457F]">{formatBaht(order.grandTotal)}</p>
                    <CaretRightIcon size={18} className="ml-auto mt-1 text-[#263544]/40" />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </CustomerLayout>
  )
}
