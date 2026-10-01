export const CATEGORY_LABEL: Record<string, string> = {
  cosplay: 'Cosplay',
  fancy: 'แฟนซี',
  props_shoes: 'Props / รองเท้า',
}

export const FRANCHISE_LABEL: Record<string, string> = {
  anime: 'อนิเมะ',
  manga: 'มังงะ',
  game: 'เกม',
  movie: 'ภาพยนตร์',
  series: 'ซีรีส์',
  original: 'ออริจินัล',
  other: 'อื่น ๆ',
}

export const GENDER_LABEL: Record<string, string> = {
  male: 'ชาย',
  female: 'หญิง',
  unisex: 'Unisex',
}

const STANDARD_SIZE_ORDER = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL']
const STANDARD_SIZE_RANK = new Map(STANDARD_SIZE_ORDER.map((size, index) => [size, index]))

function normalizedSize(size: string): string {
  return size.trim().toUpperCase().replace(/[\s_-]/g, '')
}

function sizeRank(size: string): number | null {
  const normalized = normalizedSize(size)
  if (['F', 'FS', 'FREESIZE', 'ONESIZE', 'OS'].includes(normalized)) return 100
  return STANDARD_SIZE_RANK.get(normalized) ?? null
}

export function compareSize(a: string, b: string): number {
  const rankA = sizeRank(a)
  const rankB = sizeRank(b)
  if (rankA != null && rankB != null) return rankA - rankB
  if (rankA != null) return -1
  if (rankB != null) return 1

  const numberA = Number(a.trim())
  const numberB = Number(b.trim())
  if (Number.isFinite(numberA) && Number.isFinite(numberB)) return numberA - numberB
  return a.localeCompare(b, 'th', { numeric: true, sensitivity: 'base' })
}