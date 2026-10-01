import { useEffect, useState } from 'react'
import { isISODate } from '@/utils/dateUtils'
import { getCurrentUserId, useAuthUser } from '@/utils/customer/authUser'

// ตะกร้าเก็บในเบราว์เซอร์ (localStorage) แยกตามผู้ใช้ — ต้องล็อกอินก่อน ออกจากระบบแล้วตะกร้าจะไม่แสดง
// ชุดยังไม่ถูกล็อกจนกว่าจะกดยืนยันที่หน้าชำระเงิน (create_booking) ตะกร้าจึงต้องตรวจวันว่างใหม่ทุกครั้งที่เปิด

export type CartItem = {
  variantId: string
  startDate: string // วันใช้งาน 'YYYY-MM-DD'
  addedAt: number
}

export type CartKey = Pick<CartItem, 'variantId' | 'startDate'>

// create_booking() รับได้สูงสุด 10 รายการต่อออเดอร์
export const MAX_ITEMS_PER_ORDER = 10

const STORAGE_KEY = 'cosmate_cart_v1'
const CHANGE_EVENT = 'cosmate:cart-changed'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function sameCartItem(a: CartKey, b: CartKey): boolean {
  return a.variantId === b.variantId && a.startDate === b.startDate
}

function isValidItem(value: unknown): value is CartItem {
  const v = value as CartItem
  return !!v && typeof v.variantId === 'string' && UUID_RE.test(v.variantId) && isISODate(v.startDate)
}

const storageKeyOf = (userId: string) => `${STORAGE_KEY}:${userId}`

export function getCart(): CartItem[] {
  const userId = getCurrentUserId()
  if (typeof window === 'undefined' || !userId) return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKeyOf(userId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isValidItem) : []
  } catch {
    return []
  }
}

function saveCart(items: CartItem[]) {
  const userId = getCurrentUserId()
  if (!userId) return
  try {
    window.localStorage.setItem(storageKeyOf(userId), JSON.stringify(items))
  } catch {
    // โหมดส่วนตัวบางเบราว์เซอร์เขียนไม่ได้ — ข้ามไป ตะกร้าจะอยู่แค่ในหน้านี้
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function addToCart(variantId: string, startDate: string): 'added' | 'exists' {
  const items = getCart()
  if (items.some((i) => sameCartItem(i, { variantId, startDate }))) return 'exists'
  saveCart([...items, { variantId, startDate, addedAt: Date.now() }])
  return 'added'
}

export function removeFromCart(keys: CartKey[]) {
  saveCart(getCart().filter((item) => !keys.some((k) => sameCartItem(item, k))))
}

// อ่านตะกร้าแบบ reactive: อัปเดตเองเมื่อหน้าอื่น/แท็บอื่นแก้ตะกร้า หรือเมื่อล็อกอิน/ออกจากระบบ
export function useCart(): { items: CartItem[]; ready: boolean } {
  const { userId, ready: authReady } = useAuthUser()
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!authReady) return
    const sync = () => {
      setItems(getCart())
      setReady(true)
    }
    sync()
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [authReady, userId])

  return { items, ready }
}

// ส่งรายการไปหน้าชำระเงินผ่าน URL: ?items=<variantId>:<YYYY-MM-DD>,<variantId>:<YYYY-MM-DD>
export function encodeCheckoutItems(keys: CartKey[]): string {
  return keys.map((k) => `${k.variantId}:${k.startDate}`).join(',')
}

export function decodeCheckoutItems(value: string | null): CartKey[] {
  if (!value) return []
  const result: CartKey[] = []
  for (const part of value.split(',')) {
    const [variantId, startDate] = part.split(':')
    if (variantId && UUID_RE.test(variantId) && isISODate(startDate)) {
      if (!result.some((r) => sameCartItem(r, { variantId, startDate }))) {
        result.push({ variantId, startDate })
      }
    }
  }
  return result.slice(0, MAX_ITEMS_PER_ORDER)
}
