// เทมเพลตอีเมล "จัดส่งชุดแล้ว" — ใช้ inline style เพราะโปรแกรมอ่านเมลส่วนใหญ่ไม่รองรับ <style>/CSS ภายนอก
// ลิงก์ในเมลอ่านโดเมนจาก env SITE_URL (เช่น https://cosmate.vercel.app) ย้ายโดเมนแก้แค่ env

const BRAND = '#e4487d';
const INK = '#2e2e2e';
const MUTED = '#6b6b6b';

export type ShippedEmailData = {
  customerName: string;
  orderNumber: string;
  orderId: string;
  trackingNo: string;
  productNames: string[];
  returnBy: string | null; // วันที่ต้องส่งคืน (จัดรูปแบบแล้ว)
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function shippedEmail(d: ShippedEmailData) {
  const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
  const orderUrl = siteUrl ? `${siteUrl}/orders/${d.orderId}` : null;
  const subject = `CosMate: จัดส่งชุดออเดอร์ ${d.orderNumber} แล้ว`;

  const items = d.productNames.map((n) => `<li style="margin:0 0 4px">${escapeHtml(n)}</li>`).join('');
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 0;color:${MUTED};width:140px;vertical-align:top">${label}</td>
      <td style="padding:6px 0;color:${INK};font-weight:600">${value}</td>
    </tr>`;

  const html = `<!doctype html>
<html lang="th">
<body style="margin:0;padding:24px 12px;background:#faf8f7;font-family:Tahoma,'Noto Sans Thai',Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #2e2e2e;border-radius:12px">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0;font-size:22px;font-weight:800;color:${BRAND}">CosMate</p>
      <h1 style="margin:16px 0 8px;font-size:20px;line-height:1.4">ชุดของคุณออกเดินทางแล้ว</h1>
      <p style="margin:0;font-size:15px;line-height:1.6">สวัสดีคุณ ${escapeHtml(d.customerName)} ร้านจัดส่งชุดในออเดอร์ของคุณแล้ว
        เมื่อได้รับ <b>ลองใส่ทันที</b> ถ้าไซส์ไม่ได้หรือชุดมีปัญหา แจ้งร้านภายในวันนั้น</p>
    </td></tr>
    <tr><td style="padding:16px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5">
        ${row('เลขออเดอร์', escapeHtml(d.orderNumber))}
        ${row('เลขพัสดุ', `<span style="color:${BRAND};font-size:17px">${escapeHtml(d.trackingNo)}</span>`)}
        ${d.returnBy ? row('ส่งชุดคืนภายใน', escapeHtml(d.returnBy)) : ''}
      </table>
      ${items ? `<p style="margin:16px 0 6px;font-size:14px;color:${MUTED}">ชุดในออเดอร์นี้</p><ul style="margin:0;padding-left:20px;font-size:15px">${items}</ul>` : ''}
    </td></tr>
    ${
      orderUrl
        ? `<tr><td style="padding:8px 28px 4px">
      <a href="${orderUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;border-radius:999px;border:1px solid #2e2e2e">ดูออเดอร์และติดตามพัสดุ</a>
    </td></tr>`
        : ''
    }
    <tr><td style="padding:20px 28px 28px;font-size:13px;line-height:1.6;color:${MUTED}">
      อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ หากมีคำถามติดต่อร้านทาง LINE
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `สวัสดีคุณ ${d.customerName}`,
    `ร้านจัดส่งชุดออเดอร์ ${d.orderNumber} แล้ว`,
    `เลขพัสดุ: ${d.trackingNo}`,
    d.returnBy ? `ส่งชุดคืนภายใน: ${d.returnBy}` : '',
    d.productNames.length ? `ชุด: ${d.productNames.join(', ')}` : '',
    orderUrl ? `ดูออเดอร์: ${orderUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
