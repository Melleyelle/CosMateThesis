import type { OrderStatus } from '@/utils/orderStatus'

// สีสถานะฝั่งแอดมิน: สื่อว่า "ใครต้องลงมือ" ไม่ใช่แค่ตกแต่ง และแยกจากสีชมพูของแบรนด์
//   action   = ร้านต้องทำอะไรตอนนี้ (ตรวจสลิป / แพ็กส่ง / ตรวจสภาพ)
//   waiting  = รอลูกค้า
//   progress = ชุดอยู่ระหว่างทาง/อยู่กับลูกค้า
//   done     = จบแล้ว
//   closed   = ปิดโดยไม่สำเร็จ (ยกเลิก/หมดอายุ)
//   problem  = มีปัญหา เช่น คืนช้า
// ทุกคู่สีผ่านคอนทราสต์ตัวอักษร ≥ 4.5:1 และใช้คู่กับข้อความเสมอ (ไม่ใช้สีอย่างเดียว)

export type Tone = 'action' | 'waiting' | 'progress' | 'done' | 'closed' | 'problem'

export const TONE_CLASS: Record<Tone, string> = {
  action: 'bg-[#FFF1D6] text-[#875200] ring-[#F2D49B]',
  waiting: 'bg-white text-[#56606E] ring-[#D5D9E0]',
  progress: 'bg-[#E4EFFB] text-[#1D5FA8] ring-[#BFD6F2]',
  done: 'bg-[#E3F5EA] text-[#1B6E45] ring-[#B8E2C8]',
  closed: 'bg-[#EEF0F3] text-[#56606E] ring-[#DADEE4]',
  problem: 'bg-[#FDE8E8] text-[#B42318] ring-[#F5C2C0]',
}

export const TONE_DOT: Record<Tone, string> = {
  action: 'bg-[#E59A00]',
  waiting: 'bg-[#9AA3AF]',
  progress: 'bg-[#2F7FD6]',
  done: 'bg-[#2E9E62]',
  closed: 'bg-[#B4BAC4]',
  problem: 'bg-[#D92D20]',
}

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  pending_payment: 'waiting',
  manual_review: 'action',
  paid: 'action',
  shipped: 'progress',
  active: 'progress',
  returned: 'action',
  inspecting: 'action',
  completed: 'done',
  expired: 'closed',
  cancelled: 'closed',
}

// ชื่อสถานะแบบสั้นสำหรับแอดมิน (บอกงานที่ต้องทำ)
export const ADMIN_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'รอลูกค้าชำระ',
  manual_review: 'ตรวจยอดชำระ',
  paid: 'รอแพ็กส่ง',
  shipped: 'กำลังจัดส่ง',
  active: 'อยู่กับลูกค้า',
  returned: 'รอตรวจสภาพ',
  inspecting: 'กำลังตรวจสภาพ',
  completed: 'เสร็จสิ้น',
  expired: 'หมดอายุ',
  cancelled: 'ยกเลิก',
}
