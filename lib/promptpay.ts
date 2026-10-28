// สร้างข้อความ QR พร้อมเพย์ (Thai QR / EMVCo) แบบฝังยอด — ไม่ต้องเรียก API
// ลูกค้าสแกนแล้วแอปธนาคารขึ้นชื่อบัญชี + ยอดให้เลย พิมพ์ยอดเองไม่ได้ → ยอดในสลิปตรงกับออเดอร์
// รองรับเฉพาะพร้อมเพย์เบอร์โทร (ประเภทบัญชี 02001 ของ Slip2Go)

const PROMPTPAY_AID = 'A000000677010111';

function field(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) ตามสเปก EMVCo */
function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** เบอร์ 08xxxxxxxx → 0066 8xxxxxxxx (13 หลัก) คืน null ถ้าไม่ใช่เบอร์มือถือ 10 หลัก */
function phoneTarget(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  if (!/^0\d{9}$/.test(d)) return null;
  return '0066' + d.slice(1);
}

export function promptPayPayload(phone: string, amount: number): string | null {
  const target = phoneTarget(phone);
  if (!target || !Number.isFinite(amount) || amount <= 0) return null;

  const body =
    field('00', '01') +
    field('01', '12') + // 12 = QR ใช้ครั้งเดียว (มียอด)
    field('29', field('00', PROMPTPAY_AID) + field('01', target)) +
    field('53', '764') + // THB
    field('54', amount.toFixed(2)) +
    field('58', 'TH') +
    '6304';
  return body + crc16(body);
}
