// แมปแท็กสี/ธีมที่แอดมินพิมพ์ไว้ (products.color_tags / theme_tags เป็นข้อความอิสระ)
// เข้ากับตัวกรองมาตรฐานในหน้าสำรวจชุด — รองรับทั้งคำไทยและอังกฤษ
// เพิ่มคำพ้องได้ที่ aliases (ตัวพิมพ์เล็กเสมอ)

export type ColorOption = { key: string; label: string; hex: string; aliases: string[] }

export const COLOR_OPTIONS: ColorOption[] = [
  { key: 'white', label: 'ขาว', hex: '#FFFFFF', aliases: ['ขาว', 'white', 'ครีม', 'cream'] },
  { key: 'purple', label: 'ม่วง', hex: '#9B6BD3', aliases: ['ม่วง', 'purple', 'violet', 'lavender', 'ลาเวนเดอร์'] },
  { key: 'gray', label: 'เทา', hex: '#A3A9B3', aliases: ['เทา', 'gray', 'grey', 'silver', 'สีเงิน'] },
  { key: 'green', label: 'เขียว', hex: '#4CAF7A', aliases: ['เขียว', 'green', 'mint', 'มิ้นต์'] },
  { key: 'black', label: 'ดำ', hex: '#1F2937', aliases: ['ดำ', 'black'] },
  { key: 'brown', label: 'น้ำตาล', hex: '#8B5E3C', aliases: ['น้ำตาล', 'brown', 'beige', 'เบจ'] },
  { key: 'blue', label: 'ฟ้า/น้ำเงิน', hex: '#5B9BE6', aliases: ['ฟ้า', 'น้ำเงิน', 'กรม', 'blue', 'navy'] },
  { key: 'pink', label: 'ชมพู', hex: '#F28DB2', aliases: ['ชมพู', 'pink'] },
  { key: 'red', label: 'แดง', hex: '#E0474C', aliases: ['แดง', 'red'] },
  { key: 'yellow', label: 'เหลือง/ทอง', hex: '#F5D04C', aliases: ['เหลือง', 'ทอง', 'yellow', 'gold'] },
  { key: 'orange', label: 'ส้ม', hex: '#F39A3D', aliases: ['ส้ม', 'orange'] },
]

export type ThemeOption = { key: string; label: string; aliases: string[]; franchises?: string[] }

// ธีมเกม/อนิเมะ/ภาพยนตร์ นับรวมจาก franchise_type ด้วย เพื่อให้ตัวกรองใช้ได้ทันทีกับข้อมูลที่มีอยู่
export const THEME_OPTIONS: ThemeOption[] = [
  { key: 'christmas', label: 'คริสต์มาส', aliases: ['คริสต์มาส', 'christmas', 'xmas'] },
  { key: 'sea', label: 'ทะเล', aliases: ['ทะเล', 'ชายหาด', 'sea', 'beach', 'ocean', 'summer'] },
  { key: 'science', label: 'วิทยาศาสตร์', aliases: ['วิทยาศาสตร์', 'science', 'sci-fi', 'scifi'] },
  { key: 'halloween', label: 'ฮาโลวีน', aliases: ['ฮาโลวีน', 'halloween', 'สยองขวัญ', 'horror'] },
  { key: 'game', label: 'เกม', aliases: ['เกม', 'game', 'gaming'], franchises: ['game'] },
  { key: 'anime', label: 'อนิเมะ', aliases: ['อนิเมะ', 'การ์ตูน', 'anime', 'cartoon'], franchises: ['anime', 'manga'] },
  { key: 'movie', label: 'ภาพยนตร์', aliases: ['ภาพยนตร์', 'ภาพยนต์', 'หนัง', 'movie', 'film'], franchises: ['movie_series'] },
  { key: 'princess', label: 'เจ้าหญิง', aliases: ['เจ้าหญิง', 'princess', 'fairy tale', 'เทพนิยาย'] },
]

const norm = (s: string) => s.trim().toLowerCase()

function tagMatches(tag: string, aliases: string[]) {
  const t = norm(tag)
  return t.length > 0 && aliases.some((a) => t === a || t.includes(a))
}

export function colorKeysOf(tags: string[]): string[] {
  return COLOR_OPTIONS.filter((o) => tags.some((t) => tagMatches(t, o.aliases))).map((o) => o.key)
}

export function themeKeysOf(tags: string[], franchise: string | null): string[] {
  return THEME_OPTIONS.filter(
    (o) => tags.some((t) => tagMatches(t, o.aliases)) || (!!franchise && (o.franchises ?? []).includes(franchise)),
  ).map((o) => o.key)
}

export const COLOR_HEX: Record<string, string> = Object.fromEntries(COLOR_OPTIONS.map((o) => [o.key, o.hex]))
