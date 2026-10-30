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
  INVALID_RENTAL_DAYS: 'จำนวนวันเช่าไม่ถูกต้อง กรุณากลับไปเลือกจำนวนวันใหม่',
  ORDER_ROUND_MISMATCH: 'ออเดอร์เดียวต้องใช้วันใส่และจำนวนวันเช่าเดียวกัน รายการวันอื่นกรุณาจองเป็นออเดอร์ใหม่',
  INVALID_DELIVERY_METHOD: 'วิธีรับชุดไม่ถูกต้อง กรุณาเลือกใหม่',
  INVALID_ADDRESS: 'กรุณากรอกที่อยู่จัดส่งให้ครบ',
  HANDOVER_TO_REQUIRED: 'กรอกชื่อผู้มารับชุดก่อนยืนยันส่งมอบ',
  ORDER_NOT_FOUND: 'ไม่พบออเดอร์นี้',
  INVALID_TRANSITION: 'เปลี่ยนสถานะนี้ไม่ได้ สถานะออเดอร์อาจถูกเปลี่ยนไปแล้ว ลองรีเฟรชหน้า',
  NOT_ADMIN: 'บัญชีนี้ไม่มีสิทธิ์แอดมิน',
  INVALID_REFUND_ACCOUNT: 'ข้อมูลบัญชีรับเงินมัดจำคืนไม่ครบหรือเลขบัญชีไม่ถูกต้อง',
  REVIEW_NOT_ALLOWED: 'รีวิวได้หลังจบการเช่าแล้วเท่านั้น (ร้านตรวจรับชุดคืนเรียบร้อย)',
  ALREADY_REVIEWED: 'คุณรีวิวรายการเช่านี้ไปแล้ว',
  INVALID_REVIEW: 'ข้อมูลรีวิวไม่ถูกต้อง กรุณาตรวจคะแนน ส่วนสูง หรือรูปภาพอีกครั้ง',
  NO_REFUND_DUE: 'ออเดอร์นี้ไม่มียอดที่ต้องคืนเงิน',
  INVALID_REFUND_STATUS: 'สถานะการคืนเงินไม่ถูกต้อง',
  INVALID_PIECES: 'บางชิ้นที่เลือกไม่เปิดให้เช่าแยกแล้ว กรุณากลับไปเลือกชิ้นใหม่',
  // Step 19 · รองเท้าที่มากับชุด
  SHOE_UNAVAILABLE: 'รองเท้าไซส์ที่เลือกเพิ่งถูกจองไปในช่วงนี้ กรุณาเลือกไซส์รองเท้าหรือวันใหม่',
  SHOE_SIZE_REQUIRED: 'กรุณาเลือกไซส์รองเท้าก่อน',
  INVALID_SHOE: 'รองเท้าที่เลือกไม่เปิดให้เช่าแล้ว กรุณากลับไปเลือกใหม่',
  // Step 20 · ลูกค้าเลือกขนส่ง
  INVALID_CARRIER: 'ขนส่งที่เลือกปิดให้บริการแล้ว กรุณารีเฟรชหน้าแล้วเลือกขนส่งใหม่',
  INVALID_TRACKING: 'เลขพัสดุหรือขนส่งไม่ถูกต้อง',
  SHIP_TRACKING_REQUIRED: 'กรุณากรอกเลขพัสดุก่อนกดจัดส่งแล้ว',
  RETURN_TRACKING_REQUIRED: 'ลูกค้ายังไม่ได้กรอกเลขพัสดุส่งคืน จึงยังยืนยันรับชุดคืนไม่ได้',
  // Step 17 · วงจรส่ง–รับ–คืน
  EVIDENCE_REQUIRED: 'ต้องมีรูปอย่างน้อย 1 รูปก่อนยืนยัน',
  INVALID_EVIDENCE_PATH: 'รูปที่อัปโหลดไม่ตรงกับออเดอร์นี้ ลองอัปโหลดใหม่',
  CHECKLIST_INCOMPLETE: 'ติ๊กเช็กลิสต์ของในกล่องให้ครบก่อนยืนยันส่งของ',
  INVALID_DEDUCTION: 'รายการหักมัดจำไม่ถูกต้อง ตรวจประเภทและจำนวนเงินอีกครั้ง',
  DEDUCTION_EXCEEDS_DEPOSIT: 'ยอดหักรวมเกินมัดจำ ลดยอดลง หรือเลือก "สูญหาย"',
  NOT_OVERDUE_ENOUGH: 'ยังไม่เลยกำหนดคืนนานพอที่จะยืนยันว่าสูญหาย',
  ISSUE_WINDOW_CLOSED: 'เลยเวลาแจ้งปัญหาหลังได้รับชุดแล้ว กรุณาติดต่อร้านทาง LINE',
  INVALID_NOTE: 'กรุณาอธิบายปัญหาอย่างน้อย 3 ตัวอักษร',
  // Step 25 · ยืนยันตัวตนด้วยรูปบัตรประชาชน
  ID_CARD_REQUIRED: 'เช่าครั้งแรกต้องส่งรูปบัตรประชาชนก่อน กรุณาอัปโหลดรูปบัตรในหน้านี้',
  ID_REVIEW_NO_TIME:
    'วันใช้งานใกล้เกินไปสำหรับการตรวจบัตรครั้งแรก กรุณาเลือกวันที่ไกลขึ้น หรือส่งรูปบัตรล่วงหน้าในหน้าบัญชีของฉัน',
  ID_CONSENT_REQUIRED: 'กรุณากดยินยอมให้ร้านเก็บรูปบัตรก่อน',
  ID_ALREADY_VERIFIED: 'บัญชีนี้ยืนยันตัวตนแล้ว ไม่ต้องส่งรูปบัตรใหม่',
  ID_CARD_FILE_MISSING: 'อัปโหลดรูปบัตรไม่สำเร็จ กรุณาลองใหม่',
  ID_CARD_IN_USE: 'ยังลบรูปบัตรไม่ได้ เพราะมีออเดอร์ที่ยังไม่จบ ลบได้หลังออเดอร์เสร็จสิ้น',
  ID_NOT_PENDING: 'บัตรนี้ถูกตรวจไปแล้ว ลองรีเฟรชหน้า',
  ID_REJECT_REASON_REQUIRED: 'กรุณาบอกเหตุผลที่ไม่อนุมัติ ลูกค้าจะได้ถ่ายใหม่ให้ถูก',
  INVALID_PRICING: 'ราคาหรือมัดจำไม่ถูกต้อง',
  PRODUCT_NOT_FOUND: 'ไม่พบชุดนี้ในระบบ',
  // Step 27 · แอดมินจัดการบัญชีสมาชิก
  MEMBER_REASON_REQUIRED: 'กรุณาใส่เหตุผลอย่างน้อย 3 ตัวอักษร',
  INVALID_MEMBER_ACTION: 'คำสั่งจัดการบัญชีไม่ถูกต้อง',
  CANNOT_CHANGE_SELF: 'เปลี่ยนสิทธิ์บัญชีของตัวเองไม่ได้',
  MEMBER_NOT_FOUND: 'ไม่พบสมาชิกนี้ในระบบ',
  admin_set_member: 'ยังไม่ได้รัน SQL Step 27 (cosmate_step27_member_admin.sql)',
  // Step 29 · รองเท้าที่ร้านจัดหาให้
  SHOE_SOURCING_PENDING: 'ยังมีรองเท้าที่รอจัดหา กด "จัดหาได้แล้ว" หรือ "หาไม่ได้" ด้านบนก่อน ยอดคืนเงินขึ้นกับข้อนี้',
  SHOE_SOURCING_LOCKED: 'ออเดอร์นี้จบแล้ว แก้สถานะจัดหารองเท้าไม่ได้ (ยอดคืนเงินคำนวณไปแล้ว)',
  SHOE_SOURCING_NOT_FOUND: 'รายการนี้ไม่มีรองเท้าที่ต้องจัดหา ลองรีเฟรชหน้า',
  SHOE_SOURCING_BAD_STATUS: 'สถานะจัดหารองเท้าไม่ถูกต้อง',
  admin_set_shoe_sourcing: 'ยังไม่ได้รัน SQL Step 29 (cosmate_step29_shoe_sourcing.sql)',
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
  return (
    !!message &&
    (message.includes('DATE_UNAVAILABLE') ||
      message.includes('SHOE_UNAVAILABLE') ||
      message.includes('START_DATE_TOO_SOON') ||
      message.includes('ID_REVIEW_NO_TIME') ||
      message.includes('ORDER_ROUND_MISMATCH') ||
      message.includes('INVALID_RENTAL_DAYS'))
  )
}
