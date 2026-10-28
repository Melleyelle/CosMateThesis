// เทมเพลตอีเมล "โอนเงินคืนสำเร็จ" — คืนมัดจำหลังตรวจสภาพ หรือคืนเงินจากออเดอร์ที่ถูกยกเลิก
import { baht, emailLayout, escapeHtml, orderUrlOf, row } from './layout';

export type RefundedEmailData = {
  customerName: string;
  orderNumber: string;
  orderId: string;
  amount: number;
  cancelled: boolean; // คืนเงินจากการยกเลิก (ไม่ใช่คืนมัดจำ)
  bank: string | null;
  accountMasked: string | null;
  transferredAt: string | null; // จัดรูปแบบแล้ว
};

export function refundedEmail(d: RefundedEmailData) {
  const orderUrl = orderUrlOf(d.orderId);
  const what = d.cancelled ? 'เงินคืนจากการยกเลิกออเดอร์' : 'มัดจำ';
  const subject = `CosMate: โอน${what}ออเดอร์ ${d.orderNumber} คืนแล้ว ${baht(d.amount)}`;

  const html = emailLayout({
    heading: `โอน${what}คืนเรียบร้อยแล้ว`,
    intro: `สวัสดีคุณ ${escapeHtml(d.customerName)} ร้านโอน${what}คืนเข้าบัญชีของคุณแล้ว
      ${d.cancelled ? '' : 'ขอบคุณที่เช่าชุดกับ CosMate ฝากรีวิวชุดได้ที่หน้าออเดอร์'}`,
    rows: [
      row('เลขออเดอร์', escapeHtml(d.orderNumber)),
      row('ยอดที่โอน', baht(d.amount)),
      d.bank && d.accountMasked ? row('เข้าบัญชี', `${escapeHtml(d.bank)} ${escapeHtml(d.accountMasked)}`) : '',
      d.transferredAt ? row('โอนเมื่อ', escapeHtml(d.transferredAt)) : '',
    ],
    orderUrl,
    buttonLabel: d.cancelled ? 'ดูรายละเอียดออเดอร์' : 'ดูออเดอร์และรีวิวชุด',
  });

  const text = [
    `สวัสดีคุณ ${d.customerName}`,
    `ร้านโอน${what}ออเดอร์ ${d.orderNumber} คืนแล้ว ${baht(d.amount)}`,
    d.bank && d.accountMasked ? `เข้าบัญชี: ${d.bank} ${d.accountMasked}` : '',
    orderUrl ? `ดูออเดอร์: ${orderUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
