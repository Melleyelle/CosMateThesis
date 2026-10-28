// เทมเพลตอีเมล "ผลตรวจสภาพชุด / การหักมัดจำ" — ส่งหลังแอดมินบันทึกตรวจรับคืน
// 4 แบบ: คืนเต็ม · หักบางส่วน · ยึดมัดจำทั้งหมด · หักเกินมัดจำ (ลูกค้าต้องจ่ายเพิ่ม แอดมินตามเก็บเอง)
import { DANGER, MUTED, baht, emailLayout, escapeHtml, orderUrlOf, row } from './layout';

export type InspectedEmailData = {
  customerName: string;
  orderNumber: string;
  orderId: string;
  deposit: number;
  deductions: { label: string; note: string | null; amount: number }[];
  refund: number; // ยอดที่จะโอนคืน (ตามที่ฐานข้อมูลบันทึก)
  lost: boolean; // ไม่ได้รับชุดคืน → ริบมัดจำ
  refundHours: number; // โอนคืนภายในกี่ชั่วโมง
};

export function inspectedEmail(d: InspectedEmailData) {
  const orderUrl = orderUrlOf(d.orderId);
  const deducted = d.deductions.reduce((s, x) => s + x.amount, 0);
  const owe = Math.max(0, deducted - d.deposit);

  const outcome = d.lost
    ? {
        subject: `แจ้งริบมัดจำออเดอร์ ${d.orderNumber}`,
        heading: 'ร้านไม่ได้รับชุดคืนตามกำหนด',
        intro: `ร้านยังไม่ได้รับชุดในออเดอร์ของคุณ และเลยกำหนดคืนมานานเกินเกณฑ์ จึงริบมัดจำ ${baht(d.deposit)}
          หากคุณส่งชุดคืนแล้ว กรุณาติดต่อร้านพร้อมเลขพัสดุโดยเร็ว`,
      }
    : owe > 0
      ? {
          subject: `ผลตรวจสภาพชุดออเดอร์ ${d.orderNumber} · มียอดที่ต้องชำระเพิ่ม`,
          heading: 'ผลตรวจสภาพชุด: มียอดที่ต้องชำระเพิ่ม',
          intro: `ค่าเสียหาย/ค่าปรับรวม ${baht(deducted)} เกินมัดจำ ${baht(d.deposit)}
            คุณต้องชำระเพิ่ม <b style="color:${DANGER}">${baht(owe)}</b> ร้านจะติดต่อไปเพื่อแจ้งช่องทางชำระ`,
        }
      : deducted > 0
        ? {
            subject: `ผลตรวจสภาพชุดออเดอร์ ${d.orderNumber} · คืนมัดจำ ${baht(d.refund)}`,
            heading: 'ผลตรวจสภาพชุด: หักมัดจำบางส่วน',
            intro: `ร้านตรวจชุดที่คุณส่งคืนแล้ว มีรายการที่ต้องหักจากมัดจำตามด้านล่าง
              ยอดที่เหลือ ${baht(d.refund)} จะโอนคืนภายใน ${d.refundHours} ชม.`,
          }
        : {
            subject: `ผลตรวจสภาพชุดออเดอร์ ${d.orderNumber} · คืนมัดจำเต็มจำนวน`,
            heading: 'ผลตรวจสภาพชุด: คืนมัดจำเต็มจำนวน',
            intro: `ขอบคุณที่ดูแลชุดเป็นอย่างดี ร้านตรวจแล้วไม่มีรายการหัก
              จะโอนมัดจำคืนเต็ม ${baht(d.refund)} ภายใน ${d.refundHours} ชม.`,
          };

  const rows = [
    row('เลขออเดอร์', escapeHtml(d.orderNumber)),
    row('มัดจำ', baht(d.deposit)),
    ...d.deductions.map((x) =>
      row(
        `หัก ${escapeHtml(x.label)}`,
        `<span style="color:${DANGER}">−${baht(x.amount)}</span>${x.note ? `<br><span style="color:${MUTED};font-weight:400;font-size:13px">${escapeHtml(x.note)}</span>` : ''}`,
      ),
    ),
    owe > 0 ? row('ต้องชำระเพิ่ม', `<span style="color:${DANGER}">${baht(owe)}</span>`) : row('ยอดที่จะได้คืน', baht(d.refund)),
  ];

  const html = emailLayout({
    heading: outcome.heading,
    intro: `สวัสดีคุณ ${escapeHtml(d.customerName)} ${outcome.intro}`,
    rows,
    after:
      deducted > 0 && !d.lost
        ? `<p style="margin:12px 0 0;font-size:13px;color:${MUTED}">ดูรูปตอนตรวจสภาพได้ที่หน้าออเดอร์ หากมีข้อสงสัยติดต่อร้านได้</p>`
        : '',
    orderUrl,
    buttonLabel: 'ดูรายละเอียดออเดอร์',
  });

  const text = [
    `สวัสดีคุณ ${d.customerName}`,
    outcome.heading,
    `ออเดอร์ ${d.orderNumber} · มัดจำ ${baht(d.deposit)}`,
    ...d.deductions.map((x) => `หัก ${x.label}${x.note ? ` (${x.note})` : ''}: −${baht(x.amount)}`),
    owe > 0 ? `ต้องชำระเพิ่ม: ${baht(owe)}` : `ยอดที่จะได้คืน: ${baht(d.refund)}`,
    orderUrl ? `ดูออเดอร์: ${orderUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject: outcome.subject, html, text };
}
