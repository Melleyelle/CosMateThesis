'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftIcon, ArrowSquareOutIcon } from '@phosphor-icons/react'
import AdminLayout from '@/app/components/admin/AdminLayout'
import { PageHeader, secondaryButtonClass } from '@/app/components/admin/ui'
import EventForm, { PhotoModeration } from '@/app/components/admin/events/EventForm'
import { fetchEventForAdmin } from '@/utils/admin/events'
import { isEventPast, type CosEvent } from '@/utils/customer/events'
import { todayISO } from '@/utils/dateUtils'

// แก้ไขงาน — บันทึกแล้วอยู่หน้าเดิม (งานที่จบแล้วยังต้องจัดการรูปจากลูกค้าต่อ) · ลบแล้วกลับหน้ารายการ
export default function EditEventPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<CosEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchEventForAdmin(id).then(({ event, error }) => {
      setEvent(event)
      setLoadError(error ?? (event ? null : 'ไม่พบงานนี้ อาจถูกลบไปแล้ว'))
      setLoading(false)
    })
  }, [id])

  const backLink = (
    <Link
      href="/admin/events"
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#5B6472] transition hover:text-[#263544]"
    >
      <ArrowLeftIcon size={16} />
      อีเวนต์
    </Link>
  )

  return (
    <AdminLayout>
      <div className="px-5 pt-7 sm:px-8">
        {backLink}
        {loading ? (
          <>
            <div className="h-8 w-48 animate-pulse rounded-lg bg-white" />
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-96 animate-pulse rounded-2xl bg-white lg:col-span-2" />
              <div className="h-96 animate-pulse rounded-2xl bg-white" />
            </div>
          </>
        ) : loadError || !event ? (
          <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-6 text-center text-sm text-[#B42318]">
            {loadError}
          </p>
        ) : (
          <>
            <PageHeader
              title="แก้ไขงาน"
              description={event.name}
              actions={
                <Link href={`/events/${event.id}`} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
                  ดูหน้าลูกค้า
                  <ArrowSquareOutIcon size={16} />
                </Link>
              }
            />
            <EventForm
              event={event}
              onSaved={(saved) => setEvent(saved)}
              onDeleted={() => {
                router.push('/admin/events')
                router.refresh()
              }}
            />
            {isEventPast(event, todayISO()) && (
              <div className="mt-6 pb-10">
                <PhotoModeration eventId={event.id} />
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}
