import { useEffect, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/client'

// สถานะผู้ใช้ฝั่งเบราว์เซอร์ — subscribe กับ supabase ครั้งเดียวแล้วแชร์ให้ทุก component
// ใช้สำหรับ UI (ตะกร้า/รายการโปรดแยกตามผู้ใช้ และกันหน้าที่ต้องล็อกอิน) ไม่ใช่การตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์

type AuthState = { userId: string | null; ready: boolean }

const SERVER_STATE: AuthState = { userId: null, ready: false }
let state: AuthState = SERVER_STATE
let started = false
const listeners = new Set<() => void>()

function setState(next: AuthState) {
  if (next.userId === state.userId && next.ready === state.ready) return
  state = next
  listeners.forEach((l) => l())
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  const supabase = createClient()
  if (!supabase) {
    setState({ userId: null, ready: true })
    return
  }
  // onAuthStateChange ส่ง INITIAL_SESSION มาให้ทันที จึงไม่ต้องเรียก getSession แยก
  supabase.auth.onAuthStateChange((_event, session) => {
    setState({ userId: session?.user.id ?? null, ready: true })
  })
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCurrentUserId(): string | null {
  return state.userId
}

export function useAuthUser(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE)
}

export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`
}

// ใช้ในหน้าที่ต้องล็อกอินก่อน: ถ้ายังไม่ล็อกอินจะพาไปหน้าเข้าสู่ระบบ แล้วกลับมาหน้าเดิมหลังล็อกอิน
export function useRequireLogin(): boolean {
  const { userId, ready } = useAuthUser()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // ใช้ window.location เพื่อเก็บ query (?items=...) ไว้ด้วย โดยไม่ต้องครอบ Suspense แบบ useSearchParams
    if (ready && !userId) router.replace(loginHref(window.location.pathname + window.location.search))
  }, [ready, userId, router, pathname])

  return ready && !!userId
}
