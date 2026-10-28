// ตัวตรวจสลิป 3 โหมด — เปลี่ยนโหมดที่ app_settings.slip_verify_mode ไม่ต้องแก้โค้ด
//   manual  : ไม่ตรวจ ส่งเข้าคิว manual_review ทุกใบ
//   mock    : จำลองผลจากชื่อไฟล์ ใช้ทดสอบทุกเส้นทาง
//   slip2go : เรียก API จริง (ส่งรูปแบบ multipart)
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
  account_type?: string; // รหัสประเภทบัญชีของ Slip2Go เช่น 01004, 02001 — ไม่ใส่ก็ได้
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
  /** provider ตัดสินแล้วว่าไม่ผ่านเงื่อนไข — judge() ใช้ผลนี้ก่อนตรวจเอง */
  rejected?: { outcome: 'amount_mismatch' | 'receiver_mismatch'; note: string };
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

  if (slip.rejected) return { ...base, ...slip.rejected };

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
// slip2go — ส่งรูปสลิปแบบ multipart ไปที่ /api/verify-slip/qr-image/info
// เอกสาร: https://slip2go.com/guide/rest-api/image · รหัสผล: https://slip2go.com/guide/response
// env: SLIP2GO_API_URL  = base URL จากหน้า dashboard (ใส่ path เต็มมาก็ได้)
//      SLIP2GO_API_KEY  = Secret Key (ใส่หรือไม่ใส่ "Bearer " นำหน้าก็ได้)
//                         เอกสารบอกให้ส่งดิบ แต่ทดสอบจริงต้องเป็น Bearer — ส่งดิบได้ 401001
// (ฝั่งเซิร์ฟเวอร์เท่านั้น ห้ามขึ้นต้น NEXT_PUBLIC_)
//
// ไม่เปิด checkDuplicate: ลูกค้าอาจส่งสลิปเดิมซ้ำหลังโดน amount_mismatch / API ล่ม
// ถ้าให้ Slip2Go กันซ้ำ ใบนั้นจะติด duplicate ตลอดไป — ให้ unique trans_ref ใน
// confirm_payment() เป็นคนกันแทน
// ---------------------------------------------------------------------
const SLIP2GO_PATH = '/api/verify-slip/qr-image/info';

async function slip2goProvider(input: VerifyInput): Promise<ProviderResult> {
  const base = process.env.SLIP2GO_API_URL;
  const key = process.env.SLIP2GO_API_KEY;
  if (!base || !key) {
    return { ok: false, outcome: 'api_error', raw: { error: 'missing env' }, note: 'ยังไม่ได้ตั้งค่า Slip2Go' };
  }
  const url = base.includes(SLIP2GO_PATH) ? base : base.replace(/\/+$/, '') + SLIP2GO_PATH;

  const form = new FormData();
  form.append('file', input.file, fileName(input.slipPath));
  form.append('payload', JSON.stringify(slip2goConditions(input)));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: key.startsWith('Bearer ') ? key : `Bearer ${key}` },
      body: form,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  // Slip2Go ตอบผลตรวจเป็น code 6 หลักใน body (ไม่ใช่ HTTP status) อ่าน body เสมอ
  const body: unknown = await res.json().catch(() => null);
  if (body == null) {
    return { ok: false, outcome: 'api_error', raw: { status: res.status }, note: `Slip2Go ตอบ ${res.status}` };
  }
  return normalizeSlip2Go(body);
}

/** เงื่อนไขให้ Slip2Go ตรวจ — judge() ยังตรวจซ้ำอีกชั้นเสมอ */
function slip2goConditions(input: VerifyInput) {
  const cond: Record<string, unknown> = {
    checkAmount: { type: 'eq', amount: String(Number(input.expectedAmount.toFixed(2))) },
    // เผื่อนาฬิกาคลาด 5 นาทีเท่ากับ judge()
    checkDate: {
      type: 'gte',
      date: new Date(new Date(input.orderCreatedAt).getTime() - 5 * 60_000).toISOString(),
    },
  };

  // checkReceiver ต้องมีรหัสประเภทบัญชีของ Slip2Go (เช่น 01004 กสิกร, 02001 พร้อมเพย์เบอร์โทร)
  // ถ้ายังไม่ได้ตั้ง account_type ใน app_settings ก็ปล่อยให้ judge() เทียบ 4 หลักท้ายอย่างเดียว
  const r = input.receiver;
  // ไม่ส่งชื่อ: account_name เป็นชื่อที่โชว์ลูกค้า (เช่น CosMate) อาจไม่ตรงชื่อเจ้าของบัญชีจริง
  if (r?.account_type && r.account_number) {
    cond.checkReceiver = [{ accountType: r.account_type, accountNumber: digits(r.account_number) }];
  }
  return cond;
}

function fileName(path: string): string {
  const ext = path.toLowerCase().match(/\.(png|jpe?g)$/)?.[1] ?? 'jpg';
  return `slip.${ext}`;
}

interface Slip2GoBody {
  code?: string;
  message?: string;
  data?: {
    transRef?: string;
    amount?: number | string;
    dateTime?: string;
    receiver?: {
      account?: {
        bank?: { account?: string | null } | null;
        proxy?: { account?: string | null } | null;
      };
    };
  };
}

/** แปลง response ของ Slip2Go เป็น NormalizedSlip หรือ outcome ที่ตัดสินได้เลย */
function normalizeSlip2Go(body: unknown): ProviderResult {
  const b = body as Slip2GoBody;
  const code = String(b.code ?? '');
  const note = `Slip2Go ${code}: ${b.message ?? ''}`.trim();

  let rejected: NormalizedSlip['rejected'];
  switch (code) {
    case '200000':
    case '200200':
      break;
    // สลิปจริงแต่ไม่ผ่านเงื่อนไข — เก็บ transRef/ยอดไว้ให้แอดมินดู
    case '200401':
      rejected = { outcome: 'receiver_mismatch', note: 'บัญชีผู้รับไม่ตรงกับบัญชีร้าน (Slip2Go)' };
      break;
    case '200402':
      rejected = { outcome: 'amount_mismatch', note: 'ยอดในสลิปไม่ตรงกับยอดออเดอร์ (Slip2Go)' };
      break;
    case '200403':
      rejected = { outcome: 'amount_mismatch', note: 'เวลาโอนก่อนสร้างออเดอร์ (Slip2Go)' };
      break;
    case '200501':
      return { ok: false, outcome: 'duplicate', raw: body, note };
    case '200404':
    case '400001':
    case '400002':
    // 200500 = สลิปปลอม/ถูกแก้ — รูปที่ไม่ใช่สลิป (เช่นรูปทั่วไป) ก็ได้รหัสนี้
    // ปฏิเสธให้แนบใหม่ทันที ไม่ส่งเข้าคิวแอดมิน (ลูกค้าจะคิดว่าผ่านแล้ว)
    case '200500':
      return { ok: false, outcome: 'unreadable', raw: body, note };
    default:
      // 200502 ธนาคารล่ม, 401xxx token/แพ็กเกจ, 429 rate limit, 5xxxxx ระบบล่ม
      return { ok: false, outcome: 'api_error', raw: body, note };
  }

  const d = b.data;
  const amount = Number(d?.amount);
  if (!d?.transRef || !Number.isFinite(amount)) {
    return { ok: false, outcome: 'api_error', raw: body, note: `${note} (ข้อมูลสลิปไม่ครบ)` };
  }
  const acc = d.receiver?.account;
  return {
    ok: true,
    slip: {
      transRef: d.transRef,
      amount,
      receiverAccount: acc?.bank?.account ?? acc?.proxy?.account ?? null,
      transferredAt: d.dateTime ?? null,
      raw: body,
      rejected,
    },
  };
}
