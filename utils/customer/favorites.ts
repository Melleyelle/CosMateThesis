'use client'

import { useSyncExternalStore } from 'react'

const FAVORITES_STORAGE_KEY = 'cosmate:favorites'
const SERVER_FAVORITES: string[] = []
const subscribers = new Set<() => void>()
let favoritesSnapshot: string[] | null = null

function readFavorites(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(stored)) return []
    return Array.from(new Set(stored.filter((id): id is string => typeof id === 'string' && id.length > 0)))
  } catch {
    return []
  }
}

function publish(ids: string[] = readFavorites()) {
  favoritesSnapshot = ids
  subscribers.forEach((notify) => notify())
}

function handleStorage(event: StorageEvent) {
  if (event.key === FAVORITES_STORAGE_KEY || event.key === null) publish()
}

function subscribe(notify: () => void) {
  subscribers.add(notify)
  if (subscribers.size === 1) window.addEventListener('storage', handleStorage)
  return () => {
    subscribers.delete(notify)
    if (subscribers.size === 0) window.removeEventListener('storage', handleStorage)
  }
}

function getSnapshot(): string[] {
  if (!favoritesSnapshot) favoritesSnapshot = readFavorites()
  return favoritesSnapshot
}

function getServerSnapshot(): string[] {
  return SERVER_FAVORITES
}

function writeFavorites(ids: string[]) {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids))
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

export function toggleFavorite(productId: string): boolean {
  const ids = getSnapshot()
  const isNowFavorite = !ids.includes(productId)
  writeFavorites(isNowFavorite ? [...ids, productId] : ids.filter((id) => id !== productId))
  return isNowFavorite
}