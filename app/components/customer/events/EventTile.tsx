/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { CalendarBlankIcon, CameraIcon, MapPinIcon } from '@phosphor-icons/react'
import { parseISODate } from '@/utils/dateUtils'
import { EVENT_TONE, isEventOngoing, type CosEvent } from '@/utils/customer/events'
import InterestButton, { InterestCount } from './InterestButton'

// ช่วงวันที่แบบอ่านง่าย: "ส. 8 พ.ย. 2569" / "ส. 8 – อา. 9 พ.ย. 2569" / "ศ. 31 ต.ค. – อา. 2 พ.ย. 2569"
export function formatEventRange(startDate: string, endDate: string): string {
  const s = parseISODate(startDate)
  const e = parseISODate(endDate)
  const wd = (d: Date) => d.toLocaleDateString('th-TH', { weekday: 'short' })
  const dm = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  const year = e.toLocaleDateString('th-TH', { year: 'numeric' })
  if (startDate === endDate) return `${wd(s)} ${dm(s)} ${year}`
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${wd(s)} ${s.getDate()} – ${wd(e)} ${dm(e)} ${year}`
  }
  return `${wd(s)} ${dm(s)} – ${wd(e)} ${dm(e)} ${year}`
}

// ป้ายวันที่ทรงสี่เหลี่ยม (ใช้ตอนไม่มีรูปปก และมุมรูปปก)
export function DateBadge({ event, size = 'md' }: { event: CosEvent; size?: 'md' | 'lg' }) {
  const s = parseISODate(event.startDate)
  const e = parseISODate(event.endDate)
  const sameDay = event.startDate === event.endDate
  const big = size === 'lg'
  return (
    <span
      className={`flex flex-shrink-0 flex-col items-center justify-center rounded-control border border-line ${EVENT_TONE[event.tone].bg} ${
        big ? 'h-24 w-24' : 'h-16 w-16'
      }`}
    >
      <span className={`font-extrabold leading-none text-ink ${big ? 'text-[28px]' : sameDay ? 'text-[22px]' : 'text-[18px]'}`}>
        {s.getDate()}
        {!sameDay && `–${e.getDate()}`}
      </span>
      <span className="mt-1 text-caption font-semibold text-secondary">
        {s.toLocaleDateString('th-TH', { month: 'short' })}
      </span>
    </span>
  )
}

interface EventTileProps {
  event: CosEvent
  past: boolean
  interested: boolean
  onInterestChange: (next: { interested: boolean; count: number }) => void
}

// การ์ดงานอีเวนต์ design v2: เส้น 1px · รูป 16:9 คั่นด้วยเส้นใต้รูป · hover ยก (.lift) เฉพาะส่วนที่เป็นลิงก์
export default function EventTile({ event, past, interested, onInterestChange }: EventTileProps) {
  const href = `/events/${event.id}`
  const ongoing = !past && isEventOngoing(event)
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface">
      <Link href={href} className="group focus-ring flex flex-1 flex-col" aria-label={event.name}>
        <div className="relative aspect-[16/9] overflow-hidden border-b border-line bg-sunken">
          {event.coverImageUrl ? (
            <img
              src={event.coverImageUrl}
              alt=""
              loading="lazy"
              className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${past ? 'grayscale-[35%]' : ''}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <CalendarBlankIcon size={40} className="text-muted" aria-hidden />
            </div>
          )}
          <div className="absolute left-3 top-3">
            <DateBadge event={event} />
          </div>
          {ongoing && (
            <span className="absolute right-3 top-3 rounded-full border border-line bg-surface px-2.5 py-0.5 text-caption font-bold text-brand-strong">
              กำลังจัดอยู่
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <h3 className="line-clamp-2 text-h3 font-bold text-ink group-hover:underline">{event.name}</h3>
          <p className="text-body-sm text-secondary">{formatEventRange(event.startDate, event.endDate)}</p>
          <p className="flex items-center gap-1 text-body-sm text-secondary">
            <MapPinIcon size={16} className="flex-shrink-0 text-brand" aria-hidden />
            <span className="truncate">{event.location}</span>
          </p>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-line-subtle px-4 py-3">
        <InterestCount count={event.interestCount} />
        {past ? (
          <Link
            href={`${href}#photos`}
            className="lift focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-body-sm font-semibold text-ink"
          >
            <CameraIcon size={16} aria-hidden />
            ดูรูปจากงาน
          </Link>
        ) : (
          <InterestButton
            eventId={event.id}
            interested={interested}
            count={event.interestCount}
            onChange={onInterestChange}
          />
        )}
      </div>
    </article>
  )
}
