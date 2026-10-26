'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowSquareOutIcon,
  CalendarBlankIcon,
  EyeIcon,
  EyeSlashIcon,
  ImageIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'
import AdminLayout from '@/app/components/admin/AdminLayout'
import {
  EmptyState,
  FilterTabs,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
  StatusBadge,
} from '@/app/components/admin/ui'
import { FormCheckbox, FormField, FormTextArea } from '@/app/components/admin/costume-form/FormFields'
import { formatEventRange } from '@/app/components/customer/events/EventTile'
import {
  deleteEvent,
  EMPTY_EVENT_INPUT,
  fetchAllEventsForAdmin,
  fetchEventPhotosForAdmin,
  saveEvent,
  setEventPublished,
  setPhotoHidden,
  toInput,
  uploadEventCover,
  validateEvent,
  type EventInput,
} from '@/utils/admin/events'
import { EVENT_TONE, isEventPast, type CosEvent, type EventPhoto, type EventTone } from '@/utils/customer/events'
import { formatDateTime, todayISO } from '@/utils/dateUtils'

const TABS = [
  { value: 'upcoming', label: 'กำลังจะมาถึง' },
  { value: 'past', label: 'จบแล้ว' },
  { value: 'draft', label: 'ฉบับร่าง' },
  { value: 'all', label: 'ทั้งหมด' },
] as const
type Tab = (typeof TABS)[number]['value']

// selected: null = ไม่ได้เปิดฟอร์ม · 'new' = เพิ่มงานใหม่ · id = แก้ไขงานนั้น
type Selected = null | 'new' | string

export default function AdminEventsPage() {
  const [events, setEvents] = useState<CosEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Selected>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAllEventsForAdmin().then(({ data, error }) => {
      setEvents(data)
      setLoadError(error)
      setLoading(false)
    })
  }, [])

  const today = todayISO()
  const counts = useMemo(
    () => ({
      upcoming: events.filter((e) => e.isPublished && !isEventPast(e, today)).length,
      past: events.filter((e) => e.isPublished && isEventPast(e, today)).length,
      draft: events.filter((e) => !e.isPublished).length,
      all: events.length,
    }),
    [events, today],
  )
  const upcomingInterest = events
    .filter((e) => e.isPublished && !isEventPast(e, today))
    .reduce((sum, e) => sum + e.interestCount, 0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events
      .filter((e) => {
        if (tab === 'upcoming' && (!e.isPublished || isEventPast(e, today))) return false
        if (tab === 'past' && (!e.isPublished || !isEventPast(e, today))) return false
        if (tab === 'draft' && e.isPublished) return false
        if (q && !`${e.name} ${e.location}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) =>
        tab === 'upcoming' ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate),
      )
  }, [events, tab, search, today])

  const current = selected && selected !== 'new' ? events.find((e) => e.id === selected) ?? null : null

  function open(sel: Selected) {
    setSelected(sel)
    // จอเล็กฟอร์มอยู่ใต้รายการ → เลื่อนลงไปให้เห็น
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  async function togglePublish(ev: CosEvent) {
    const { error } = await setEventPublished(ev.id, !ev.isPublished)
    if (error) return alert(`บันทึกไม่สำเร็จ: ${error}`)
    setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, isPublished: !ev.isPublished } : e)))
  }

  return (
    <AdminLayout>
      <div className="px-5 pb-16 pt-7 sm:px-8">
        <PageHeader
          title="อีเวนต์"
          description="งานคอสเพลย์ที่แสดงในหน้าอีเวนต์ ปฏิทินจองชุด และหน้าหลัก"
          actions={
            <button type="button" onClick={() => open('new')} className={primaryButtonClass}>
              <PlusIcon size={18} weight="bold" />
              เพิ่มงานใหม่
            </button>
          }
        />

        <MetricStrip>
          <Metric label="กำลังจะมาถึง" value={counts.upcoming} />
          <Metric label="คนสนใจงานที่กำลังจะมาถึง" value={upcomingInterest.toLocaleString('th-TH')} />
          <Metric label="จบแล้ว" value={counts.past} />
          <Metric label="ฉบับร่าง (ลูกค้ามองไม่เห็น)" value={counts.draft} />
        </MetricStrip>

        {loadError && (
          <p role="alert" className="mt-6 rounded-xl bg-[#FDE8E8] px-4 py-3 text-sm text-[#B42318]">
            โหลดไม่สำเร็จ: {loadError} — ตรวจว่ารัน cosmate_step19_events.sql แล้วหรือยัง
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          {/* ---------- รายการ ---------- */}
          <Panel bodyClassName="">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEEDF2] px-4 py-3">
              <FilterTabs tabs={TABS} value={tab} onChange={setTab} counts={counts} />
              <label className="flex items-center gap-2 rounded-full border border-[#D5D9E0] bg-white px-3 py-1.5">
                <MagnifyingGlassIcon size={16} className="text-[#6B7280]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นชื่องาน/สถานที่"
                  className="w-40 bg-transparent text-sm outline-none"
                />
              </label>
            </div>

            {loading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F4F4F6]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState>{search ? 'ไม่พบงานที่ค้นหา' : 'ยังไม่มีงานในแท็บนี้'}</EmptyState>
            ) : (
              <ul className="divide-y divide-[#EEEDF2]">
                {filtered.map((ev) => {
                  const past = isEventPast(ev, today)
                  const active = selected === ev.id
                  return (
                    <li key={ev.id} className={`flex items-center gap-3 px-4 py-3 ${active ? 'bg-[#FDEEF3]' : ''}`}>
                      <button
                        type="button"
                        onClick={() => open(ev.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        aria-current={active || undefined}
                      >
                        <span className="relative h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-[#E4E3EA] bg-[#F4F4F6]">
                          {ev.coverImageUrl ? (
                            <img src={ev.coverImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <CalendarBlankIcon size={20} className="absolute inset-0 m-auto text-[#9AA3AF]" />
                          )}
                          <span className={`absolute bottom-1 left-1 h-2 w-2 rounded-full ring-1 ring-white ${EVENT_TONE[ev.tone].dot}`} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[#263544]">{ev.name}</span>
                          <span className="block truncate text-xs text-[#6B7280]">
                            {formatEventRange(ev.startDate, ev.endDate)} · {ev.location}
                          </span>
                        </span>
                      </button>
                      <span className="hidden items-center gap-1 text-xs tabular-nums text-[#5B6472] sm:flex" title="คนสนใจ">
                        <StarIcon size={14} weight="fill" className="text-[#E5457F]" />
                        {ev.interestCount}
                      </span>
                      {!ev.isPublished ? (
                        <StatusBadge tone="waiting">ฉบับร่าง</StatusBadge>
                      ) : past ? (
                        <StatusBadge tone="closed">จบแล้ว</StatusBadge>
                      ) : (
                        <StatusBadge tone="done">เผยแพร่</StatusBadge>
                      )}
                      <button
                        type="button"
                        onClick={() => togglePublish(ev)}
                        aria-label={ev.isPublished ? 'ซ่อนงานนี้ (เปลี่ยนเป็นฉบับร่าง)' : 'เผยแพร่งานนี้'}
                        title={ev.isPublished ? 'ซ่อนจากลูกค้า' : 'เผยแพร่'}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#5B6472] hover:bg-[#F4F4F6]"
                      >
                        {ev.isPublished ? <EyeIcon size={18} /> : <EyeSlashIcon size={18} />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {/* ---------- ฟอร์ม ---------- */}
          <div ref={editorRef} className="scroll-mt-6 space-y-6 xl:sticky xl:top-6">
            {selected === null ? (
              <Panel>
                <EmptyState>เลือกงานจากรายการเพื่อแก้ไข หรือกด “เพิ่มงานใหม่”</EmptyState>
              </Panel>
            ) : (
              <>
                <EventEditor
                  key={selected}
                  event={current}
                  onClose={() => setSelected(null)}
                  onSaved={(saved, isNew) => {
                    setEvents((prev) => (isNew ? [saved, ...prev] : prev.map((e) => (e.id === saved.id ? saved : e))))
                    setSelected(saved.id)
                  }}
                  onDeleted={(id) => {
                    setEvents((prev) => prev.filter((e) => e.id !== id))
                    setSelected(null)
                  }}
                />
                {current && isEventPast(current, today) && <PhotoModeration key={`photos-${current.id}`} eventId={current.id} />}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function EventEditor({
  event,
  onClose,
  onSaved,
  onDeleted,
}: {
  event: CosEvent | null
  onClose: () => void
  onSaved: (saved: CosEvent, isNew: boolean) => void
  onDeleted: (id: string) => void
}) {
  const [form, setForm] = useState<EventInput>(() => (event ? toInput(event) : EMPTY_EVENT_INPUT))
  const [errors, setErrors] = useState<Partial<Record<keyof EventInput, string>>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setMessage(null)
  }

  async function pickCover(file: File | undefined) {
    if (!file) return
    setUploading(true)
    const res = await uploadEventCover(file)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if ('error' in res) setMessage({ tone: 'error', text: `อัปโหลดรูปไม่สำเร็จ: ${res.error}` })
    else set('coverImageUrl', res.url)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = validateEvent(form)
    setErrors(v)
    if (Object.keys(v).length) return
    setSaving(true)
    const { event: saved, error } = await saveEvent(event?.id ?? null, form)
    setSaving(false)
    if (error || !saved) return setMessage({ tone: 'error', text: `บันทึกไม่สำเร็จ: ${error}` })
    setMessage({ tone: 'ok', text: 'บันทึกแล้ว' })
    onSaved(saved, !event)
  }

  async function remove() {
    if (!event) return
    const extra = event.interestCount > 0 ? ` (มีคนสนใจอยู่ ${event.interestCount} คน)` : ''
    if (!confirm(`ลบงาน "${event.name}"${extra}? ยอดคนสนใจและรูปของลูกค้าในงานนี้จะหายทั้งหมด ถ้าแค่ไม่อยากให้เห็น ให้เปลี่ยนเป็นฉบับร่างแทน`)) return
    const { error } = await deleteEvent(event.id)
    if (error) return setMessage({ tone: 'error', text: `ลบไม่สำเร็จ: ${error}` })
    onDeleted(event.id)
  }

  const fieldError = (k: keyof EventInput) =>
    errors[k] ? <p className="mt-1 text-xs text-[#B42318]">{errors[k]}</p> : null

  return (
    <Panel
      title={event ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}
      action={
        <div className="flex items-center gap-1">
          {event && (
            <Link
              href={`/events/${event.id}`}
              target="_blank"
              className="flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-[#5B6472] hover:bg-[#F4F4F6]"
            >
              ดูหน้าลูกค้า <ArrowSquareOutIcon size={14} />
            </Link>
          )}
          <button type="button" onClick={onClose} aria-label="ปิดฟอร์ม" className="flex h-8 w-8 items-center justify-center rounded-full text-[#5B6472] hover:bg-[#F4F4F6]">
            <XIcon size={18} />
          </button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* รูปปก */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">รูปปก (แนะนำแนวนอน 16:9)</p>
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-dashed border-[#C9CED6] bg-[#FAFAFC]">
            {form.coverImageUrl ? (
              <>
                <img src={form.coverImageUrl} alt="รูปปกงาน" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => set('coverImageUrl', null)}
                  className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[#B42318] shadow-sm"
                >
                  เอารูปออก
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm text-[#5B6472]"
              >
                <ImageIcon size={28} />
                {uploading ? 'กำลังอัปโหลด…' : 'คลิกเพื่อเลือกรูป (JPG, PNG, WEBP)'}
              </button>
            )}
          </div>
          {form.coverImageUrl && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-2 text-xs font-medium text-[#B8285D] hover:underline">
              {uploading ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูป'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickCover(e.target.files?.[0])} />
        </div>

        <div>
          <FormField id="ev-name" label="ชื่องาน *" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} />
          {fieldError('name')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FormField
              id="ev-start"
              label="วันเริ่มงาน *"
              type="date"
              value={form.startDate}
              onChange={(e) => {
                const v = e.target.value
                set('startDate', v)
                // งานวันเดียวเป็นส่วนใหญ่ → เติมวันสุดท้ายให้ถ้ายังว่างหรือก่อนวันเริ่ม
                if (!form.endDate || form.endDate < v) set('endDate', v)
              }}
            />
            {fieldError('startDate')}
          </div>
          <div>
            <FormField id="ev-end" label="วันสุดท้าย *" type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            {fieldError('endDate')}
          </div>
        </div>
        <div>
          <FormField id="ev-location" label="สถานที่ *" placeholder="เช่น ไบเทค บางนา ฮอลล์ 98" value={form.location} onChange={(e) => set('location', e.target.value)} />
          {fieldError('location')}
        </div>
        <div>
          <FormTextArea
            id="ev-desc"
            label={`รายละเอียดโดยคร่าว (${form.description.length}/2000)`}
            rows={5}
            placeholder="ธีมงาน เวลาเปิด-ปิด ค่าเข้า กติกาพร็อพ ฯลฯ"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
          {fieldError('description')}
        </div>
        <div>
          <FormField id="ev-map" label="ลิงก์แผนที่ (ไม่บังคับ)" placeholder="https://maps.app.goo.gl/..." value={form.mapUrl} onChange={(e) => set('mapUrl', e.target.value)} />
          {fieldError('mapUrl')}
        </div>
        <div>
          <FormField id="ev-official" label="ลิงก์เพจผู้จัด (ไม่บังคับ)" placeholder="https://facebook.com/..." value={form.officialUrl} onChange={(e) => set('officialUrl', e.target.value)} />
          {fieldError('officialUrl')}
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-gray-700">สีบนปฏิทิน</legend>
          <div className="flex gap-2">
            {(Object.keys(EVENT_TONE) as EventTone[]).map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                  form.tone === t ? 'border-[#263544] font-semibold text-[#263544]' : 'border-[#D5D9E0] text-[#5B6472]'
                }`}
              >
                <input type="radio" name="tone" value={t} checked={form.tone === t} onChange={() => set('tone', t)} className="sr-only" />
                <span className={`h-3 w-3 rounded-full ${EVENT_TONE[t].dot}`} />
                {EVENT_TONE[t].label}
              </label>
            ))}
          </div>
        </fieldset>

        <FormCheckbox
          id="ev-published"
          label="เผยแพร่ให้ลูกค้าเห็น (ไม่ติ๊ก = เก็บเป็นฉบับร่าง)"
          checked={form.isPublished}
          onChange={(e) => set('isPublished', e.target.checked)}
        />

        <div className="flex flex-wrap items-center gap-3 border-t border-[#EEEDF2] pt-4">
          {message && (
            <p role="status" className={`mr-auto text-sm ${message.tone === 'error' ? 'text-[#B42318]' : 'text-[#2E7D4F]'}`}>
              {message.text}
            </p>
          )}
          {event && (
            <button type="button" onClick={remove} className={`${secondaryButtonClass} !text-[#B42318]`}>
              <TrashIcon size={16} />
              ลบงาน
            </button>
          )}
          <button type="submit" disabled={saving || uploading} className={`${primaryButtonClass} ml-auto`}>
            {saving ? 'กำลังบันทึก…' : event ? 'บันทึกการแก้ไข' : 'เพิ่มงาน'}
          </button>
        </div>
      </form>
    </Panel>
  )
}

// รูปจากลูกค้าในงานที่จบแล้ว — ซ่อนรูปที่ไม่เหมาะสมได้ (ไม่ลบ ย้อนกลับได้)
function PhotoModeration({ eventId }: { eventId: string }) {
  const [photos, setPhotos] = useState<EventPhoto[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetchEventPhotosForAdmin(eventId).then(setPhotos)
  }, [eventId])

  async function toggle(p: EventPhoto) {
    setBusy(p.id)
    const { error } = await setPhotoHidden(p.id, !p.isHidden)
    setBusy(null)
    if (error) return alert(`บันทึกไม่สำเร็จ: ${error}`)
    setPhotos((prev) => prev?.map((x) => (x.id === p.id ? { ...x, isHidden: !p.isHidden } : x)) ?? null)
  }

  const hidden = photos?.filter((p) => p.isHidden).length ?? 0

  return (
    <Panel
      title="รูปจากลูกค้า"
      description={photos ? `${photos.length} รูป${hidden ? ` · ซ่อนอยู่ ${hidden}` : ''}` : 'กำลังโหลด…'}
    >
      {photos && photos.length === 0 ? (
        <EmptyState>ยังไม่มีลูกค้าอัปโหลดรูปในงานนี้</EmptyState>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {(photos ?? []).map((p) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-[#E4E3EA]">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-[#F4F4F6]">
                <img src={p.url} alt="" className={`h-full w-full object-cover ${p.isHidden ? 'opacity-30' : ''}`} />
              </a>
              <div className="p-1.5">
                <p className="truncate text-xs font-medium text-[#263544]">{p.uploaderName}</p>
                <p className="truncate text-xs text-[#6B7280]">{formatDateTime(p.createdAt)}</p>
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => toggle(p)}
                  className={`mt-1 w-full rounded-full px-2 py-1 text-xs font-semibold ${
                    p.isHidden ? 'bg-[#263544] text-white' : 'border border-[#D5D9E0] text-[#B42318]'
                  }`}
                >
                  {p.isHidden ? 'แสดงอีกครั้ง' : 'ซ่อนรูป'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
