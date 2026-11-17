// ป้ายสถานะออเดอร์ + ปุ่มเปลี่ยนสถานะของแอดมิน
// ADMIN_ACTIONS ต้องตรงกับวงจรที่อนุญาตใน admin_update_order_status() (cosmate_step6_order_status.sql)

export type OrderStatus =
  | 'pending_payment'
  | 'manual_review'
  | 'paid'
  | 'shipped'
  | 'active'
  | 'returned'
  | 'inspecting'
  | 'completed'
  | 'expired'
  | 'cancelled'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'รอชำระเงิน',
  manual_review: 'รอตรวจสอบการชำระ',
  paid: 'ชำระแล้ว รอจัดส่ง',
  shipped: 'จัดส่งแล้ว',
  active: 'กำลังใช้งานชุด',
  returned: 'ส่งชุดคืนแล้ว',
  inspecting: 'กำลังตรวจสภาพชุด',
  completed: 'เสร็จสิ้น',
  expired: 'หมดอายุ',
  cancelled: 'ยกเลิกแล้ว',
}

export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  pending_payment: 'bg-[#FFF3B0] text-[#263544]',
  manual_review: 'bg-[#EDE6FA] text-[#263544]',
  paid: 'bg-[#FDE3EE] text-[#E5457F]',
  shipped: 'bg-[#263544] text-white',
  active: 'bg-[#263544] text-white',
  returned: 'bg-[#EDE6FA] text-[#263544]',
  inspecting: 'bg-[#EDE6FA] text-[#263544]',
  completed: 'bg-[#E5457F] text-white',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-gray-100 text-gray-500',
}

// ขั้นตอนที่ลูกค้าเห็นบนหน้าออเดอร์ (returned กับ inspecting รวมเป็นขั้นเดียว)
export const CUSTOMER_STEPS: { label: string }[] = [
  { label: 'ชำระเงิน' },
  { label: 'ตรวจสอบยอด' },
  { label: 'เตรียมจัดส่ง' },
  { label: 'จัดส่งชุด' },
  { label: 'ใช้งานชุด' },
  { label: 'ส่งคืน/ตรวจสภาพ' },
  { label: 'เสร็จสิ้น' },
]

export function customerStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'pending_payment':
      return 0
    case 'manual_review':
      return 1
    case 'paid':
      return 2
    case 'shipped':
      return 3
    case 'active':
      return 4
    case 'returned':
    case 'inspecting':
      return 5
    case 'completed':
      return 6
    default:
      return -1 // cancelled / expired
  }
}

export type AdminAction = {
  to: OrderStatus
  label: string
  tone: 'primary' | 'secondary' | 'danger'
}

export const ADMIN_ACTIONS: Record<OrderStatus, AdminAction[]> = {
  pending_payment: [
    { to: 'paid', label: 'ยืนยันชำระแล้ว', tone: 'primary' },
    { to: 'expired', label: 'หมดอายุ', tone: 'secondary' },
    { to: 'cancelled', label: 'ยกเลิก', tone: 'danger' },
  ],
  manual_review: [
    { to: 'paid', label: 'ยืนยันการชำระเงิน', tone: 'primary' },
    { to: 'pending_payment', label: 'ตีกลับให้ชำระใหม่', tone: 'secondary' },
    { to: 'cancelled', label: 'ยกเลิก', tone: 'danger' },
  ],
  paid: [
    { to: 'shipped', label: 'จัดส่งแล้ว', tone: 'primary' },
    { to: 'cancelled', label: 'ยกเลิก', tone: 'danger' },
  ],
  shipped: [{ to: 'active', label: 'ลูกค้าได้รับชุดแล้ว', tone: 'primary' }],
  active: [{ to: 'returned', label: 'ได้รับชุดคืนแล้ว', tone: 'primary' }],
  returned: [{ to: 'inspecting', label: 'เริ่มตรวจสภาพ', tone: 'primary' }],
  inspecting: [{ to: 'completed', label: 'ตรวจผ่าน ปิดออเดอร์', tone: 'primary' }],
  completed: [],
  expired: [],
  cancelled: [],
}
