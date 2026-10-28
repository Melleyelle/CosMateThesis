'use client'
/* eslint-disable @next/next/no-img-element */

// ฟอร์มเพิ่ม/แก้ไขงานอีเวนต์ — ใช้ใน /admin/events/new และ /admin/events/[id]/edit
// จัด 2 คอลัมน์แบบหน้าเพิ่มชุด: ซ้าย = ข้อมูลงาน + ลิงก์ · ขวา = รูปปก + การแสดงผล
import { useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, EyeIcon, EyeSlashIcon, ImageIcon, TrashIcon } from '@phosphor-icons/react'
import { EmptyState, Panel, primaryButtonClass } from '@/app/components/admin/ui'
import { FormField, FormTextArea } from '@/app/components/admin/costume-form/FormFields'
import {
  deleteEvent,
  EMPTY_EVENT_INPUT,
  fetchEventPhotosForAdmin,
  saveEvent,
  setPhotoHidden,
  toInput,
  uploadEventCover,
  validateEvent,
  type EventInput,
} from '@/utils/admin/events'
import { EVENT_TONE, type CosEvent, type EventPhoto, type EventTone } from '@/utils/customer/events'
import { formatDateTime } from '@/utils/dateUtils'

export default function EventForm({
  event,
  onSaved,
  onDeleted,
}: {
  event: CosEvent | null
  onSaved: (saved: CosEvent, isNew: boolean) => void
  onDeleted?: () => void
}) {
  const [form, setForm] = useState<EventInput>(() => (event ? toInput(event) : EMPTY_EVENT_INPUT))
  const [errors, setErrors] = useState<Partial<Record<keyof EventInput, string>>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setMessage(null)
  }

  async function pickCover(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage({ tone: 'error', text: 'รูปปกต้องเป็นไฟล์ JPG, PNG หรือ WEBP' })
      return
    }
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
    if (Object.keys(v).length) {
      setMessage({ tone: 'error', text: 'ยังกรอกไม่ครบ ดูช่องที่ขึ้นสีแดง' })
      return
    }
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
    onDeleted?.()
  }

  // งานกี่วัน — ช่วยเช็กว่าเลือกวันถูก (นับรวมวันแรกและวันสุดท้าย)
  const eventDays =
    form.startDate && form.endDate && form.endDate >= form.startDate
      ? Math.round((Date.parse(form.endDate) - Date.parse(form.startDate)) / 86_400_000) + 1
      : null

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* ---------- คอลัมน์หลัก ---------- */}
        <div className="space-y-6 lg:col-span-2">
          <Panel title="ข้อมูลงาน" description="ช่องที่มี * ต้องกรอก">
            <div className="space-y-4">
              <FormField
                id="ev-name"
                label="ชื่องาน *"
                value={form.name}
                maxLength={120}
                error={errors.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="ev-start"
                  label="วันเริ่มงาน *"
                  type="date"
                  value={form.startDate}
                  error={errors.startDate}
                  onChange={(e) => {
                    const v = e.target.value
                    set('startDate', v)
                    // งานวันเดียวเป็นส่วนใหญ่ → เติมวันสุดท้ายให้ถ้ายังว่างหรือก่อนวันเริ่ม
                    if (!form.endDate || form.endDate < v) set('endDate', v)
                  }}
                />
                <FormField
                  id="ev-end"
                  label="วันสุดท้าย *"
                  type="date"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  error={errors.endDate}
                  hint={eventDays ? (eventDays === 1 ? 'งานวันเดียว' : `งาน ${eventDays} วัน`) : undefined}
                  onChange={(e) => set('endDate', e.target.value)}
                />
              </div>
              <FormField
                id="ev-location"
                label="สถานที่ *"
                placeholder="เช่น ไบเทค บางนา ฮอลล์ 98"
                value={form.location}
                error={errors.location}
                onChange={(e) => set('location', e.target.value)}
              />
              <FormTextArea
                id="ev-desc"
                label="รายละเอียดโดยคร่าว"
                rows={7}
                maxLength={2000}
                placeholder="ธีมงาน เวลาเปิด-ปิด ค่าเข้า กติกาพร็อพ ฯลฯ"
                value={form.description}
                error={errors.description}
                hint={
                  <span className="block text-right tabular-nums">
                    {form.description.length.toLocaleString('th-TH')}/2,000
                  </span>
                }
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          </Panel>

          <Panel title="ลิงก์" description="ไม่บังคับ · ลูกค้ากดจากหน้างานได้">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="ev-map"
                label="แผนที่"
                type="url"
                inputMode="url"
                placeholder="https://maps.app.goo.gl/..."
                value={form.mapUrl}
                error={errors.mapUrl}
                onChange={(e) => set('mapUrl', e.target.value)}
              />
              <FormField
                id="ev-official"
                label="เพจผู้จัด"
                type="url"
                inputMode="url"
                placeholder="https://facebook.com/..."
                value={form.officialUrl}
                error={errors.officialUrl}
                onChange={(e) => set('officialUrl', e.target.value)}
              />
            </div>
          </Panel>
        </div>

        {/* ---------- คอลัมน์ข้าง ---------- */}
        <div className="space-y-6">
          <Panel title="รูปปก" description="แนวนอน 16:9 · JPG, PNG หรือ WEBP · ไม่ใส่ก็ได้">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                pickCover(e.dataTransfer.files?.[0])
              }}
              className={`relative aspect-[16/9] overflow-hidden rounded-xl border transition-colors ${
                form.coverImageUrl
                  ? 'border-[#E4E3EA] bg-[#F4F4F6]'
                  : dragOver
                    ? 'border-dashed border-[#E5457F] bg-[#FDEEF3]'
                    : 'border-dashed border-[#C9CED6] bg-[#FAFAFC] hover:border-[#9AA3AF]'
              }`}
            >
              {form.coverImageUrl ? (
                <>
                  <img src={form.coverImageUrl} alt="รูปปกงาน" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/50 to-transparent p-2.5 pt-8">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#263544] shadow-[0_1px_3px_rgb(0_0_0/0.2)] hover:bg-[#F4F4F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
                    >
                      {uploading ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูป'}
                    </button>
                    <button
                      type="button"
                      onClick={() => set('coverImageUrl', null)}
                      disabled={uploading}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#B42318] shadow-[0_1px_3px_rgb(0_0_0/0.2)] hover:bg-[#FDE8E8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
                    >
                      เอารูปออก
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl text-[#5B6472] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#E5457F]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#E5457F] ring-1 ring-[#E4E3EA]">
                    <ImageIcon size={22} />
                  </span>
                  <span className="text-sm font-medium text-[#263544]">{uploading ? 'กำลังอัปโหลด…' : 'เพิ่มรูปปก'}</span>
                  <span className="text-xs">คลิกหรือลากไฟล์มาวาง</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => pickCover(e.target.files?.[0])}
            />
          </Panel>

          <Panel title="การแสดงผล">
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-gray-700">ใครเห็นงานนี้</legend>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      [true, 'เผยแพร่', 'ลูกค้าเห็นในหน้าอีเวนต์และปฏิทิน', EyeIcon],
                      [false, 'ฉบับร่าง', 'เห็นเฉพาะแอดมิน', EyeSlashIcon],
                    ] as const
                  ).map(([value, label, desc, Icon]) => {
                    const on = form.isPublished === value
                    return (
                      <label
                        key={label}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#E5457F]/40 ${
                          on ? 'border-[#E5457F] bg-[#FDEEF3]' : 'border-[#D5D9E0] hover:border-[#9AA3AF]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="visibility"
                          checked={on}
                          onChange={() => set('isPublished', value)}
                          className="sr-only"
                        />
                        <Icon size={18} className={`mt-0.5 flex-shrink-0 ${on ? 'text-[#B8285D]' : 'text-[#9AA3AF]'}`} />
                        <span>
                          <span className={`block text-sm font-semibold ${on ? 'text-[#263544]' : 'text-[#5B6472]'}`}>{label}</span>
                          <span className="block text-xs text-[#6B7280]">{desc}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-gray-700">สีบนปฏิทิน</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(EVENT_TONE) as EventTone[]).map((t) => (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#E5457F]/40 ${
                        form.tone === t
                          ? 'border-[#263544] bg-[#263544] font-semibold text-white'
                          : 'border-[#D5D9E0] text-[#5B6472] hover:border-[#9AA3AF]'
                      }`}
                    >
                      <input type="radio" name="tone" value={t} checked={form.tone === t} onChange={() => set('tone', t)} className="sr-only" />
                      <span className={`h-3 w-3 rounded-full ring-1 ring-white/70 ${EVENT_TONE[t].dot}`} />
                      {EVENT_TONE[t].label}
                    </label>
                  ))}
                </div>
                {/* ตัวอย่างป้ายงานบนปฏิทินลูกค้า */}
                <p className="mt-2.5 flex items-center gap-2 text-xs text-[#6B7280]">
                  ตัวอย่าง
                  <span className={`min-w-0 truncate rounded-md px-2 py-0.5 font-medium ${EVENT_TONE[form.tone].chip}`}>
                    {form.name.trim() || 'ชื่องาน'}
                  </span>
                </p>
              </fieldset>
            </div>
          </Panel>
        </div>
      </div>

      {/* แถบปุ่มติดขอบล่างจอ — ฟอร์มยาวแค่ไหนก็กดบันทึกได้ */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-wrap items-center gap-3 border-t border-[#E4E3EA] bg-white/95 px-5 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
        {event && (
          <button
            type="button"
            onClick={remove}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[#B42318] hover:bg-[#FDE8E8]"
          >
            <TrashIcon size={16} />
            ลบงาน
          </button>
        )}
        <p
          role="status"
          aria-live="polite"
          className={`ml-auto flex min-w-0 items-center gap-1.5 text-sm ${message?.tone === 'error' ? 'text-[#B42318]' : 'text-[#2E7D4F]'}`}
        >
          {message?.tone === 'ok' && <CheckCircleIcon size={16} weight="fill" className="flex-shrink-0" />}
          {message?.text}
        </p>
        <button type="submit" disabled={saving || uploading} className={primaryButtonClass}>
          {saving ? 'กำลังบันทึก…' : event ? 'บันทึกการแก้ไข' : 'เพิ่มงาน'}
        </button>
      </div>
    </form>
  )
}

// รูปจากลูกค้าในงานที่จบแล้ว — ซ่อนรูปที่ไม่เหมาะสมได้ (ไม่ลบ ย้อนกลับได้)
export function PhotoModeration({ eventId }: { eventId: string }) {
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
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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
