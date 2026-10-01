// ป้ายชื่อภาษาไทย/อังกฤษสำหรับค่าคงที่ในตาราง products ที่แสดงในหน้าลูกค้า

export const CATEGORY_LABEL: Record<string, string> = {
  cosplay: 'Cosplay',
  fancy: 'Fancy',
  props_shoes: 'Props',
}

export const FRANCHISE_LABEL: Record<string, string> = {
  anime: 'Anime',
  manga: 'Manga',
  game: 'Game',
  movie_series: 'Movie',
  vtuber: 'VTuber',
  original: 'Original',
}

export const GENDER_LABEL: Record<string, string> = {
  male: 'ชาย',
  female: 'หญิง',
  unisex: 'Unisex',
}

// ลำดับเดียวกับตัวเลือกไซส์ในฟอร์มแอดมิน (costume-form/Sizesstockcard.tsx)
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'] as const

// เรียงไซส์ตาม SIZE_ORDER; ไซส์ที่ไม่รู้จักไปอยู่ท้ายสุดแล้วเรียงตามตัวอักษร
export function compareSize(a: string, b: string): number {
  const ia = (SIZE_ORDER as readonly string[]).indexOf(a)
  const ib = (SIZE_ORDER as readonly string[]).indexOf(b)
  if (ia === -1 && ib === -1) return a.localeCompare(b)
  if (ia === -1) return 1
  if (ib === -1) return -1
  return ia - ib
}
