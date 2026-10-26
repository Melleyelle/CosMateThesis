'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CameraIcon, CaretLeftIcon, CaretRightIcon, ImageSquareIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import { loginHref, useAuthUser } from '@/utils/customer/authUser'
import {
  deleteMyEventPhoto,
  fetchEventPhotos,
  MAX_PHOTOS_PER_USER,
  uploadEventPhoto,
  type EventPhoto,
} from '@/utils/customer/events'
import { formatDateTime } from '@/utils/dateUtils'

// แกลเลอรีรูปจากงานที่จบแล้ว: ทุกคนดูได้ · สมาชิกอัปโหลดรูปตัวเองได้สูงสุด 6 รูปต่องาน
export default function EventPhotos({ eventId, canUpload }: { eventId: string; canUpload: boolean }) {
  const { userId, ready } = useAuthUser()
  const [photos, setPhotos] = useState<EventPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<number | null>(null)

  const reload = useCallback(() => {
    fetchEventPhotos(eventId).then((rows) => {
      setPhotos(rows)
      setLoading(false)
    })
  }, [eventId])

  // ผู้ใช้ล็อกอิน/ออก → โหลดใหม่ ให้เห็นรูปของตัวเองที่ถูกซ่อน (RLS ต่างกันตามคน)
  useEffect(() => {
    reload()
  }, [reload, userId])

  const visible = photos.filter((p) => !p.isHidden || p.userId === userId)
  const myCount = photos.filter((p) => p.userId === userId).length

  async function handleDelete(photo: EventPhoto) {
    if (!confirm('ลบรูปนี้ออกจากงาน?')) return
    const { error } = await deleteMyEventPhoto(photo)
    if (error) alert(`ลบไม่สำเร็จ: ${error}`)
    else setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
  }

  return (
    <section id="photos" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-h2 font-bold text-ink">รูปจากงาน</h2>
          <p className="mt-1 text-body-sm text-secondary">
            {loading ? 'กำลังโหลด…' : visible.length > 0 ? `${visible.length} รูปจากสมาชิก CosMate` : 'มาอวดลุคของคุณในงานนี้กัน'}
          </p>
        </div>
      </div>

      {canUpload && ready && (
        userId ? (
          <UploadBox eventId={eventId} remaining={MAX_PHOTOS_PER_USER - myCount} onUploaded={reload} />
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card bg-sunken p-4">
            <p className="text-body text-ink">ไปงานนี้มาเหมือนกัน? เข้าสู่ระบบเพื่ออัปโหลดรูปของคุณ</p>
            <Link
              href={loginHref(`/events/${eventId}#photos`)}
              className="lift focus-ring inline-flex min-h-11 items-center rounded-full border border-line bg-brand px-5 text-body font-bold text-white active:bg-brand-strong"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        )
      )}

      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-sunken" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-5 flex flex-col items-center px-6 py-10 text-center">
          <ImageSquareIcon size={36} className="text-muted" aria-hidden />
          <p className="mt-2 text-h3 font-semibold text-ink">ยังไม่มีรูปจากงานนี้</p>
          {canUpload && <p className="mt-1 text-body-sm text-secondary">เป็นคนแรกที่อัปโหลดรูปจากงานนี้</p>}
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-card border border-line bg-surface">
              <button
                type="button"
                onClick={() => setViewer(i)}
                className="focus-ring group relative block aspect-[4/5] w-full overflow-hidden border-b border-line bg-sunken"
                aria-label={`ดูรูปของ ${p.uploaderName}`}
              >
                <img
                  src={p.url}
                  alt={p.caption ?? `รูปจากงานโดย ${p.uploaderName}`}
                  loading="lazy"
                  className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${p.isHidden ? 'opacity-40' : ''}`}
                />
                {p.isHidden && (
                  <span className="absolute inset-x-2 top-2 rounded-full border border-line bg-surface px-2 py-0.5 text-center text-caption font-semibold text-danger">
                    ร้านซ่อนรูปนี้ไว้ เห็นแค่คุณ
                  </span>
                )}
              </button>
              <div className="flex items-start justify-between gap-2 p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">{p.uploaderName}</p>
                  {p.caption && <p className="line-clamp-2 text-caption text-secondary">{p.caption}</p>}
                </div>
                {p.userId === userId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    aria-label="ลบรูปของฉัน"
                    className="focus-ring flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-secondary hover:bg-sunken hover:text-danger"
                  >
                    <TrashIcon size={16} aria-hidden />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewer !== null && visible[viewer] && (
        <Lightbox photos={visible} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
      )}
    </section>
  )
}

function UploadBox({ eventId, remaining, onUploaded }: { eventId: string; remaining: number; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([])
  const [caption, setCaption] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)

  // คืนหน่วยความจำของรูปตัวอย่างตอนออกจากหน้า (ตัวที่ถูกเอาออกระหว่างทางคืนทันทีใน removeFile)
  const filesRef = useRef(files)
  useEffect(() => {
    filesRef.current = files
  }, [files])
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), [])

  function removeFile(i: number) {
    URL.revokeObjectURL(files[i].preview)
    setFiles((prev) => prev.filter((_, j) => j !== i))
  }

  function pick(list: FileList | null) {
    if (!list) return
    const room = remaining - files.length
    const picked = Array.from(list).slice(0, Math.max(0, room))
    setFiles((prev) => [...prev, ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
    setMessage(list.length > room ? { tone: 'error', text: `เลือกได้อีก ${Math.max(0, room)} รูป` } : null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function submit() {
    if (files.length === 0) return
    setBusy(true)
    setMessage(null)
    const failed: string[] = []
    for (const f of files) {
      const { error } = await uploadEventPhoto({ eventId, file: f.file, caption, anonymous })
      if (error) failed.push(`${f.file.name}: ${error}`)
    }
    setBusy(false)
    files.forEach((f) => URL.revokeObjectURL(f.preview))
    setFiles([])
    setCaption('')
    onUploaded()
    setMessage(
      failed.length
        ? { tone: 'error', text: `อัปโหลดไม่สำเร็จ ${failed.length} รูป — ${failed[0]}` }
        : { tone: 'ok', text: 'อัปโหลดรูปเรียบร้อย ขอบคุณที่มาแชร์!' },
    )
  }

  if (remaining <= 0) {
    return (
      <p className="mt-4 rounded-card bg-sunken p-4 text-body-sm text-secondary">
        คุณอัปโหลดครบ {MAX_PHOTOS_PER_USER} รูปสำหรับงานนี้แล้ว ลบรูปเดิมก่อนถ้าอยากเปลี่ยน
      </p>
    )
  }

  return (
    <div className="mt-4 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || files.length >= remaining}
          className="lift focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-body font-semibold text-ink disabled:opacity-40"
        >
          <CameraIcon size={20} aria-hidden />
          เลือกรูป
        </button>
        <span className="text-body-sm text-secondary">
          เหลืออีก {remaining - files.length} รูป · JPG, PNG, WEBP (ระบบย่อรูปให้อัตโนมัติ)
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => pick(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <>
          <ul className="mt-4 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={f.preview} className="relative h-20 w-16 overflow-hidden rounded-control border border-line">
                <img src={f.preview} alt="" className="h-full w-full object-cover" />
                {!busy && (
                  <button
                    type="button"
                    aria-label="เอารูปนี้ออก"
                    onClick={() => removeFile(i)}
                    className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface"
                  >
                    <XIcon size={12} weight="bold" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <label className="mt-4 block">
            <span className="text-body-sm font-semibold text-ink">คำบรรยาย (ไม่บังคับ)</span>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 200))}
              placeholder="เช่น คอสเป็นใคร จากเรื่องอะไร"
              className="mt-1 h-11 w-full rounded-control border border-line bg-surface px-3 text-body outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-body-sm text-ink">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-[#E4487D]" />
            ไม่แสดงชื่อของฉัน
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="lift focus-ring mt-4 inline-flex min-h-11 items-center rounded-full border border-line bg-brand px-5 text-body font-bold text-white active:bg-brand-strong disabled:opacity-40"
          >
            {busy ? 'กำลังอัปโหลด…' : `อัปโหลด ${files.length} รูป`}
          </button>
        </>
      )}

      {message && (
        <p role="status" className={`mt-3 text-body-sm ${message.tone === 'error' ? 'text-danger' : 'text-success'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: EventPhoto[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const p = photos[index]
  const prev = () => onIndex((index - 1 + photos.length) % photos.length)
  const next = () => onIndex((index + 1) % photos.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length)
      if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, photos.length, onIndex, onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ดูรูปจากงาน"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div className="relative flex max-h-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <img src={p.url} alt={p.caption ?? ''} className="max-h-[78vh] w-auto rounded-card object-contain" />
        <div className="mt-3 text-center text-white">
          <p className="font-semibold">{p.uploaderName}</p>
          {p.caption && <p className="text-body-sm text-white/80">{p.caption}</p>}
          <p className="text-caption text-white/60">{formatDateTime(p.createdAt)}</p>
        </div>
      </div>
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
        <XIcon size={22} />
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="รูปก่อนหน้า"
            onClick={(e) => {
              e.stopPropagation()
              prev()
            }}
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <CaretLeftIcon size={22} />
          </button>
          <button
            type="button"
            aria-label="รูปถัดไป"
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <CaretRightIcon size={22} />
          </button>
        </>
      )}
    </div>
  )
}
