'use client'

import { useSyncExternalStore } from 'react'
import { isISODate } from '@/utils/dateUtils'
import { getAuthState, subscribeAuthUser } from '@/utils/customer/authUser'
import type { DeliveryMethod } from '@/utils/customer/bookingSettings'

export const MAX_ITEMS_PER_ORDER = 10

// แยกตะกร้าตามผู้ใช้ — key เดิม 'cosmate:cart' ใช้ร่วมกันทุกบัญชีในเบราว์เซอร์เดียวกัน จึงลบทิ้ง
const LEGACY_CART_STORAGE_KEY = 'cosmate:cart'
const CART_STORAGE_PREFIX = 'cosmate:cart:'
// วิธีรับชุดเป็นของทั้งตะกร้า (ค่าส่งคิดต่อออเดอร์) — เก็บแยกจากรายการ
const DELIVERY_STORAGE_PREFIX = 'cosmate:cart-delivery:'

function cartStorageKey(): string | null {
  const { userId } = getAuthState()
  return userId ? CART_STORAGE_PREFIX + userId : null
}

function deliveryStorageKey(): string | null {
  const { userId } = getAuthState()
  return userId ? DELIVERY_STORAGE_PREFIX + userId : null
}

export function parseDelivery(value: unknown): DeliveryMethod {
  return value === 'pickup' ? 'pickup' : 'ship'
}

function readDelivery(): DeliveryMethod {
  const key = deliveryStorageKey()
  if (!key) return 'ship'
  try {
    return parseDelivery(window.localStorage.getItem(key))
  } catch {
    return 'ship'
  }
}

export type CartKey = {
  variantId: string
  startDate: string
  rentalDays: number // จำนวนวันเช่าที่ลูกค้าเลือก (ของในตะกร้าก่อน v2 ไม่มีค่านี้ = 1 วัน)
  pieces?: string[] // id ชิ้นส่วนที่เช่าแยก (เรียงแล้ว) — ไม่มี = เช่าทั้งชุด
  // ไซส์รองเท้าที่มากับชุด (variant ของสินค้ารองเท้า, Step 19) — ไม่มี = ไม่รับรองเท้า / ชุดไม่มีรองเท้า
  shoeVariantId?: string
  // ยอมรับคู่ใกล้เคียงที่ร้านจัดหาให้ ถ้ารองเท้าไซส์นี้ไม่ว่าง (Step 29) — ใช้คู่กับ shoeVariantId เท่านั้น
  shoeSubstitute?: boolean
}

export type CartItem = CartKey

// ไซส์ + รองเท้า + วัน + จำนวนวัน + ชิ้นที่เลือก คือหนึ่งรายการ (ต่างกันข้อใดข้อหนึ่ง = คนละรายการ)
export function cartKeyOf({ variantId, startDate, rentalDays, pieces, shoeVariantId, shoeSubstitute }: CartKey): string {
  // ใช้ "." คั่นชิ้น ไม่ใช้ "+" เพราะใน query string "+" ถูกอ่านเป็นช่องว่าง · รองเท้าต่อท้ายไซส์ชุดด้วย "~" · ยอมรับคู่ใกล้เคียงต่อท้ายด้วย "*"
  const shoe = shoeVariantId ? `~${shoeVariantId}${shoeSubstitute ? '*' : ''}` : ''
  const base = `${variantId}${shoe}:${startDate}:${rentalDays}`
  return pieces && pieces.length > 0 ? `${base}:${pieces.join('.')}` : base
}

function normalizePieces(pieces: string[] | undefined): string[] | undefined {
  const clean = Array.from(new Set((pieces ?? []).filter((p) => typeof p === 'string' && p.length > 0))).sort()
  return clean.length > 0 ? clean : undefined
}

// ช่วงจริง (min–max) ตรวจในฐานข้อมูลตอนจอง ที่นี่กันแค่ค่าที่ไม่ใช่จำนวนเต็มบวก
function normalizeDays(days: unknown): number {
  const n = Math.floor(Number(days))
  return Number.isFinite(n) && n >= 1 ? n : 1
}

interface CartState {
  items: CartItem[]
  delivery: DeliveryMethod
  ready: boolean
}

const SERVER_CART_STATE: CartState = { items: [], delivery: 'ship', ready: false }
const subscribers = new Set<() => void>()
let cartSnapshot: { userId: string | null; state: CartState } | null = null

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CartItem>
  return (
    typeof item.variantId === 'string' &&
    item.variantId.length > 0 &&
    isISODate(item.startDate) &&
    (item.pieces === undefined || Array.isArray(item.pieces)) &&
    (item.shoeVariantId === undefined || typeof item.shoeVariantId === 'string') &&
    (item.shoeSubstitute === undefined || typeof item.shoeSubstitute === 'boolean')
  )
}

function readCart(): CartItem[] {
  const key = cartStorageKey()
  if (!key) return []
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(stored)
      ? stored
          .filter(isCartItem)
          .map((i) => ({
            ...i,
            rentalDays: normalizeDays(i.rentalDays),
            pieces: normalizePieces(i.pieces),
            shoeSubstitute: (!!i.shoeVariantId && i.shoeSubstitute) || undefined,
          }))
      : []
  } catch {
    return []
  }
}

function writeCart(items: CartItem[]) {
  const key = cartStorageKey()
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // Keep in-memory consumers in sync even when storage is unavailable.
  }
  publish(items)
}

function writeDelivery(delivery: DeliveryMethod) {
  const key = deliveryStorageKey()
  if (!key) return
  try {
    window.localStorage.setItem(key, delivery)
  } catch {}
}

function publish(items: CartItem[] = readCart()) {
  const { userId, ready } = getAuthState()
  cartSnapshot = { userId, state: { items, delivery: readDelivery(), ready } }
  subscribers.forEach((notify) => notify())
}

function handleStorage(event: StorageEvent) {
  if (event.key === null || event.key === cartStorageKey() || event.key === deliveryStorageKey()) publish()
}

let unsubscribeAuth: (() => void) | null = null

function subscribe(notify: () => void) {
  subscribers.add(notify)
  if (subscribers.size === 1) {
    try {
      window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY)
    } catch {}
    window.addEventListener('storage', handleStorage)
    // ล็อกอิน/ออก/สลับบัญชี → โหลดตะกร้าของผู้ใช้คนใหม่
    unsubscribeAuth = subscribeAuthUser(() => publish())
  }
  return () => {
    subscribers.delete(notify)
    if (subscribers.size === 0) {
      window.removeEventListener('storage', handleStorage)
      unsubscribeAuth?.()
      unsubscribeAuth = null
    }
  }
}

function getSnapshot(): CartState {
  const { userId, ready } = getAuthState()
  if (!cartSnapshot || cartSnapshot.userId !== userId || cartSnapshot.state.ready !== ready) {
    cartSnapshot = { userId, state: { items: readCart(), delivery: readDelivery(), ready } }
  }
  return cartSnapshot.state
}

function getServerSnapshot(): CartState {
  return SERVER_CART_STATE
}

export function useCart(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// 'mismatch' = ตะกร้ามีของอยู่แล้วและใช้วิธีรับชุดอื่น → ให้หน้าถามลูกค้าก่อน แล้วเรียก setCartDelivery() แล้วเพิ่มใหม่
export function addToCart(
  variantId: string,
  startDate: string,
  rentalDays: number,
  delivery: DeliveryMethod,
  pieces?: string[],
  shoeVariantId?: string,
  shoeSubstitute?: boolean,
): 'added' | 'exists' | 'login' | 'mismatch' {
  if (!cartStorageKey()) return 'login'
  const items = readCart()
  if (items.length > 0 && readDelivery() !== delivery) return 'mismatch'
  const item: CartItem = {
    variantId,
    startDate,
    rentalDays: normalizeDays(rentalDays),
    pieces: normalizePieces(pieces),
    shoeVariantId: shoeVariantId || undefined,
    shoeSubstitute: (!!shoeVariantId && shoeSubstitute) || undefined,
  }
  const key = cartKeyOf(item)
  if (items.some((i) => cartKeyOf(i) === key)) return 'exists'
  writeDelivery(delivery)
  writeCart([...items, item])
  return 'added'
}

// เปลี่ยนวิธีรับของทั้งตะกร้า (หน้าตะกร้าตรวจวันว่างของทุกรายการใหม่เอง)
export function setCartDelivery(delivery: DeliveryMethod) {
  writeDelivery(delivery)
  publish()
}

export function removeFromCart(itemsToRemove: CartKey[]) {
  const keys = new Set(itemsToRemove.map(cartKeyOf))
  writeCart(readCart().filter((item) => !keys.has(cartKeyOf(item))))
}

// รูปแบบใน URL: variantId:YYYY-MM-DD:วัน หรือ variantId:YYYY-MM-DD:วัน:pieceId.pieceId
// มีรองเท้า: variantId~shoeVariantId:… (ยอมรับคู่ใกล้เคียง: variantId~shoeVariantId*:…) · ลิงก์ก่อน v2 ไม่มีช่องจำนวนวัน (variantId:YYYY-MM-DD[:pieceIds]) → อ่านเป็น 1 วัน
export function encodeCheckoutItems(items: CartKey[]): string {
  return items.map(cartKeyOf).join(',')
}

export function decodeCheckoutItems(value: string | null): CartKey[] {
  if (!value) return []

  const unique = new Map<string, CartKey>()
  for (const entry of value.split(',')) {
    const [variantPart, startDate, third, fourth] = entry.split(':')
    const [variantId, shoePart] = (variantPart ?? '').split('~')
    const shoeVariantId = shoePart?.replace(/\*$/, '')
    if (!variantId || !isISODate(startDate)) continue
    const hasDays = third !== undefined && /^\d+$/.test(third)
    const pieceList = hasDays ? fourth : third
    // รับช่องว่าง/+ ด้วย เผื่อลิงก์เก่าที่ยังคั่นด้วย "+"
    const item: CartKey = {
      variantId,
      startDate,
      rentalDays: hasDays ? normalizeDays(third) : 1,
      pieces: normalizePieces(pieceList?.split(/[.+ ]/)),
      shoeVariantId: shoeVariantId || undefined,
      shoeSubstitute: (!!shoeVariantId && !!shoePart?.endsWith('*')) || undefined,
    }
    unique.set(cartKeyOf(item), item)
  }
  return Array.from(unique.values())
}