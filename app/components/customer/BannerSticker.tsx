import type { CSSProperties } from 'react'
import type { Icon } from '@phosphor-icons/react'

// แบนเนอร์หน้าค้นหา (สำรวจชุด / อีเวนต์) ใช้ร่วมกัน

// หน่วงจังหวะ .rise ทีละบรรทัดในแบนเนอร์
export const riseDelay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

// สติกเกอร์วงกลมบนแบนเนอร์: เส้น 1px ink · หมุนเอียงจาก className · .wobble โยกรอบมุมที่เอียงไว้
export default function BannerSticker({
  icon: StickerIcon,
  className,
  tone,
  delay,
  small = false,
}: {
  icon: Icon
  className: string
  tone: string
  delay: string
  small?: boolean
}) {
  return (
    <span className={`absolute block ${className}`}>
      <span
        className={`wobble flex items-center justify-center rounded-full border border-line text-ink ${tone} ${
          small ? 'h-11 w-11' : 'h-14 w-14'
        }`}
        style={{ animationDelay: delay }}
      >
        <StickerIcon size={small ? 20 : 26} weight="duotone" />
      </span>
    </span>
  )
}
