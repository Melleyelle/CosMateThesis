'use client'

import { HeartIcon } from '@phosphor-icons/react'
import { toggleFavorite, useFavorites } from '@/utils/customer/favorites'

interface FavoriteButtonProps {
  productId: string
  size?: 'sm' | 'lg'
}

export default function FavoriteButton({ productId, size = 'sm' }: FavoriteButtonProps) {
  const favoriteIds = useFavorites()
  const isFavorite = favoriteIds.includes(productId)
  const large = size === 'lg'

  return (
    <button
      type="button"
      aria-label={isFavorite ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
      aria-pressed={isFavorite}
      onClick={() => toggleFavorite(productId)}
      className={`pop flex flex-shrink-0 items-center justify-center rounded-full bg-white text-[#E5457F] ${
        large ? 'h-12 w-12' : 'h-10 w-10'
      }`}
    >
      <HeartIcon size={large ? 24 : 20} weight={isFavorite ? 'fill' : 'regular'} />
    </button>
  )
}