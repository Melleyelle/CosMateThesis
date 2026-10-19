// utils/sizeDefaults.ts
// ไซส์มาตรฐานของร้าน (Step 18: clothing_size_defaults / shoe_size_defaults)
// ใช้เติมค่าตั้งต้นในฟอร์มเพิ่ม/แก้ชุด และบันทึกช่วงไซส์ต่อท้าย create_costume / update_costume
import { createClient } from '@/utils/client'
import type { ProductVariant, SizeSystem } from '@/app/components/admin/costume-form/types'

export type ClothingDefault = {
  size: string
  chestMin: number
  chestMax: number
  waistMin: number
  waistMax: number
  hipMin: number
  hipMax: number
}

export type ShoeDefault = {
  size: string
  footMin: number
  footMax: number
}

export type SizeDefaults = {
  clothing: ClothingDefault[]
  shoes: ShoeDefault[]
}

export const EMPTY_SIZE_DEFAULTS: SizeDefaults = { clothing: [], shoes: [] }

const NOT_MIGRATED = /clothing_size_defaults|shoe_size_defaults|size_system|chest_max_in|foot_min_cm|admin_save_size_details/

/** โหลดตารางไซส์มาตรฐานทั้งสองแบบ — ถ้ายังไม่ได้รัน Step 18 คืนค่าว่าง (ฟอร์มยังใช้ได้ แค่ไม่เติมให้) */
export async function fetchSizeDefaults(): Promise<{ data: SizeDefaults; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: EMPTY_SIZE_DEFAULTS, error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }

  const [clothing, shoes] = await Promise.all([
    supabase
      .from('clothing_size_defaults')
      .select('size, chest_min_in, chest_max_in, waist_min_in, waist_max_in, hip_min_in, hip_max_in'),
    supabase.from('shoe_size_defaults').select('size, foot_min_cm, foot_max_cm'),
  ])

  const error = clothing.error ?? shoes.error
  if (error) {
    return {
      data: EMPTY_SIZE_DEFAULTS,
      error: NOT_MIGRATED.test(error.message) ? 'ยังไม่ได้รัน SQL Step 18' : error.message,
    }
  }

  return {
    data: {
      clothing: (clothing.data ?? []).map((r) => ({
        size: r.size,
        chestMin: Number(r.chest_min_in),
        chestMax: Number(r.chest_max_in),
        waistMin: Number(r.waist_min_in),
        waistMax: Number(r.waist_max_in),
        hipMin: Number(r.hip_min_in),
        hipMax: Number(r.hip_max_in),
      })),
      shoes: (shoes.data ?? []).map((r) => ({
        size: r.size,
        footMin: Number(r.foot_min_cm),
        footMax: Number(r.foot_max_cm),
      })),
    },
    error: null,
  }
}

type MeasurementFields = Pick<
  ProductVariant,
  'chestIn' | 'chestMaxIn' | 'waistIn' | 'waistMaxIn' | 'hipIn' | 'hipMaxIn' | 'footMinCm' | 'footMaxCm'
>

/**
 * ค่ามาตรฐานของไซส์หนึ่ง ในรูปฟิลด์ของฟอร์ม — null ถ้าไม่มีค่ามาตรฐาน (เช่น Free Size)
 * เสื้อผ้าใช้ตารางเดียวทุกเพศ
 */
export function defaultMeasurementsFor(
  defaults: SizeDefaults,
  sizeSystem: SizeSystem,
  size: string,
): MeasurementFields | null {
  if (sizeSystem === 'shoes') {
    const row = defaults.shoes.find((d) => d.size === size)
    if (!row) return null
    return {
      chestIn: '',
      chestMaxIn: '',
      waistIn: '',
      waistMaxIn: '',
      hipIn: '',
      hipMaxIn: '',
      footMinCm: String(row.footMin),
      footMaxCm: String(row.footMax),
    }
  }
  const row = defaults.clothing.find((d) => d.size === size)
  if (!row) return null
  return {
    chestIn: String(row.chestMin),
    chestMaxIn: String(row.chestMax),
    waistIn: String(row.waistMin),
    waistMaxIn: String(row.waistMax),
    hipIn: String(row.hipMin),
    hipMaxIn: String(row.hipMax),
    footMinCm: '',
    footMaxCm: '',
  }
}

/** ค่าในฟอร์มตรงกับค่ามาตรฐานไหม — ใช้แสดงป้าย "ค่ามาตรฐาน" / "ปรับเอง" */
export function matchesDefault(variant: ProductVariant, def: MeasurementFields | null): boolean {
  if (!def) return false
  const same = (a: string, b: string) => (a.trim() === '' && b === '') || Number(a) === Number(b)
  return (Object.keys(def) as (keyof MeasurementFields)[]).every((k) => same(variant[k], def[k]))
}

/** ตรวจว่าทุกช่วงต่ำสุด ≤ สูงสุด — คืนข้อความเตือนตัวแรกที่เจอ */
export function validateSizeRanges(variants: ProductVariant[]): string | null {
  const pairs: [keyof ProductVariant, keyof ProductVariant, string][] = [
    ['chestIn', 'chestMaxIn', 'รอบอก'],
    ['waistIn', 'waistMaxIn', 'รอบเอว'],
    ['hipIn', 'hipMaxIn', 'รอบสะโพก'],
    ['footMinCm', 'footMaxCm', 'ความยาวเท้า'],
  ]
  for (const v of variants) {
    for (const [minKey, maxKey, label] of pairs) {
      const min = String(v[minKey]).trim()
      const max = String(v[maxKey]).trim()
      if (min && max && Number(min) > Number(max)) {
        return `ไซส์ ${v.size}: ${label}ต่ำสุดต้องไม่มากกว่าสูงสุด`
      }
    }
  }
  return null
}

/**
 * บันทึกประเภทไซส์ + ค่าสูงสุด/ความยาวเท้า หลัง create_costume / update_costume
 * (สองฟังก์ชันนั้นบันทึกค่าต่ำสุดลง chest_in/waist_in/hip_in อยู่แล้ว)
 * ช่องสูงสุดที่เว้นว่าง = ค่าเดียว → ใช้ค่าต่ำสุดแทน
 */
export async function saveSizeDetails(
  productId: string,
  sizeSystem: SizeSystem,
  variants: ProductVariant[],
): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'

  const maxOrMin = (max: string, min: string) => (max.trim() ? max.trim() : min.trim())
  const { error } = await supabase.rpc('admin_save_size_details', {
    p_product_id: productId,
    p_size_system: sizeSystem,
    p_ranges: variants.map((v) => ({
      size: v.size,
      chest_max_in: sizeSystem === 'clothing' ? maxOrMin(v.chestMaxIn, v.chestIn) : '',
      waist_max_in: sizeSystem === 'clothing' ? maxOrMin(v.waistMaxIn, v.waistIn) : '',
      hip_max_in: sizeSystem === 'clothing' ? maxOrMin(v.hipMaxIn, v.hipIn) : '',
      foot_min_cm: sizeSystem === 'shoes' ? v.footMinCm.trim() : '',
      foot_max_cm: sizeSystem === 'shoes' ? maxOrMin(v.footMaxCm, v.footMinCm) : '',
    })),
  })
  if (!error) return null
  if (NOT_MIGRATED.test(error.message)) return 'บันทึกช่วงไซส์ไม่สำเร็จ: ยังไม่ได้รัน SQL Step 18'
  if (error.message.includes('SIZE_RANGE_INVALID')) return 'บันทึกช่วงไซส์ไม่สำเร็จ: ค่าต่ำสุดมากกว่าค่าสูงสุด'
  if (error.message.includes('NOT_ADMIN')) return 'บัญชีนี้ไม่มีสิทธิ์แอดมิน'
  return `บันทึกช่วงไซส์ไม่สำเร็จ: ${error.message}`
}

/** แสดงช่วงแบบอ่านง่าย: 34–36 · ถ้าเท่ากันแสดงเลขเดียว · ไม่มีค่า = null */
export function formatRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null
  if (min == null || max == null || min === max) return String(min ?? max)
  return `${min}–${max}`
}

/** บันทึกไซส์มาตรฐานเสื้อผ้า (หน้า /admin/size-defaults) — RLS ให้เฉพาะแอดมินเขียนได้ */
export async function saveClothingDefaults(rows: ClothingDefault[]): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'
  const { error } = await supabase.from('clothing_size_defaults').upsert(
    rows.map((r) => ({
      size: r.size,
      chest_min_in: r.chestMin,
      chest_max_in: r.chestMax,
      waist_min_in: r.waistMin,
      waist_max_in: r.waistMax,
      hip_min_in: r.hipMin,
      hip_max_in: r.hipMax,
    })),
    { onConflict: 'size' },
  )
  if (!error) return null
  if (/row-level security/.test(error.message)) return 'บัญชีนี้ไม่มีสิทธิ์แอดมิน'
  if (/check constraint/.test(error.message)) return 'มีช่วงที่ค่าต่ำสุดมากกว่าค่าสูงสุด'
  return error.message
}

/** บันทึกไซส์มาตรฐานรองเท้า */
export async function saveShoeDefaults(rows: ShoeDefault[]): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'
  const { error } = await supabase.from('shoe_size_defaults').upsert(
    rows.map((r) => ({ size: r.size, foot_min_cm: r.footMin, foot_max_cm: r.footMax })),
    { onConflict: 'size' },
  )
  if (!error) return null
  if (/row-level security/.test(error.message)) return 'บัญชีนี้ไม่มีสิทธิ์แอดมิน'
  if (/check constraint/.test(error.message)) return 'มีช่วงที่ค่าต่ำสุดมากกว่าค่าสูงสุด'
  return error.message
}
