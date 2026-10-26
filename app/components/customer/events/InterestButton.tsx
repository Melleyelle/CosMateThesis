'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StarIcon } from '@phosphor-icons/react'
import { loginHref, useAuthUser } from '@/utils/customer/authUser'
import { toggleEventInterest } from '@/utils/customer/events'

interface InterestButtonProps {
  eventId: string
  interested: boolean
  count: number
  onChange: (next: { interested: boolean; count: number }) => void
  size?: 'sm' | 'lg'
}

// ปุ่ม "สนใจ" แบบ design v2: เส้น 1px · hover ยก + เงาแข็ง · กดอยู่ = พื้น brand-soft + ดาวทึบ
// เปลี่ยนสถานะทันทีที่กด (optimistic) แล้วใช้ตัวเลขจริงจากฐานข้อมูลแทนเมื่อบันทึกเสร็จ
export default function InterestButton({ eventId, interested, count, onChange, size = 'sm' }: InterestButtonProps) {
  const router = useRouter()
  const { userId, ready } = useAuthUser()
  const [busy, setBusy] = useState(false)
  const large = size === 'lg'

  async function handleClick() {
    if (busy) return
    if (ready && !userId) {
      router.push(loginHref(window.location.pathname + window.location.search))
      return
    }
    const prev = { interested, count }
    onChange({ interested: !interested, count: Math.max(0, count + (interested ? -1 : 1)) })
    setBusy(true)
    const res = await toggleEventInterest(eventId)
    setBusy(false)
    if ('error' in res) {
      onChange(prev)
      alert(res.error)
      return
    }
    onChange({ interested: res.interested, count: res.count })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={interested}
      disabled={!ready}
      className={`lift focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-line font-semibold text-ink disabled:opacity-60 ${
        large ? 'min-h-11 px-5 text-body' : 'min-h-9 px-3.5 text-body-sm'
      } ${interested ? 'bg-brand-soft' : 'bg-surface'}`}
    >
      <StarIcon
        size={large ? 20 : 16}
        weight={interested ? 'fill' : 'regular'}
        className={interested ? 'text-brand-strong' : 'text-ink'}
        aria-hidden
      />
      {interested ? 'สนใจแล้ว' : 'สนใจ'}
    </button>
  )
}

// "128 คนสนใจ" — แยกจากปุ่ม เพื่อให้คนที่ยังไม่กดเห็นจำนวนได้ชัด
export function InterestCount({ count, className = '' }: { count: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-body-sm text-secondary ${className}`}>
      <StarIcon size={14} weight="fill" className="text-brand" aria-hidden />
      <span>
        <span className="font-semibold tabular-nums text-ink">{count.toLocaleString('th-TH')}</span> คนสนใจ
      </span>
    </span>
  )
}
