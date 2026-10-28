'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import AdminLayout from '@/app/components/admin/AdminLayout'
import { PageHeader } from '@/app/components/admin/ui'
import EventForm from '@/app/components/admin/events/EventForm'

// เพิ่มงานใหม่ — บันทึกแล้วกลับไปหน้ารายการ (แบบเดียวกับเพิ่มชุดใหม่)
export default function NewEventPage() {
  const router = useRouter()

  return (
    <AdminLayout>
      <div className="px-5 pt-7 sm:px-8">
        <Link
          href="/admin/events"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#5B6472] transition hover:text-[#263544]"
        >
          <ArrowLeftIcon size={16} />
          อีเวนต์
        </Link>
        <PageHeader title="เพิ่มงานใหม่" description="งานที่เผยแพร่จะขึ้นในหน้าอีเวนต์ ปฏิทินจองชุด และหน้าหลัก" />
        <EventForm
          event={null}
          onSaved={() => {
            router.push('/admin/events')
            router.refresh()
          }}
        />
      </div>
    </AdminLayout>
  )
}
