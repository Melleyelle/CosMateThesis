'use client'

import { useSyncExternalStore } from 'react'
import { isISODate } from '@/utils/dateUtils'
import { getAuthState, subscribeAuthUser } from '@/utils/customer/authUser'

export const MAX_ITEMS_PER_ORDER = 10

// แยกตะกร้าตามผู้ใช้ — key เดิม 'cosmate:cart' ใช้ร่วมกันทุกบัญชีในเบราว์เซอร์เดียวกัน จึงลบทิ้ง
const LEGACY_CART_STORAGE_KEY = 'cosmate:cart'
const CART_STORAGE_PREFIX = 'cosmate:cart:'

function cartStorageKey(): string | null {
  const { userId } = getAuthState()
  return userId ? CART_STORAGE_PREFIX + userId : null
}

export type CartKey = {
  variantId: string
  startDate: string
  pieces?: string[] // id ชิ้นส่วนที่เช่าแยก (เรียงแล้ว) — ไม่มี = เช่าทั้งชุด
}

export type CartItem = CartKey

// ไซส์ + วัน + ชิ้นที่เลือก คือหนึ่งรายการ (ไซส์เดียวกันวันเดียวกันแต่คนละชุดชิ้น = คนละรายการ)
export function cartKeyOf({ variantId, startDate, pieces }: CartKey): string {
  // ใช้ "." คั่นชิ้น ไม่ใช้ "+" เพราะใน query string "+" ถูกอ่านเป็นช่องว่าง
  return pieces && pieces.length > 0 ? `${variantId}:${startDate}:${pieces.join('.')}` : `${variantId}:${startDate}`
}

function normalizePieces(pieces: string[] | undefined): string[] | undefined {
  const clean = Array.from(new Set((pieces ?? []).filter((p) => typeof p === 'string' && p.length > 0))).sort()
  return clean.length > 0 ? clean : undefined
}

interface CartState {
  items: CartItem[]
  ready: boolean
}

const SERVER_CART_STATE: CartState = { items: [], ready: false }
const subscribers = new Set<() => void>()
let cartSnapshot: { userId: string | null; state: CartState } | null = null

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CartItem>
  return (
    typeof item.variantId === 'string' &&
    item.variantId.length > 0 &&
    isISODate(item.startDate) &&
    (item.pieces === undefined || Array.isArray(item.pieces))
  )
}

function readCart(): CartItem[] {
  const key = cartStorageKey()
  if (!key) return []
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(stored)
      ? stored.filter(isCartItem).map((i) => ({ ...i, pieces: normalizePieces(i.pieces) }))
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

function publish(items: CartItem[] = readCart()) {
  const { userId, ready } = getAuthState()
  cartSnapshot = { userId, state: { items, ready } }
  subscribers.forEach((notify) => notify())
}

function handleStorage(event: StorageEvent) {
  if (event.key === null || event.key === cartStorageKey()) publish()
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
    cartSnapshot = { userId, state: { items: readCart(), ready } }
  }
  return cartSnapshot.state
}

function getServerSnapshot(): CartState {
  return SERVER_CART_STATE
}

export function useCart(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function addToCart(variantId: string, startDate: string, pieces?: string[]): 'added' | 'exists' | 'login' {
  if (!cartStorageKey()) return 'login'
  const items = readCart()
  const item: CartItem = { variantId, startDate, pieces: normalizePieces(pieces) }
  const key = cartKeyOf(item)
  if (items.some((i) => cartKeyOf(i) === key)) return 'exists'
  writeCart([...items, item])
  return 'added'
}

export function removeFromCart(itemsToRemove: CartKey[]) {
  const keys = new Set(itemsToRemove.map(cartKeyOf))
  writeCart(readCart().filter((item) => !keys.has(cartKeyOf(item))))
}

// รูปแบบใน URL: variantId:YYYY-MM-DD หรือ variantId:YYYY-MM-DD:pieceId.pieceId
export function encodeCheckoutItems(items: CartKey[]): string {
  return items.map(cartKeyOf).join(',')
}

export function decodeCheckoutItems(value: string | null): CartKey[] {
  if (!value) return []

  const unique = new Map<string, CartKey>()
  for (const entry of value.split(',')) {
    const [variantId, startDate, pieceList] = entry.split(':')
    if (!variantId || !isISODate(startDate)) continue
    // รับช่องว่าง/+ ด้วย เผื่อลิงก์เก่าที่ยังคั่นด้วย "+"
    const item: CartKey = { variantId, startDate, pieces: normalizePieces(pieceList?.split(/[.+ ]/)) }
    unique.set(cartKeyOf(item), item)
  }
  return Array.from(unique.values())
}