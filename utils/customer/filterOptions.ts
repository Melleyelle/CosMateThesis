export const COLOR_OPTIONS = [
  { key: 'black', label: 'ดำ', hex: '#262626' },
  { key: 'white', label: 'ขาว', hex: '#FFFFFF' },
  { key: 'gray', label: 'เทา', hex: '#9CA3AF' },
  { key: 'red', label: 'แดง', hex: '#EF4444' },
  { key: 'pink', label: 'ชมพู', hex: '#EC4899' },
  { key: 'orange', label: 'ส้ม', hex: '#F97316' },
  { key: 'yellow', label: 'เหลือง', hex: '#EAB308' },
  { key: 'green', label: 'เขียว', hex: '#22C55E' },
  { key: 'blue', label: 'น้ำเงิน', hex: '#3B82F6' },
  { key: 'purple', label: 'ม่วง', hex: '#A855F7' },
  { key: 'brown', label: 'น้ำตาล', hex: '#92400E' },
  { key: 'multicolor', label: 'หลากสี', hex: '#E5457F' },
] as const

export const THEME_OPTIONS = [
  { key: 'anime', label: 'อนิเมะ' },
  { key: 'game', label: 'เกม' },
  { key: 'movie', label: 'ภาพยนตร์' },
  { key: 'series', label: 'ซีรีส์' },
  { key: 'fantasy', label: 'แฟนตาซี' },
  { key: 'horror', label: 'สยองขวัญ' },
  { key: 'school', label: 'นักเรียน' },
  { key: 'historical', label: 'ย้อนยุค' },
  { key: 'sci_fi', label: 'ไซไฟ' },
  { key: 'idol', label: 'ไอดอล' },
] as const

export const COLOR_HEX: Record<string, string> = Object.fromEntries(COLOR_OPTIONS.map(({ key, hex }) => [key, hex]))

const COLOR_KEY_BY_LABEL = new Map<string, string>(COLOR_OPTIONS.map(({ key, label }) => [label, key]))

export function colorKeysOf(tags: string[] | string | null | undefined): string[] {
  const values = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : []
  return Array.from(
    new Set(
      values
        .map((tag) => tag.trim())
        .map((tag) => COLOR_KEY_BY_LABEL.get(tag) ?? tag.toLowerCase())
        .filter((key) => key in COLOR_HEX),
    ),
  )
}