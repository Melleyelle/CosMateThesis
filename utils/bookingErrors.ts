// แปลงรหัส error จากฟังก์ชันในฐานข้อมูล (raise exception '...') เป็นข้อความภาษาไทยสำหรับผู้ใช้
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'กรุณาเข้าสู่ระบบก่อนทำรายการ',
  ACCOUNT_NOT_ALLOWED: 'บัญชีนี้ไม่สามารถจองชุดได้ในขณะนี้ กรุณาติดต่อร้าน',
  INVALID_ITEMS: 'ข้อมูลรายการเช่าไม่ถูกต้อง กรุณาเลือกชุดใหม่อีกครั้ง',
  TOO_MANY_PENDING_ORDERS:
    'คุณมีออเดอร์ที่ยังไม่ได้ชำระเงินครบจำนวนที่กำหนดแล้ว กรุณาชำระเงินหรือยกเลิกออเดอร์เดิมก่อน',
  VARIANT_NOT_FOUND: 'ชุดหรือไซส์นี้ปิดให้เช่าแล้ว กรุณาเลือกชุดอื่น',
  START_DATE_TOO_SOON: 'วันที่เลือกกระชั้นเกินไป กรุณาเลือกวันที่ไกลกว่านี้',
  DATE_UNAVAILABLE: 'วันที่เลือกเพิ่งถูกจองไป กรุณากลับไปเลือกวันใหม่',
  ORDER_NOT_FOUND: 'ไม่พบออเดอร์นี้',
  INVALID_TRANSITION: 'เปลี่ยนสถานะนี้ไม่ได้ สถานะออเดอร์อาจถูกเปลี่ยนไปแล้ว ลองรีเฟรชหน้า',
  NOT_ADMIN: 'บัญชีนี้ไม่มีสิทธิ์แอดมิน',
  INVALID_REFUND_ACCOUNT: 'ข้อมูลบัญชีรับเงินมัดจำคืนไม่ครบหรือเลขบัญชีไม่ถูกต้อง',
  REVIEW_NOT_ALLOWED: 'รีวิวได้หลังจบการเช่าแล้วเท่านั้น (ร้านตรวจรับชุดคืนเรียบร้อย)',
  ALREADY_REVIEWED: 'คุณรีวิวรายการเช่านี้ไปแล้ว',
  INVALID_REVIEW: 'ข้อมูลรีวิวไม่ถูกต้อง กรุณาตรวจคะแนน ส่วนสูง หรือรูปภาพอีกครั้ง',
  NO_REFUND_DUE: 'ออเดอร์นี้ไม่มียอดที่ต้องคืนเงิน',
  INVALID_REFUND_STATUS: 'สถานะการคืนเงินไม่ถูกต้อง',
}

export function translateRpcError(message: string | null | undefined): string {
  if (!message) return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (message.includes(code)) return text
  }
  return `เกิดข้อผิดพลาด: ${message}`
}

// ใช้เช็คว่าต้องพาลูกค้ากลับไปเลือกวันใหม่หรือไม่
export function isDateProblem(message: string | null | undefined): boolean {
  return !!message && (message.includes('DATE_UNAVAILABLE') || message.includes('START_DATE_TOO_SOON'))
}
