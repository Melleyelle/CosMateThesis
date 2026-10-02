'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/client'
import AuthLayout from '../components/auth/AuthLayout'
import AuthField from '../components/auth/AuthField'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault() // กันหน้าเว็บรีโหลดตอนกด submit
    setError(null)
    setInfo(null)

    if (!firstName.trim() || !lastName.trim()) {
      setError('กรุณากรอกชื่อจริงและนามสกุล')
      return
    }
    if (password.length < 8) {
      setError('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (password !== confirmPassword) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
      return
    }

    if (!supabase) {
      setError('Supabase ยังไม่ได้ถูกตั้งค่าใน environment ของโปรเจค')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // กรณีเปิด "Confirm email" ไว้ ถ้าอีเมลนี้เคยสมัครแล้ว Supabase จะไม่ฟ้อง error
    // (เพื่อไม่ให้คนนอกเดาได้ว่าอีเมลไหนมีบัญชี) แต่จะคืน identities เป็นอาร์เรย์ว่างแทน
    if (data.user && data.user.identities?.length === 0) {
      setError('อีเมลนี้ถูกใช้สมัครแล้ว')
      return
    }

    router.push('/login')
  }

  return (
    <AuthLayout
      title="ยินดีที่ได้รู้จัก!"
      subtitle="มาสร้างบัญชีไว้ แล้วมาเลือกชุดสนุก ๆ ไปด้วยกัน"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-10">
          <AuthField
            id="firstName"
            label="ชื่อจริง"
            type="text"
            required
            autoComplete="given-name"
            placeholder="กรอกชื่อจริง"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <AuthField
            id="lastName"
            label="นามสกุล"
            type="text"
            required
            autoComplete="family-name"
            placeholder="กรอกนามสกุล"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <AuthField
          id="email"
          label="E-mail"
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
          autoComplete="new-password"
          placeholder="กรอกรหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <AuthField
          id="confirm"
          label="ยืนยันรหัสผ่าน"
          type="password"
          required
          autoComplete="new-password"
          placeholder="กรอกรหัสผ่านอีกครั้ง"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="text-base text-red-600">
            {error}
          </p>
        )}
        {info && <p className="text-base text-green-700">{info}</p>}
        

        <div className="flex justify-center pt-3">
          <button
            type="submit"
            disabled={loading}
            className="pop rounded-full bg-[#E5457F] px-14 py-3 text-base font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'loading...' : 'สมัครสมาชิก'}
          </button>
        </div>

        <p className="text-center text-base text-gray-500">
          มีบัญชีแล้ว?{' '}
          <Link href="/login" className="text-[#E5457F] underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
