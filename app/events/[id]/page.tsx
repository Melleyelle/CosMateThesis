'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  CalendarBlankIcon,
  DressIcon,
  MapPinIcon,
  ShareNetworkIcon,
} from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import EmptyState from '@/app/components/EmptyState'
import EventPhotos from '@/app/components/customer/events/EventPhotos'
import InterestButton, { InterestCount } from '@/app/components/customer/events/InterestButton'
import { DateBadge, formatEventRange } from '@/app/components/customer/events/EventTile'
import { useAuthUser } from '@/utils/customer/authUser'
import { fetchEvent, fetchMyInterests, isEventOngoing, isEventPast, type CosEvent } from '@/utils/customer/events'
import { todayISO } from '@/utils/dateUtils'

const primaryClass =
  'lift focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-brand px-5 text-body font-bold text-white active:bg-brand-strong'
const secondaryClass =
  'lift focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-body font-semibold text-ink'

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { userId } = useAuthUser()
  const [event, setEvent] = useState<CosEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [interested, setInterested] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchEvent(id).then(({ event, error }) => {
      setEvent(event)
      setLoadError(error)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    fetchMyInterests(userId).then((set) => setInterested(set.has(id)))
  }, [userId, id])

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: event?.name, url })
      } catch {}
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <CustomerLayout>
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="aspect-[16/9] animate-pulse rounded-card bg-sunken" />
          <div className="h-80 animate-pulse rounded-card bg-sunken" />
        </div>
      </CustomerLayout>
    )
  }

  // ฉบับร่างอ่านได้เฉพาะแอดมิน (RLS) → ลูกค้าทั่วไปจะได้ null และเห็นหน้า "ไม่พบงาน"
  if (!event) {
    return (
      <CustomerLayout>
        <EmptyState
          title="ไม่พบงานนี้"
          description={loadError ?? 'งานอาจถูกลบหรือยังไม่เผยแพร่'}
          action={
            <Link href="/events" className={secondaryClass}>
              ดูอีเวนต์ทั้งหมด
            </Link>
          }
        />
      </CustomerLayout>
    )
  }

  const today = todayISO()
  const past = isEventPast(event, today)
  const ongoing = isEventOngoing(event, today)

  return (
    <CustomerLayout>
      <div className="theme-v2 text-ink">
        <Link
          href={past ? '/events?tab=past' : '/events'}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full text-body-sm font-semibold text-secondary hover:text-ink"
        >
          <ArrowLeftIcon size={16} aria-hidden />
          {past ? 'งานที่ผ่านมา' : 'อีเวนต์ทั้งหมด'}
        </Link>

        <div className="mt-4 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
          {/* ---------- ซ้าย: รูปปก + รายละเอียด ---------- */}
          <div className="min-w-0">
            <div className="relative aspect-[16/9] overflow-hidden rounded-card border border-line bg-sunken">
              {event.coverImageUrl ? (
                <img src={event.coverImageUrl} alt={`ภาพประกอบงาน ${event.name}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <DateBadge event={event} size="lg" />
                </div>
              )}
            </div>

            <section className="mt-8">
              <h2 className="text-h2 font-bold text-ink">รายละเอียดงาน</h2>
              {event.description ? (
                <p className="mt-3 whitespace-pre-line text-body text-ink">{event.description}</p>
              ) : (
                <p className="mt-3 text-body text-secondary">ร้านยังไม่ได้เพิ่มรายละเอียดของงานนี้</p>
              )}
            </section>

            {past && (
              <div className="mt-10 border-t border-line-subtle pt-8">
                <EventPhotos eventId={event.id} canUpload />
              </div>
            )}
          </div>

          {/* ---------- ขวา: ข้อมูลหลัก + ปุ่มสนใจ ---------- */}
          <aside className="rounded-card border border-line bg-surface p-5 lg:sticky lg:top-24">
            <div className="flex flex-wrap gap-2">
              {!event.isPublished && (
                <span className="rounded-full bg-warning-subtle px-2.5 py-0.5 text-caption font-semibold text-warning">
                  ฉบับร่าง · ลูกค้ายังมองไม่เห็น
                </span>
              )}
              {past ? (
                <span className="rounded-full bg-sunken px-2.5 py-0.5 text-caption font-semibold text-secondary">งานจบแล้ว</span>
              ) : ongoing ? (
                <span className="rounded-full border border-line bg-brand-soft px-2.5 py-0.5 text-caption font-bold text-ink">กำลังจัดอยู่</span>
              ) : null}
            </div>
            <h1 className="mt-2 text-h1 font-bold text-ink">{event.name}</h1>

            <dl className="mt-4 space-y-3 text-body">
              <div className="flex gap-3">
                <dt className="sr-only">วันที่</dt>
                <CalendarBlankIcon size={20} className="mt-0.5 flex-shrink-0 text-brand" aria-hidden />
                <dd className="text-ink">{formatEventRange(event.startDate, event.endDate)}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="sr-only">สถานที่</dt>
                <MapPinIcon size={20} className="mt-0.5 flex-shrink-0 text-brand" aria-hidden />
                <dd className="min-w-0 text-ink">
                  {event.location}
                  {event.mapUrl && (
                    <a
                      href={event.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 text-body-sm font-semibold text-brand-strong underline-offset-2 hover:underline"
                    >
                      เปิดแผนที่ <ArrowSquareOutIcon size={14} aria-hidden />
                    </a>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
              <InterestCount count={event.interestCount} className="text-body" />
              {!past && (
                <InterestButton
                  eventId={event.id}
                  interested={interested}
                  count={event.interestCount}
                  size="lg"
                  onChange={(next) => {
                    setInterested(next.interested)
                    setEvent((e) => (e ? { ...e, interestCount: next.count } : e))
                  }}
                />
              )}
            </div>
            {past && (
              <a href="#photos" className="mt-3 block text-body-sm font-semibold text-brand-strong hover:underline">
                ไปงานนี้มา? อัปโหลดรูปอวดลุคของคุณ ↓
              </a>
            )}

            <div className="mt-5 flex flex-col gap-2">
              {!past && (
                <Link href={`/costumes?date=${event.startDate}`} className={primaryClass}>
                  <DressIcon size={20} aria-hidden />
                  หาชุดที่ว่างวันงาน
                </Link>
              )}
              <div className="flex gap-2">
                {event.officialUrl && (
                  <a href={event.officialUrl} target="_blank" rel="noopener noreferrer" className={`${secondaryClass} flex-1`}>
                    เพจผู้จัด <ArrowSquareOutIcon size={16} aria-hidden />
                  </a>
                )}
                <button type="button" onClick={share} className={`${secondaryClass} flex-1`}>
                  <ShareNetworkIcon size={18} aria-hidden />
                  {copied ? 'คัดลอกลิงก์แล้ว' : 'แชร์'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </CustomerLayout>
  )
}
