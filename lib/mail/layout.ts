// โครงอีเมลของ CosMate ที่ใช้ร่วมกันทุกฉบับ — inline style เพราะโปรแกรมอ่านเมลส่วนใหญ่ไม่รองรับ <style>/CSS ภายนอก
// ลิงก์ในเมลอ่านโดเมนจาก env SITE_URL (เช่น https://cosmate.vercel.app) ย้ายโดเมนแก้แค่ env

export const BRAND = '#e4487d';
export const INK = '#2e2e2e';
export const MUTED = '#6b6b6b';
export const DANGER = '#b42318';

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function baht(n: number) {
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
}

export function orderUrlOf(orderId: string): string | null {
  const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
  return siteUrl ? `${siteUrl}/orders/${orderId}` : null;
}

// แถวตาราง label / value (value เป็น HTML ที่ escape แล้ว)
export function row(label: string, value: string) {
  return `
    <tr>
      <td style="padding:6px 0;color:${MUTED};width:140px;vertical-align:top">${label}</td>
      <td style="padding:6px 0;color:${INK};font-weight:600">${value}</td>
    </tr>`;
}

export function emailLayout(d: {
  heading: string;
  intro: string; // HTML ที่ escape แล้ว
  rows: string[]; // จาก row()
  after?: string; // HTML ต่อท้ายตาราง
  orderUrl: string | null;
  buttonLabel: string;
}) {
  return `<!doctype html>
<html lang="th">
<body style="margin:0;padding:24px 12px;background:#faf8f7;font-family:Tahoma,'Noto Sans Thai',Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #2e2e2e;border-radius:12px">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0;font-size:22px;font-weight:800;color:${BRAND}">CosMate</p>
      <h1 style="margin:16px 0 8px;font-size:20px;line-height:1.4">${d.heading}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6">${d.intro}</p>
    </td></tr>
    <tr><td style="padding:16px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5">
        ${d.rows.join('')}
      </table>
      ${d.after ?? ''}
    </td></tr>
    ${
      d.orderUrl
        ? `<tr><td style="padding:8px 28px 4px">
      <a href="${d.orderUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;border-radius:999px;border:1px solid #2e2e2e">${d.buttonLabel}</a>
    </td></tr>`
        : ''
    }
    <tr><td style="padding:20px 28px 28px;font-size:13px;line-height:1.6;color:${MUTED}">
      อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ หากมีคำถามติดต่อร้านทาง LINE
    </td></tr>
  </table>
</body>
</html>`;
}
