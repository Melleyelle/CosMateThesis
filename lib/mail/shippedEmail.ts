// เทมเพลตอีเมล "จัดส่งชุดแล้ว"
import { BRAND, MUTED, emailLayout, escapeHtml, orderUrlOf, row } from './layout';

export type ShippedEmailData = {
  customerName: string;
  orderNumber: string;
  orderId: string;
  carrierName: string;
  trackingNo: string;
  productNames: string[];
  returnBy: string | null; // วันที่ต้องส่งคืน (จัดรูปแบบแล้ว)
};

export function shippedEmail(d: ShippedEmailData) {
  const orderUrl = orderUrlOf(d.orderId);
  const subject = `CosMate: จัดส่งชุดออเดอร์ ${d.orderNumber} แล้ว`;

  const items = d.productNames.map((n) => `<li style="margin:0 0 4px">${escapeHtml(n)}</li>`).join('');
  const html = emailLayout({
    heading: 'ชุดของคุณออกเดินทางแล้ว',
    intro: `สวัสดีคุณ ${escapeHtml(d.customerName)} ร้านจัดส่งชุดในออเดอร์ของคุณแล้ว
        เมื่อได้รับ <b>ลองใส่ทันที</b> ถ้าไซส์ไม่ได้หรือชุดมีปัญหา แจ้งร้านภายในวันนั้น`,
    rows: [
      row('เลขออเดอร์', escapeHtml(d.orderNumber)),
      row('ขนส่ง', escapeHtml(d.carrierName)),
      row('เลขพัสดุ', `<span style="color:${BRAND};font-size:17px">${escapeHtml(d.trackingNo)}</span>`),
      d.returnBy ? row('ส่งชุดคืนภายใน', escapeHtml(d.returnBy)) : '',
    ],
    after: items
      ? `<p style="margin:16px 0 6px;font-size:14px;color:${MUTED}">ชุดในออเดอร์นี้</p><ul style="margin:0;padding-left:20px;font-size:15px">${items}</ul>`
      : '',
    orderUrl,
    buttonLabel: 'ดูออเดอร์และติดตามพัสดุ',
  });

  const text = [
    `สวัสดีคุณ ${d.customerName}`,
    `ร้านจัดส่งชุดออเดอร์ ${d.orderNumber} แล้ว`,
    `ขนส่ง: ${d.carrierName}`,
    `เลขพัสดุ: ${d.trackingNo}`,
    d.returnBy ? `ส่งชุดคืนภายใน: ${d.returnBy}` : '',
    d.productNames.length ? `ชุด: ${d.productNames.join(', ')}` : '',
    orderUrl ? `ดูออเดอร์: ${orderUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
