'use client'

import { usePathname, useRouter } from 'next/navigation'
import { HeartIcon } from '@phosphor-icons/react'
import { toggleFavorite, useFavorites } from '@/utils/customer/favorites'
import { loginHref, useAuthUser } from '@/utils/customer/authUser'

// ปุ่มหัวใจวงกลมชมพู ขอบกรมท่า + เงาแข็ง ตามดีไซน์การ์ดชุด
export default function FavoriteButton({ productId, size = 'md' }: { productId: string; size?: 'md' | 'lg' }) {
  const router = useRouter()
  const pathname = usePathname()
  const { userId } = useAuthUser()
  const favorites = useFavorites()
  const active = favorites.includes(productId)
  const box = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!userId) {
          router.push(loginHref(pathname))
          return
        }
        toggleFavorite(productId)
      }}
      aria-label={active ? 'เอาออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
      aria-pressed={active}
      className={`flex flex-shrink-0 items-center justify-center rounded-full border-2 border-[#263544] shadow-[2px_2px_0_0_#263544] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#263544] ${box} ${
        active ? 'bg-[#E5457F] text-white' : 'bg-[#E5457F] text-white/90'
      }`}
    >
      <HeartIcon size={size === 'lg' ? 22 : 18} weight={active ? 'fill' : 'bold'} />
    </button>
  )
}
