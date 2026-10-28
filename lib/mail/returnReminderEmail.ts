// เทมเพลตอีเมล "ใกล้ถึงวันส่งคืนชุด" — ส่งอัตโนมัติ 2 วันก่อนกำหนดคืน (เช่าวันเดียว = 1 วันก่อน)
import { BRAND, MUTED, baht, emailLayout, escapeHtml, orderUrlOf, row } from './layout';

export type ReturnReminderData = {
  customerName: string;
  orderNumber: string;
  orderId: string;
  returnBy: string; // จัดรูปแบบแล้ว
  daysLeft: number;
  productNames: string[];
  lateFeePerDay: number;
  shop: { name: string; address: string; hours: string } | null; // ที่อยู่ร้าน (ส่งคืน/นำมาคืนเอง)
};

export function returnReminderEmail(d: ReturnReminderData) {
  const orderUrl = orderUrlOf(d.orderId);
  const when = d.daysLeft <= 0 ? 'วันนี้' : d.daysLeft === 1 ? 'พรุ่งนี้' : `อีก ${d.daysLeft} วัน`;
  const subject = `CosMate: ครบกำหนดส่งคืนชุด${when} (ออเดอร์ ${d.orderNumber})`;

  const items = d.productNames.map((n) => `<li style="margin:0 0 4px">${escapeHtml(n)}</li>`).join('');
  const html = emailLayout({
    heading: `ครบกำหนดส่งคืนชุด${when}`,
    intro: `สวัสดีคุณ ${escapeHtml(d.customerName)} อย่าลืมส่งชุดคืนภายใน <b>${escapeHtml(d.returnBy)}</b>
      ส่งพัสดุแล้วกรอกเลขพัสดุที่หน้าออเดอร์ หรือนำมาคืนที่ร้านก็ได้
      ${d.lateFeePerDay > 0 ? `คืนช้ามีค่าปรับวันละ ${baht(d.lateFeePerDay)} หักจากมัดจำ` : ''}`,
    rows: [
      row('เลขออเดอร์', escapeHtml(d.orderNumber)),
      row('ส่งคืนภายใน', `<span style="color:${BRAND}">${escapeHtml(d.returnBy)}</span>`),
      d.shop ? row('ที่อยู่ร้าน', `${escapeHtml(d.shop.name)}<br>${escapeHtml(d.shop.address)}`) : '',
      d.shop?.hours ? row('เวลาเปิด', escapeHtml(d.shop.hours)) : '',
    ],
    after: items
      ? `<p style="margin:16px 0 6px;font-size:14px;color:${MUTED}">ชุดที่ต้องส่งคืน (รวมชิ้นส่วนและรองเท้าที่มากับชุด)</p><ul style="margin:0;padding-left:20px;font-size:15px">${items}</ul>`
      : '',
    orderUrl,
    buttonLabel: 'กรอกเลขพัสดุส่งคืน',
  });

  const text = [
    `สวัสดีคุณ ${d.customerName}`,
    `ครบกำหนดส่งคืนชุด${when}: ${d.returnBy} (ออเดอร์ ${d.orderNumber})`,
    d.lateFeePerDay > 0 ? `คืนช้ามีค่าปรับวันละ ${baht(d.lateFeePerDay)}` : '',
    d.shop ? `ที่อยู่ร้าน: ${d.shop.name} ${d.shop.address}` : '',
    orderUrl ? `กรอกเลขพัสดุส่งคืน: ${orderUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
