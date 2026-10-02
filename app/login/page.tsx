'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/client'
import AuthLayout from '../components/auth/AuthLayout'
import AuthField from '../components/auth/AuthField'

// แปลงข้อความ error ของ Supabase เป็นภาษาไทย
function translateAuthError(message: string) {
  if (message.includes('Invalid login credentials')) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  }
  if (message.includes('Email not confirmed')) {
    return 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ (ตรวจสอบลิงก์ในกล่องจดหมายของคุณ)'
  }
  return message
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!supabase) {
      setError('Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      setError(translateAuthError(error.message))
      return
    }

    // กลับไปหน้าที่ถูกพามาล็อกอิน (?next=) — รับเฉพาะ path ภายในเว็บ กันการพาออกไปเว็บอื่น
    const next = new URLSearchParams(window.location.search).get('next')
    router.push(next && /^\/(?![/\\])/.test(next) ? next : '/')
    router.refresh() // ให้ส่วนที่อ่าน session (เช่น Navbar) อัปเดตตามสถานะใหม่
  }

  return (
    <AuthLayout
      title="ยินดีต้อนรับกลับ!"
      subtitle="พร้อมเลือกชุดสำหรับวันสนุก ๆ ของคุณแล้วหรือยัง?"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          id="email"
          label="อีเมล"
          type="email"
          required
          autoComplete="email"
          placeholder="กรอกอีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <AuthField
          id="password"
          label="รหัสผ่าน"
          type="password"
          required
          autoComplete="current-password"
          placeholder="กรอกรหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="text-base text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-center pt-3">
          <button
            type="submit"
            disabled={loading}
            className="pop rounded-full bg-[#E5457F] px-14 py-3 text-base font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </div>

        <p className="text-center text-base text-gray-500">
          ยังไม่มีบัญชี?{' '}
          <Link href="/register" className="text-[#E5457F] underline">
            สมัครสมาชิก
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}