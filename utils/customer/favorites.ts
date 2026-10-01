import { useEffect, useState } from 'react'
import { getCurrentUserId, useAuthUser } from '@/utils/customer/authUser'

// รายการโปรด (ปุ่มหัวใจ) เก็บในเบราว์เซอร์แยกตามผู้ใช้ — ยังไม่มีตารางในฐานข้อมูล
// ถ้าต่อยอดภายหลัง ย้ายไปเก็บเป็นตาราง user_favorites ได้โดยไม่ต้องแก้หน้าเว็บมาก

const STORAGE_KEY = 'cosmate_favorites_v1'
const CHANGE_EVENT = 'cosmate:favorites-changed'

const storageKeyOf = (userId: string) => `${STORAGE_KEY}:${userId}`

export function getFavorites(): string[] {
  const userId = getCurrentUserId()
  if (typeof window === 'undefined' || !userId) return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKeyOf(userId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function toggleFavorite(productId: string): boolean {
  const userId = getCurrentUserId()
  if (!userId) return false
  const current = getFavorites()
  const next = current.includes(productId)
    ? current.filter((id) => id !== productId)
    : [productId, ...current]
  try {
    window.localStorage.setItem(storageKeyOf(userId), JSON.stringify(next))
  } catch {
    // เขียนไม่ได้ก็ข้าม
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return next.includes(productId)
}

export function useFavorites(): string[] {
  const { userId, ready } = useAuthUser()
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    if (!ready) return
    const sync = () => setIds(getFavorites())
    sync()
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [ready, userId])

  return ids
}
