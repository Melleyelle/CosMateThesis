import { useEffect, useState } from 'react'
import { createClient } from '@/utils/client'
import type { ProductPricing } from '@/app/components/admin/costume-form/types'

// ค่าเช่าตามช่วงอายุชุด + มัดจำตามตารางเดิมของร้าน (SQL Step 25 · docs/deposit-pricing-spec.md v2)
// ตัวเลขมัดจำอยู่ในตาราง deposit_tiers ที่เดียว · ราคา/มัดจำจริงตอนจองคิดในฐานข้อมูล
// (unit_price / unit_deposit / pieces_deposit) — ฟังก์ชันในไฟล์นี้ต้องให้ผลตรงกัน ใช้แสดง/เสนอราคาเท่านั้น

export type PricePhase = 'new' | 'normal' | 'old'

export const PHASE_LABEL: Record<PricePhase, string> = {
  new: 'ชุดใหม่',
  normal: 'ราคาปกติ',
  old: 'ชุดเก่า',
}

// สัดส่วนของต้นทุน (จำนวนเต็ม % เพื่อไม่ให้ทศนิยมของ JS ปัดผิด เช่น 1000 × 0.35)
const PHASE_PERCENT: Record<PricePhase, number> = { new: 50, normal: 35, old: 25 }
export const MIN_RENT = 250
export const AUTO_COST_MIN = 600
export const AUTO_COST_MAX = 2500
export const SLOW_PAYBACK_PERCENT = 40 // ราคาชุดใหม่ต่ำกว่านี้ → เตือนว่าคืนทุนช้าลง

export type DepositTier = { rentMin: number; rentMax: number; deposit: number }
export type PhaseSettings = { oldEnabled: boolean; oldAfter: number }
export type PhasePrices = Record<PricePhase, number>

export const DEFAULT_PHASE_SETTINGS: PhaseSettings = { oldEnabled: true, oldAfter: 10 }

// ปัดขึ้นเป็นหลัก 50 บาท ขั้นต่ำ 250
export function suggestedPrice(cost: number, phase: PricePhase): number {
  return Math.max(MIN_RENT, Math.ceil((cost * PHASE_PERCENT[phase]) / 5000) * 50)
}

export function suggestedPrices(cost: number): PhasePrices {
  return { new: suggestedPrice(cost, 'new'), normal: suggestedPrice(cost, 'normal'), old: suggestedPrice(cost, 'old') }
}

export function isAutoCost(cost: number | null): cost is number {
  return cost != null && Number.isFinite(cost) && cost >= AUTO_COST_MIN && cost <= AUTO_COST_MAX
}

// ตรงกับ public.deposit_for_rent(): เทียร์ที่ rentMin ≤ ค่าเช่า สูงสุด · ต่ำกว่าเทียร์แรก = เทียร์แรก
export function depositForRent(tiers: DepositTier[], rent: number): number {
  if (tiers.length === 0) return 0
  const sorted = [...tiers].sort((a, b) => a.rentMin - b.rentMin)
  return [...sorted].reverse().find((t) => t.rentMin <= rent)?.deposit ?? sorted[0].deposit
}

// ค่าเช่าเกินเทียร์สุดท้าย → ตารางไม่ครอบคลุม (ใช้มัดจำเทียร์สุดท้าย) ควรกำหนดมัดจำเอง
export function beyondDepositTable(tiers: DepositTier[], rent: number): boolean {
  return tiers.length > 0 && rent > Math.max(...tiers.map((t) => t.rentMax))
}

// รอบที่คืนทุน: ช่วงชุดใหม่ใช้ราคาชุดใหม่จนค่าเช่าสะสมถึงต้นทุน
export function paybackRounds(cost: number, priceNew: number): number | null {
  if (!(cost > 0) || !(priceNew > 0)) return null
  return Math.ceil(cost / priceNew)
}

// มัดจำเช่าแยกชิ้น — ตรงกับ public.pieces_deposit()
export function piecesDeposit(tiers: DepositTier[], fullDeposit: number, piecesTotal: number): number {
  return Math.min(fullDeposit, depositForRent(tiers, piecesTotal))
}

type TierRow = { rent_min: number | string; rent_max: number | string; deposit: number | string }

export async function fetchDepositTiers(): Promise<{ data: DepositTier[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { data, error } = await supabase.from('deposit_tiers').select('*').order('rent_min')
  if (error) return { data: [], error: error.message }
  return {
    data: ((data ?? []) as TierRow[]).map((r) => ({
      rentMin: Number(r.rent_min),
      rentMax: Number(r.rent_max),
      deposit: Number(r.deposit),
    })),
    error: null,
  }
}

export async function fetchPhaseSettings(): Promise<PhaseSettings> {
  const supabase = createClient()
  if (!supabase) return DEFAULT_PHASE_SETTINGS
  const { data, error } = await supabase.rpc('get_price_phase_settings')
  if (error || !data) return DEFAULT_PHASE_SETTINGS
  const d = data as { old_enabled?: boolean; old_after?: number }
  return { oldEnabled: d.old_enabled ?? true, oldAfter: Number(d.old_after ?? 10) }
}

// ฟอร์มชุด: โหลดตารางมัดจำ + ค่าตั้งช่วงชุดเก่าครั้งเดียว · error = ยังไม่ได้รัน Step 25
export function usePricingConfig() {
  const [state, setState] = useState<{
    tiers: DepositTier[]
    phase: PhaseSettings
    error: string | null
  }>({ tiers: [], phase: DEFAULT_PHASE_SETTINGS, error: null })
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchDepositTiers(), fetchPhaseSettings()]).then(([tiers, phase]) => {
      if (!cancelled) setState({ tiers: tiers.data, phase, error: tiers.error })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return [state, (phase: PhaseSettings) => setState((s) => ({ ...s, phase }))] as const
}

// ค่าตั้งของทั้งร้าน — ทุกชุดเปลี่ยนตาม
export async function savePhaseSettings(s: PhaseSettings): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'
  const { error } = await supabase.rpc('admin_set_price_phase_settings', {
    p_old_enabled: s.oldEnabled,
    p_old_after: s.oldAfter,
  })
  return error ? `บันทึกไม่สำเร็จ: ${error.message}` : null
}

const toNumber = (v: string) => (v.trim() ? Number(v) : null)

// ปัญหาของราคาที่กรอก (null = ใช้ได้)
export function pricingProblem(p: ProductPricing): string | null {
  const prices = [p.priceNew, p.priceNormal, p.priceOld]
  if (prices.some((v) => !v.trim())) return 'กรุณากรอกค่าเช่าให้ครบทั้ง 3 ช่วง'
  if (prices.some((v) => !(Number(v) >= 0))) return 'ค่าเช่าต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'
  if (p.costPrice.trim() && !(Number(p.costPrice) >= 0)) return 'ต้นทุนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'
  if (p.depositOverride.trim() && !(Number(p.depositOverride) >= 0)) return 'มัดจำกำหนดเองต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'
  return null
}

// มัดจำที่เก็บลงไซส์ตอนบันทึกฟอร์ม (ระบบคำนวณใหม่ให้เองหลังบันทึกราคา)
export function variantDepositOf(p: ProductPricing, tiers: DepositTier[]): string {
  const override = toNumber(p.depositOverride)
  return String(override ?? depositForRent(tiers, Number(p.priceNormal) || 0))
}

// บันทึกต้นทุน ราคา 3 ช่วง มัดจำกำหนดเอง และการล็อกราคา หลัง create_costume / update_costume
export async function saveProductPricing(productId: string, p: ProductPricing): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'
  const { error } = await supabase.rpc('admin_set_product_pricing', {
    p_product_id: productId,
    p_cost_price: toNumber(p.costPrice),
    p_deposit_override: toNumber(p.depositOverride),
    p_price_new: toNumber(p.priceNew),
    p_price_normal: toNumber(p.priceNormal),
    p_price_old: toNumber(p.priceOld),
    p_price_locked: p.priceLocked,
  })
  if (!error) return null
  return /admin_set_product_pricing|price_new/.test(error.message)
    ? 'บันทึกราคาไม่สำเร็จ: ยังไม่ได้รัน SQL Step 25'
    : `บันทึกราคาไม่สำเร็จ: ${error.message}`
}
