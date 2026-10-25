'use client'

// ถ่ายรูปจากกล้องโน๊ตบุ๊ค/เว็บแคมผ่านเบราว์เซอร์ (getUserMedia) ถ่ายต่อกันได้หลายรูปโดยไม่ต้องปิดหน้าต่าง
// ทุกรูปส่งเป็น File ให้ onCapture → ใช้ทางอัปโหลด (ย่อ + อัปโหลด) เดียวกับการเลือกไฟล์

import { useEffect, useRef, useState } from 'react'
import { CameraIcon, XIcon } from '@phosphor-icons/react'
import { primaryButtonClass, secondaryButtonClass } from '@/app/components/admin/ui'

type Props = {
  remaining: number
  busy: boolean
  onCapture: (file: File) => void
  onClose: () => void
}

function cameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'เบราว์เซอร์ไม่ได้รับอนุญาตให้ใช้กล้อง กดไอคอนกล้องที่แถบที่อยู่เพื่ออนุญาต แล้วลองใหม่'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'ไม่พบกล้องในเครื่องนี้'
  if (name === 'NotSupportedError') return 'เบราว์เซอร์นี้ใช้กล้องไม่ได้ (ต้องเปิดเว็บผ่าน https หรือ localhost)'
  if (name === 'NotReadableError') return 'กล้องถูกใช้งานโดยโปรแกรมอื่นอยู่ (เช่น Zoom, Teams) ปิดโปรแกรมนั้นก่อนแล้วลองใหม่'
  return 'เปิดกล้องไม่สำเร็จ'
}

export default function WebcamCapture({ remaining, busy, onCapture, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [requested, setRequested] = useState('') // กล้องที่ขอเปิด ('' = ให้เบราว์เซอร์เลือก)
  const [active, setActive] = useState('') // กล้องที่เปิดอยู่จริง
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [shots, setShots] = useState(0)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // เปิดกล้อง (หรือสลับกล้อง) → ปิดสตรีมเก่าทุกครั้ง ไม่ให้ไฟกล้องค้าง
  useEffect(() => {
    let stream: MediaStream | null = null
    let alive = true
    const open = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({
          video: { ...(requested ? { deviceId: { exact: requested } } : {}), width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
      : Promise.reject(new DOMException('', 'NotSupportedError'))
    open
      .then(async (s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          await videoRef.current.play().catch(() => {})
        }
        setReady(true)
        setActive(s.getVideoTracks()[0]?.getSettings().deviceId ?? '')
        // ชื่อกล้องอ่านได้หลังได้รับอนุญาตแล้วเท่านั้น
        const all = await navigator.mediaDevices.enumerateDevices()
        if (alive) setDevices(all.filter((d) => d.kind === 'videoinput'))
      })
      .catch((err) => alive && setError(cameraError(err)))
    return () => {
      alive = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [requested])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth || remaining <= 0) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' }))
        setShots((n) => n + 1)
        setFlash(true)
        setTimeout(() => setFlash(false), 150)
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      aria-label="ถ่ายรูปจากกล้อง"
      className="m-auto w-[min(720px,calc(100vw-32px))] overflow-hidden rounded-card border border-line bg-white p-0 backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
        <h2 className="font-semibold text-ink">ถ่ายรูปจากกล้อง</h2>
        <button type="button" onClick={onClose} aria-label="ปิดกล้อง" className="rounded-full p-1.5 text-ink hover:bg-sunken">
          <XIcon size={18} weight="bold" />
        </button>
      </div>

      <div className="relative aspect-video bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
        {flash && <div className="absolute inset-0 bg-white/70" />}
        {!ready && !error && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">กำลังเปิดกล้อง…</p>}
        {error && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-medium text-white">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm text-secondary">
          {devices.length > 1 && (
            <select
              value={active}
              onChange={(e) => {
                setReady(false)
                setError(null)
                setRequested(e.target.value)
              }}
              aria-label="เลือกกล้อง"
              className="h-10 max-w-[240px] rounded-control border border-line bg-white px-2 text-sm text-ink"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `กล้อง ${i + 1}`}
                </option>
              ))}
            </select>
          )}
          <span>
            {busy ? 'กำลังอัปโหลด…' : shots > 0 ? `ถ่ายแล้ว ${shots} รูป` : 'จัดของให้อยู่ในกรอบแล้วกดถ่าย'}
            {remaining > 0 ? ` · ถ่ายได้อีก ${remaining} รูป` : ' · ครบจำนวนแล้ว'}
          </span>
        </div>
          <button type="button" onClick={capture} disabled={!ready || remaining <= 0} className={primaryButtonClass} autoFocus>
            <CameraIcon size={18} weight="fill" />
            ถ่ายรูป
          </button>
      </div>
    </dialog>
  )
}
