import { createClient } from '@/utils/client'
import type { DeliveryMethod } from '@/utils/customer/bookingSettings'

// มัดจำขึ้นกับชุดจริงตัวที่จะได้ (Step 21) — ถามฐานข้อมูล ใช้กติกาเดียวกับ create_booking
// คืน null = เรียกไม่ได้ (ยังไม่ได้รัน SQL) ให้ผู้เรียกใช้มัดจำของไซส์แทน

export type DepositQuoteItem = { variantId: string; startDate: string; rentalDays: number; pieces?: string[] }

// มัดจำตามลำดับรายการ · null ในรายการ = ช่วงนั้นไม่มีตัวว่าง
export async function quoteDeposits(
  items: DepositQuoteItem[],
  delivery: DeliveryMethod,
): Promise<(number | null)[] | null> {
  const supabase = createClient()
  if (!supabase || items.length === 0) return null
  const { data, error } = await supabase.rpc('quote_deposits', {
    p_items: items.map((i) => ({
      variant_id: i.variantId,
      start_date: i.startDate,
      rental_days: i.rentalDays,
      ...(i.pieces?.length ? { pieces: i.pieces } : {}),
    })),
    p_delivery_method: delivery,
  })
  if (error || !Array.isArray(data)) return null
  return (data as (number | string | null)[]).map((d) => (d == null ? null : Number(d)))
}

export type DepositRange = { min: number; max: number }

// มัดจำต่ำสุด–สูงสุดของตัวที่พร้อมเช่าในแต่ละไซส์ (ก่อนเลือกวัน)
export async function fetchDepositRanges(variantIds: string[]): Promise<Record<string, DepositRange>> {
  const supabase = createClient()
  if (!supabase || variantIds.length === 0) return {}
  const { data, error } = await supabase.rpc('variant_deposit_ranges', { p_variant_ids: variantIds })
  if (error) return {}
  type Row = { variant_id: string; min_deposit: number | string; max_deposit: number | string }
  return Object.fromEntries(
    ((data ?? []) as Row[]).map((r) => [r.variant_id, { min: Number(r.min_deposit), max: Number(r.max_deposit) }]),
  )
}
