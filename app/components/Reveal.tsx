'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// ห่อเนื้อหาให้เด้งขึ้นมาตอนเลื่อนจอมาถึง (สไตล์อยู่ที่ .reveal ใน globals.css)
export default function Reveal({
  children,
  delay = 0,
  tilt = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  tilt?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-shown={shown}
      className={`reveal ${className}`}
      style={{ '--d': `${delay}ms`, '--tilt': `${tilt}deg` } as CSSProperties}
    >
      {children}
    </div>
  )
}
