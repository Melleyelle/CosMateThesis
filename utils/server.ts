// Supabase client ฝั่งเซิร์ฟเวอร์ (Route Handler / Server Component) อ่าน session จาก cookie
// คู่กับ utils/client.ts (createBrowserClient ของ @supabase/ssr เก็บ session ใน cookie อยู่แล้ว)
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')

  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // เรียกจาก Server Component ตั้ง cookie ไม่ได้ — ไม่เป็นไร session ยังอ่านได้
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {}
      },
    },
  })
}
