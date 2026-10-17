// ตัวตรวจสลิป 3 โหมด — เปลี่ยนโหมดที่ app_settings.slip_verify_mode ไม่ต้องแก้โค้ด
//   manual  : ไม่ตรวจ ส่งเข้าคิว manual_review ทุกใบ
//   mock    : จำลองผลจากชื่อไฟล์ ใช้ทดสอบทุกเส้นทาง
//   slip2go : เรียก API จริง (เติม normalizeSlip2Go() วันที่ 24 ต.ค.)
//
// โครง: provider แต่ละตัวแค่ "อ่านสลิป" ให้เป็น NormalizedSlip
//       ส่วนการตัดสิน (ยอด / บัญชีผู้รับ / เวลาโอน) อยู่ที่ judge() ที่เดียว
//       วันเปลี่ยนเป็น API จริงจึงเขียนแค่ normalizeSlip2Go() ฟังก์ชันเดียว
// ไฟล์นี้ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น (อ่าน SLIP2GO_API_KEY) ห้าม import จาก component ฝั่งลูกค้า

export type VerifyMode = 'manual' | 'mock' | 'slip2go';

export type SlipOutcome =
  | 'verified'
  | 'amount_mismatch'
  | 'receiver_mismatch'
  | 'api_error'
  | 'manual'
  | 'duplicate'
  | 'unreadable';

export interface SlipCheck {
  outcome: SlipOutcome;
  transRef: string | null;
  amount: number | null;
  raw: unknown;
  note?: string;
}

export interface ShopReceiver {
  bank?: string;
  account_number?: string;
  account_name?: string;
}

export interface VerifyInput {
  file: Blob;
  slipPath: string;
  expectedAmount: number;
  orderCreatedAt: string;
  receiver: ShopReceiver | null;
}

/** ข้อมูลจากสลิปหลังแปลงเป็นรูปกลางแล้ว ไม่ขึ้นกับผู้ให้บริการ */
interface NormalizedSlip {
  transRef: string;
  amount: number;
  receiverAccount: string | null; // มักปิดบางหลัก เช่น xxx-x-x1234-x
  transferredAt: string | null; // ISO
  raw: unknown;
}

type ProviderResult =
  | { ok: true; slip: NormalizedSlip }
  | { ok: false; outcome: 'duplicate' | 'unreadable' | 'api_error'; raw: unknown; note?: string };

export async function verifySlip(mode: VerifyMode, input: VerifyInput): Promise<SlipCheck> {
  if (mode === 'manual') {
    return { outcome: 'manual', transRef: null, amount: null, raw: { mode: 'manual' } };
  }

  let res: ProviderResult;
  try {
    res = mode === 'mock' ? mockProvider(input) : await slip2goProvider(input);
  } catch (err) {
    res = { ok: false, outcome: 'api_error', raw: { error: String(err) }, note: 'เรียกตัวตรวจไม่สำเร็จ' };
  }

  if (!res.ok) {
    return { outcome: res.outcome, transRef: null, amount: null, raw: res.raw, note: res.note };
  }
  return judge(res.slip, input);
}

// ---------------------------------------------------------------------
// การตัดสิน — ใช้ร่วมทุก provider
// ---------------------------------------------------------------------
function judge(slip: NormalizedSlip, input: VerifyInput): SlipCheck {
  const base = { transRef: slip.transRef, amount: slip.amount, raw: slip.raw };

  // ยอดต้องตรงทุกสตางค์ (เกินหรือขาดให้แอดมินดู ไม่ปฏิเสธทันที)
  if (Math.round(slip.amount * 100) !== Math.round(input.expectedAmount * 100)) {
    return { ...base, outcome: 'amount_mismatch', note: `สลิป ${slip.amount} ≠ ยอดออเดอร์ ${input.expectedAmount}` };
  }

  // บัญชีผู้รับ: เทียบ 4 หลักท้าย เพราะสลิปส่วนใหญ่ปิดเลขบัญชีบางส่วน
  // ถ้ายังไม่ได้ตั้งบัญชีร้านใน app_settings จะข้ามการเช็กนี้
  const shopDigits = digits(input.receiver?.account_number);
  if (shopDigits.length >= 4) {
    const slipDigits = digits(slip.receiverAccount);
    if (slipDigits.length < 4 || slipDigits.slice(-4) !== shopDigits.slice(-4)) {
      return { ...base, outcome: 'receiver_mismatch', note: 'บัญชีผู้รับไม่ตรงกับบัญชีร้าน' };
    }
  }

  // เวลาโอนต้องไม่ก่อนสร้างออเดอร์ (กันเอาสลิปเก่ามาใช้) เผื่อนาฬิกาคลาด 5 นาที
  if (slip.transferredAt) {
    const transferred = new Date(slip.transferredAt).getTime();
    const created = new Date(input.orderCreatedAt).getTime();
    if (Number.isFinite(transferred) && transferred < created - 5 * 60_000) {
      return { ...base, outcome: 'amount_mismatch', note: 'เวลาโอนก่อนสร้างออเดอร์' };
    }
  }

  return { ...base, outcome: 'verified' };
}

function digits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

// ---------------------------------------------------------------------
// mock — ใส่คำเหล่านี้ในชื่อไฟล์สลิปเพื่อเลือกผล
//   mismatch → ยอดไม่ตรง · receiver → บัญชีผู้รับผิด · down → API ล่ม
//   bad → อ่านไม่ได้ · dup → ใช้เลขอ้างอิงตายตัว MOCK-DUP-0001
//     (ส่ง "dup" กับ 2 ออเดอร์ ใบที่สองจะโดนฐานข้อมูลปฏิเสธ = ทดสอบ unique จริง)
//   อื่น ๆ → ผ่าน
// ---------------------------------------------------------------------
function mockProvider(input: VerifyInput): ProviderResult {
  const name = input.slipPath.toLowerCase();
  const raw = { mode: 'mock', file: input.slipPath };

  if (name.includes('down')) return { ok: false, outcome: 'api_error', raw, note: 'mock: API ล่ม' };
  if (name.includes('bad')) return { ok: false, outcome: 'unreadable', raw, note: 'mock: อ่านสลิปไม่ได้' };

  return {
    ok: true,
    slip: {
      transRef: name.includes('dup') ? 'MOCK-DUP-0001' : `MOCK-${crypto.randomUUID()}`,
      amount: name.includes('mismatch') ? input.expectedAmount + 50 : input.expectedAmount,
      receiverAccount: name.includes('receiver') ? 'xxx-x-x0000-x' : input.receiver?.account_number ?? null,
      transferredAt: new Date().toISOString(),
      raw,
    },
  };
}

// ---------------------------------------------------------------------
// slip2go — โครงพร้อมแล้ว เหลือเติมตามเอกสาร API วันที่ 24 ต.ค.
// ตอนนี้ยังไม่เติม ระบบจะคืน api_error → ออเดอร์เข้า manual_review (ปลอดภัย)
// env: SLIP2GO_API_URL, SLIP2GO_API_KEY (ฝั่งเซิร์ฟเวอร์เท่านั้น ห้ามขึ้นต้น NEXT_PUBLIC_)
// ---------------------------------------------------------------------
async function slip2goProvider(input: VerifyInput): Promise<ProviderResult> {
  const url = process.env.SLIP2GO_API_URL;
  const key = process.env.SLIP2GO_API_KEY;
  if (!url || !key) {
    return { ok: false, outcome: 'api_error', raw: { error: 'missing env' }, note: 'ยังไม่ได้ตั้งค่า Slip2Go' };
  }

  // TODO(24 ต.ค.): ตรวจกับเอกสารว่าต้องส่งไฟล์แบบ multipart หรือ base64 / ชื่อ field / header auth
  const form = new FormData();
  form.append('file', input.file, 'slip.jpg');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok || body == null) {
    return { ok: false, outcome: 'api_error', raw: { status: res.status, body }, note: `Slip2Go ตอบ ${res.status}` };
  }
  return normalizeSlip2Go(body);
}

/**
 * TODO(24 ต.ค.): แปลง response ของ Slip2Go เป็น NormalizedSlip
 * ต้องหา 4 ค่า: เลขอ้างอิงธุรกรรม, ยอดเงิน, เลขบัญชีผู้รับ, เวลาโอน
 * และรหัสที่บอกว่า "สลิปซ้ำ" / "ไม่ใช่สลิป" → คืน duplicate / unreadable
 */
function normalizeSlip2Go(body: unknown): ProviderResult {
  return { ok: false, outcome: 'api_error', raw: body, note: 'ยังไม่ได้แปลง response ของ Slip2Go' };
}
