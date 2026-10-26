// ย่อรูปฝั่งเบราว์เซอร์ก่อนอัปโหลด (ด้านยาวไม่เกิน maxSide px, JPEG) — รูปมือถือ 5–10 MB เหลือราว 300 KB
// ถ้าเบราว์เซอร์ย่อไม่ได้ (เช่น HEIC บางเครื่อง) คืนไฟล์เดิมให้ bucket เป็นคนตรวจชนิด/ขนาดแทน
export async function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
    return blob ?? file
  } catch {
    return file
  }
}
