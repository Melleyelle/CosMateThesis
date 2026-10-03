'use client'

import { useSyncExternalStore } from 'react'
import { getAuthState, subscribeAuthUser } from '@/utils/customer/authUser'

// แยกรายการโปรดตามผู้ใช้ — key เดิม 'cosmate:favorites' ใช้ร่วมกันทุกบัญชีในเบราว์เซอร์เดียวกัน จึงลบทิ้ง
const LEGACY_FAVORITES_STORAGE_KEY = 'cosmate:favorites'
const FAVORITES_STORAGE_PREFIX = 'cosmate:favorites:'
const SERVER_FAVORITES: string[] = []
const subscribers = new Set<() => void>()
let favoritesSnapshot: { userId: string | null; ids: string[] } | null = null

function favoritesStorageKey(): string | null {
  const { userId } = getAuthState()
  return userId ? FAVORITES_STORAGE_PREFIX + userId : null
}

function readFavorites(): string[] {
  const key = favoritesStorageKey()
  if (!key) return []
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(stored)) return []
    return Array.from(new Set(stored.filter((id): id is string => typeof id === 'string' && id.length > 0)))
  } catch {
    return []
  }
}

function publish(ids: string[] = readFavorites()) {
  favoritesSnapshot = { userId: getAuthState().userId, ids }
  subscribers.forEach((notify) => notify())
}

function handleStorage(event: StorageEvent) {
  if (event.key === null || event.key === favoritesStorageKey()) publish()
}

let unsubscribeAuth: (() => void) | null = null

function subscribe(notify: () => void) {
  subscribers.add(notify)
  if (subscribers.size === 1) {
    try {
      window.localStorage.removeItem(LEGACY_FAVORITES_STORAGE_KEY)
    } catch {}
    window.addEventListener('storage', handleStorage)
    // ล็อกอิน/ออก/สลับบัญชี → โหลดรายการโปรดของผู้ใช้คนใหม่
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

function getSnapshot(): string[] {
  const { userId } = getAuthState()
  if (!favoritesSnapshot || favoritesSnapshot.userId !== userId) {
    favoritesSnapshot = { userId, ids: readFavorites() }
  }
  return favoritesSnapshot.ids
}

function getServerSnapshot(): string[] {
  return SERVER_FAVORITES
}

function writeFavorites(ids: string[]) {
  const key = favoritesStorageKey()
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // Keep in-memory consumers in sync even when storage is unavailable.
  }
  publish(ids)
}

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function isFavorite(productId: string): boolean {
  return getSnapshot().includes(productId)
}

// คืน null เมื่อยังไม่ล็อกอิน (ไม่มีรายการโปรดให้บันทึก) — ให้ผู้เรียกพาไปหน้าเข้าสู่ระบบ
export function toggleFavorite(productId: string): boolean | null {
  if (!favoritesStorageKey()) return null
  const ids = getSnapshot()
  const isNowFavorite = !ids.includes(productId)
  writeFavorites(isNowFavorite ? [...ids, productId] : ids.filter((id) => id !== productId))
  return isNowFavorite
}
