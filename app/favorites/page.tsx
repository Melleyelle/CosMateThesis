'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import EmptyState from '@/app/components/EmptyState'
import CostumeGridCard, { CARD_MEDIA } from '@/app/components/customer/CostumeGridCard'
import { fetchCatalog, type CatalogCostume } from '@/utils/customer/fetchCatalog'
import { useFavorites } from '@/utils/customer/favorites'
import { useRequireLogin } from '@/utils/customer/authUser'

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
      {/* design v2 (design-system.md): เส้น 1px · เงาแข็งเฉพาะตอน hover (.lift) · การ์ดสินค้าแบบเดียวกับหน้าสำรวจชุด */}
      <div className="theme-v2">
      <h1 className="text-3xl font-bold text-[#263544]">รายการโปรด</h1>
      <p className="mb-6 text-base text-[#263544]/60">ชุดที่คุณกดหัวใจไว้</p>

      {loading || !loggedIn ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="กำลังโหลด">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-card border border-line">
              <div className={`${CARD_MEDIA} animate-pulse border-b border-line bg-sunken`} />
              <div className="space-y-2 p-3">
                <div className="h-4 w-1/2 animate-pulse rounded bg-sunken" />
                <div className="h-5 w-4/5 animate-pulse rounded bg-sunken" />
                <div className="h-5 w-1/3 animate-pulse rounded bg-sunken" />
              </div>
            </div>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        // empty state design v2: ไม่มีกรอบและไม่มีพื้น
        <EmptyState
          title="ยังไม่มีชุดในดวงใจเลย"
          description="เจอชุดที่ถูกใจเมื่อไหร่ กดหัวใจเก็บไว้ แล้วกลับมาดูที่นี่ได้เลยนะ"
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
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {favorites.map((c) => (
            <CostumeGridCard
              key={c.id}
              variant="gumroad"
              costume={c}
            />
          ))}
        </div>
      )}
      </div>
    </CustomerLayout>
  )
}
