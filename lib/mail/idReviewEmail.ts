// เทมเพลตอีเมล "ผลตรวจบัตรประชาชน" (Step 25) — อนุมัติ = แจ้งให้ชำระเงินพร้อมเส้นตาย · ไม่อนุมัติ = เหตุผล + ออเดอร์ที่ถูกยกเลิก
import { DANGER, MUTED, emailLayout, escapeHtml, orderUrlOf, row } from './layout';

export type IdReviewOrder = {
  id: string;
  orderNumber: string;
  status: 'pending_payment' | 'cancelled' | 'expired';
  payBy: string | null; // ISO
};

export type IdReviewEmailData = {
  customerName: string;
  approved: boolean;
  reason: string | null;
  orders: IdReviewOrder[];
};

// เซิร์ฟเวอร์อยู่ UTC → ระบุเวลาไทยเอง
function bangkokDateTime(iso: string) {
  return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
}

export function idReviewEmail(d: IdReviewEmailData) {
  const toPay = d.orders.filter((o) => o.status === 'pending_payment');
  const closed = d.orders.filter((o) => o.status !== 'pending_payment');
  const first = toPay[0] ?? d.orders[0];
  const orderUrl = first ? orderUrlOf(first.id) : null;
  const name = escapeHtml(d.customerName);

  const subject = d.approved
    ? toPay.length
      ? `CosMate: ยืนยันตัวตนแล้ว ชำระเงินออเดอร์ ${toPay.map((o) => o.orderNumber).join(', ')}`
      : 'CosMate: ยืนยันตัวตนเรียบร้อยแล้ว'
    : 'CosMate: รูปบัตรประชาชนไม่ผ่านการตรวจ';

  const rows = d.approved
    ? toPay.map((o) => row(escapeHtml(o.orderNumber), o.payBy ? `ชำระภายใน ${escapeHtml(bangkokDateTime(o.payBy))}` : 'ชำระได้แล้ว'))
    : [row('เหตุผล', escapeHtml(d.reason ?? '—'))];

  const closedNote = closed.length
    ? `<p style="margin:16px 0 0;font-size:14px;color:${d.approved ? MUTED : DANGER}">
        ${d.approved ? 'ออเดอร์ที่ใกล้วันรับชุดเกินไปถูกปล่อยชุดคืนแล้ว' : 'ออเดอร์ที่ถูกยกเลิก'}:
        ${closed.map((o) => escapeHtml(o.orderNumber)).join(', ')}
      </p>`
    : '';

  const html = emailLayout({
    heading: d.approved ? 'ยืนยันตัวตนเรียบร้อย' : 'รูปบัตรยังใช้ไม่ได้',
    intro: d.approved
      ? `สวัสดีคุณ ${name} ร้านตรวจบัตรประชาชนของคุณแล้ว ครั้งต่อไปจองและชำระเงินได้ทันที
        ${toPay.length ? '<b>ชำระเงินภายในเวลาด้านล่าง</b> ไม่งั้นชุดจะถูกปล่อยให้คนอื่นจอง' : ''}`
      : `สวัสดีคุณ ${name} ร้านยังยืนยันตัวตนจากรูปที่ส่งมาไม่ได้ และลบรูปนั้นแล้ว
        ส่งรูปใหม่ได้ที่หน้า "บัญชีของฉัน" แล้วจองใหม่ได้เลย`,
    rows,
    after: closedNote,
    orderUrl: toPay.length || !d.approved ? orderUrl : null,
    buttonLabel: d.approved ? 'ไปชำระเงิน' : 'ดูออเดอร์',
  });

  const text = [
    `สวัสดีคุณ ${d.customerName}`,
    d.approved ? 'ร้านตรวจบัตรประชาชนของคุณแล้ว' : `รูปบัตรไม่ผ่านการตรวจ: ${d.reason ?? '—'}`,
    ...toPay.map((o) => `${o.orderNumber}: ชำระภายใน ${o.payBy ? bangkokDateTime(o.payBy) : '—'}`),
    closed.length ? `${d.approved ? 'ปล่อยชุดคืนแล้ว' : 'ยกเลิกแล้ว'}: ${closed.map((o) => o.orderNumber).join(', ')}` : '',
    d.approved ? '' : 'ส่งรูปใหม่ได้ที่หน้า "บัญชีของฉัน"',
    orderUrl ? `ดูออเดอร์: ${orderUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
