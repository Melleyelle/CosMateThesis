// ส่งอีเมลผ่าน SMTP ด้วย Nodemailer — ใช้ใน Route Handler ฝั่งเซิร์ฟเวอร์เท่านั้น (runtime = 'nodejs')
// env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM (ห้ามขึ้นต้น NEXT_PUBLIC_)
// Gmail: SMTP_HOST=smtp.gmail.com SMTP_PORT=465 และ SMTP_PASS เป็น App Password 16 ตัว
import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error('Missing SMTP_HOST / SMTP_USER / SMTP_PASS');

  // 465 = SSL ตั้งแต่ต้น · 587 = STARTTLS
  transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return transporter;
}

export async function sendMail(args: { to: string; subject: string; html: string; text: string }) {
  // บน Vercel ต้อง await ให้ส่งเสร็จก่อนตอบกลับ ไม่งั้นฟังก์ชันอาจถูกหยุดก่อนเมลออก
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    ...args,
  });
}
