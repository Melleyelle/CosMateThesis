'use client'

import { useSyncExternalStore } from 'react'
import { isISODate } from '@/utils/dateUtils'

export const MAX_ITEMS_PER_ORDER = 10

const CART_STORAGE_KEY = 'cosmate:cart'

export type CartKey = {
  variantId: string
  startDate: string
}

export type CartItem = CartKey

interface CartState {
  items: CartItem[]
  ready: boolean
}

const SERVER_CART_STATE: CartState = { items: [], ready: false }
const subscribers = new Set<() => void>()
let cartSnapshot: CartState | null = null

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CartItem>
  return typeof item.variantId === 'string' && item.variantId.length > 0 && isISODate(item.startDate)
}

function readCart(): CartItem[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter(isCartItem) : []
  } catch {
    return []
  }
}

function writeCart(items: CartItem[]) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Keep in-memory consumers in sync even when storage is unavailable.
  }
  publish(items)
}

function publish(items: CartItem[] = readCart()) {
  cartSnapshot = { items, ready: true }
  subscribers.forEach((notify) => notify())
}

function handleStorage(event: StorageEvent) {
  if (event.key === CART_STORAGE_KEY || event.key === null) publish()
}

function subscribe(notify: () => void) {
  subscribers.add(notify)
  if (subscribers.size === 1) window.addEventListener('storage', handleStorage)
  return () => {
    subscribers.delete(notify)
    if (subscribers.size === 0) window.removeEventListener('storage', handleStorage)
  }
}

function getSnapshot(): CartState {
  if (!cartSnapshot) cartSnapshot = { items: readCart(), ready: true }
  return cartSnapshot
}

function getServerSnapshot(): CartState {
  return SERVER_CART_STATE
}

export function useCart(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function addToCart(variantId: string, startDate: string): 'added' | 'exists' {
  const items = readCart()
  if (items.some((item) => item.variantId === variantId && item.startDate === startDate)) return 'exists'
  writeCart([...items, { variantId, startDate }])
  return 'added'
}

export function removeFromCart(itemsToRemove: CartKey[]) {
  const keys = new Set(itemsToRemove.map(({ variantId, startDate }) => `${variantId}:${startDate}`))
  writeCart(readCart().filter((item) => !keys.has(`${item.variantId}:${item.startDate}`)))
}

export function encodeCheckoutItems(items: CartKey[]): string {
  return items.map(({ variantId, startDate }) => `${variantId}:${startDate}`).join(',')
}

export function decodeCheckoutItems(value: string | null): CartKey[] {
  if (!value) return []

  const unique = new Map<string, CartKey>()
  for (const entry of value.split(',')) {
    const separator = entry.indexOf(':')
    if (separator <= 0) continue
    const variantId = entry.slice(0, separator)
    const startDate = entry.slice(separator + 1)
    if (!variantId || !isISODate(startDate)) continue
    unique.set(`${variantId}:${startDate}`, { variantId, startDate })
  }
  return Array.from(unique.values())
}