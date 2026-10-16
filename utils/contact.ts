// utils/contact.ts

export const LINE_OA_ID = process.env.NEXT_PUBLIC_LINE_OA_ID ?? '@175sthvv'

/** เวลาที่แอดมินตอบแชท แสดงในป๊อปอัป ให้ลูกค้ารู้ว่าจะได้คำตอบเมื่อไหร่ */
export const LINE_REPLY_HOURS = 'ทุกวัน 10:30–20:00 น.'

/** ลิงก์เพิ่มเพื่อน LINE OA */
export function lineAddFriendUrl(): string {
  return `https://line.me/R/ti/p/${encodeURIComponent(LINE_OA_ID)}`
}

/**
 * ลิงก์เปิดแชทกับ LINE OA พร้อมพิมพ์ข้อความไว้ให้ (ลูกค้ากดส่งเอง)
 * รูปแบบตามเอกสาร LINE: https://line.me/R/oaMessage/{LINE ID}/?{ข้อความ}
 */
export function lineChatUrl(message?: string): string {
  const base = `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA_ID)}/`
  return message ? `${base}?${encodeURIComponent(message)}` : base
}