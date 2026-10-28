import { useEffect, useState } from 'react'
import { createClient } from '@/utils/client'

// ค่าเช่าตามต้นทุน 5 เทียร์ + มัดจำชุดใหม่ลดลงตามรอบ (SQL Step 21 · docs/deposit-pricing-spec.md)
// ตัวเลขเทียร์อยู่ในตาราง rental_tiers ที่เดียว หน้าเว็บโหลดมาใช้แสดง/เสนอราคา
// มัดจำจริงตอนจองคิดในฐานข้อมูล (unit_deposit / piece_deposit) — ฟังก์ชันในไฟล์นี้ต้องให้ผลตรงกัน

export type RentalTier = {
  tierId: number
  costMin: number
  costMax: number
  rentMin: number
  rentMax: number
  depositNew: number[] // รอบ 1–4
  depositNormal: number // รอบ 5 ขึ้นไป
}

export const RENT_COST_RATIO = 0.4 // ค่าเช่าอย่างน้อย 40% ของต้นทุน → คืนทุนภายใน 3 รอบ

type TierRow = {
  tier_id: number
  cost_min: number | string
  cost_max: number | string
  rent_min: number | string
  rent_max: number | string
  deposit_new: (number | string)[]
  deposit_normal: number | string
}

export async function fetchRentalTiers(): Promise<{ data: RentalTier[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { data, error } = await supabase.from('rental_tiers').select('*').order('tier_id')
  if (error) return { data: [], error: error.message }
  return {
    data: ((data ?? []) as TierRow[]).map((r) => ({
      tierId: r.tier_id,
      costMin: Number(r.cost_min),
      costMax: Number(r.cost_max),
      rentMin: Number(r.rent_min),
      rentMax: Number(r.rent_max),
      depositNew: r.deposit_new.map(Number),
      depositNormal: Number(r.deposit_normal),
    })),
    error: null,
  }
}

// ฟอร์มชุด: โหลดเทียร์ครั้งเดียว · error = ยังไม่ได้รัน Step 21 (ฟอร์มใช้มัดจำรายไซส์แบบเดิมต่อได้)
export function useRentalTiers() {
  const [state, setState] = useState<{ tiers: RentalTier[]; error: string | null }>({ tiers: [], error: null })
  useEffect(() => {
    let cancelled = false
    fetchRentalTiers().then(({ data, error }) => {
      if (!cancelled) setState({ tiers: data, error })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

export type PricingMode = {
  cost: number | null
  tier: RentalTier | null
  override: number | null
  // มัดจำคิดในระบบ (เทียร์หรือกำหนดเอง) → ไม่ใช้มัดจำที่กรอกรายไซส์
  auto: boolean
  // มัดจำที่เก็บลง product_variants.deposit_amount ให้ข้อมูลเดิมยังมีค่า (รอบ 5 ขึ้นไป / ค่าที่กำหนดเอง)
  variantDeposit: number | null
  minRent: number | null // 40% ของต้นทุน
}

export function pricingMode(tiers: RentalTier[], costPrice: string, depositOverride: string): PricingMode {
  const cost = costPrice.trim() ? Number(costPrice) : null
  const override = depositOverride.trim() ? Number(depositOverride) : null
  const tier = tierForCost(tiers, cost)
  return {
    cost,
    tier,
    override,
    auto: tier != null || override != null,
    variantDeposit: override ?? tier?.depositNormal ?? null,
    minRent: cost != null && cost > 0 ? Math.ceil(cost * RENT_COST_RATIO) : null,
  }
}

export function tierForCost(tiers: RentalTier[], cost: number | null): RentalTier | null {
  if (cost == null || !Number.isFinite(cost)) return null
  return tiers.find((t) => cost >= t.costMin && cost <= t.costMax) ?? null
}

// ค่าเช่าที่เสนอ: 40% ของต้นทุน ปัดขึ้นหลัก 50 แล้วบีบให้อยู่ในช่วงค่าเช่าของเทียร์
export function suggestedRent(tier: RentalTier, cost: number): number {
  const price = Math.ceil((cost * RENT_COST_RATIO) / 50) * 50
  return Math.min(Math.max(price, tier.rentMin), tier.rentMax)
}

// มัดจำเช่าทั้งชุดของรอบที่ round (เริ่ม 1)
export function depositForRound(tier: RentalTier, round: number): number {
  return round <= tier.depositNew.length ? tier.depositNew[round - 1] : tier.depositNormal
}

// มัดจำเช่าแยกชิ้น: สัดส่วนจากมัดจำทั้งชุด ปัดขึ้นหลัก 50 ไม่เกินมัดจำทั้งชุด — ตรงกับ public.piece_deposit()
export function pieceDeposit(fullDeposit: number, setPrice: number, piecesTotal: number): number {
  if (setPrice <= 0) return fullDeposit
  return Math.min(fullDeposit, Math.ceil((fullDeposit * piecesTotal) / setPrice / 50) * 50)
}

// บันทึกต้นทุน/มัดจำกำหนดเอง หลัง create_costume / update_costume (สองตัวนั้นไม่รู้จักคอลัมน์ใหม่)
export async function saveProductPricing(
  productId: string,
  costPrice: string,
  depositOverride: string,
): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return 'Supabase ยังไม่ได้ถูกตั้งค่า'
  const toNumber = (v: string) => (v.trim() ? Number(v) : null)
  const { error } = await supabase.rpc('admin_set_product_pricing', {
    p_product_id: productId,
    p_cost_price: toNumber(costPrice),
    p_deposit_override: toNumber(depositOverride),
  })
  if (!error) return null
  return /admin_set_product_pricing|cost_price/.test(error.message)
    ? 'บันทึกต้นทุนไม่สำเร็จ: ยังไม่ได้รัน SQL Step 21'
    : `บันทึกต้นทุนไม่สำเร็จ: ${error.message}`
}
