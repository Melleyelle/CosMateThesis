'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import EmptyState from '@/app/components/EmptyState'
import CostumeGridCard from '@/app/components/customer/CostumeGridCard'
import { fetchCatalog, type CatalogCostume } from '@/utils/customer/fetchCatalog'
import { useFavorites } from '@/utils/customer/favorites'
import { useRequireLogin } from '@/utils/customer/authUser'
import { customerHeldDays } from '@/utils/customer/bookingSettings'

export default function FavoritesPage() {
  const loggedIn = useRequireLogin()
  const favoriteIds = useFavorites()
  const [catalog, setCatalog] = useState<CatalogCostume[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCatalog().then((res) => {
      setCatalog(res.data)
      setLoading(false)
    })
  }, [])

  // เรียงตามลำดับที่กดหัวใจล่าสุดก่อน / ชุดที่ปิดเช่าแล้วจะหายไปเอง
  const favorites = favoriteIds
    .map((id) => catalog.find((c) => c.id === id))
    .filter((c): c is CatalogCostume => !!c)

  return (
    <CustomerLayout>
      <h1 className="text-3xl font-bold text-[#263544]">รายการโปรด</h1>
      <p className="mb-6 text-base text-[#263544]/60">ชุดที่คุณกดหัวใจไว้</p>

      {loading || !loggedIn ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          className="rounded-3xl border-2 border-dashed border-[#263544]/20"
          title="ยังไม่มีชุดในดวงใจเลย"
          description="เจอชุดที่ถูกใจเมื่อไหร่ กดหัวใจเก็บไว้ แล้วกลับมาดูที่นี่ได้เลยนะ"
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
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {favorites.map((c) => (
            <CostumeGridCard key={c.id} costume={c} heldDays={customerHeldDays(c.minPricePackageDays)} />
          ))}
        </div>
      )}
    </CustomerLayout>
  )
}
