'use client'

import { useRouter } from 'next/navigation'
import { HeartIcon } from '@phosphor-icons/react'
import { toggleFavorite, useFavorites } from '@/utils/customer/favorites'
import { loginHref } from '@/utils/customer/authUser'

interface FavoriteButtonProps {
  productId: string
  size?: 'sm' | 'lg'
}

export default function FavoriteButton({ productId, size = 'sm' }: FavoriteButtonProps) {
  const favoriteIds = useFavorites()
  const isFavorite = favoriteIds.includes(productId)
  const large = size === 'lg'
  const router = useRouter()

  function handleClick() {
    // ยังไม่ล็อกอิน → ไปเข้าสู่ระบบก่อน แล้วกลับมาหน้าเดิม
    if (toggleFavorite(productId) === null) router.push(loginHref(window.location.pathname + window.location.search))
  }

  return (
    <button
      type="button"
      aria-label={isFavorite ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
      aria-pressed={isFavorite}
      onClick={handleClick}
      className={`pop flex flex-shrink-0 items-center justify-center rounded-full bg-white text-[#E5457F] ${
        large ? 'h-12 w-12' : 'h-10 w-10'
      }`}
    >
      <HeartIcon size={large ? 24 : 20} weight={isFavorite ? 'fill' : 'regular'} />
    </button>
  )
}