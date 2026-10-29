import { createClient } from '@/utils/client'
import type { DeliveryMethod } from '@/utils/customer/bookingSettings'
import type { PricePhase } from '@/utils/rentalTiers'

// ค่าเช่าและมัดจำขึ้นกับชุดจริงตัวที่จะได้ (Step 25) — ถามฐานข้อมูล ใช้กติกาเดียวกับ create_booking
// คืน null = เรียกไม่ได้ (ยังไม่ได้รัน SQL) ให้ผู้เรียกใช้ราคาเริ่มต้นของไซส์แทน

export type DepositQuoteItem = { variantId: string; startDate: string; rentalDays: number; pieces?: string[] }

// price = ค่าเช่าเต็มชุดวันแรกของตัวที่จะได้ (ก่อนหักรองเท้า) · deposit = มัดจำของรายการนี้ (แยกชิ้นคิดแล้ว)
export type LineQuote = { price: number; deposit: number; phase: PricePhase | null }

// ตามลำดับรายการ · null ในรายการ = ช่วงนั้นไม่มีตัวว่าง
export async function quoteLines(items: DepositQuoteItem[], delivery: DeliveryMethod): Promise<(LineQuote | null)[] | null> {
  const supabase = createClient()
  if (!supabase || items.length === 0) return null
  const { data, error } = await supabase.rpc('quote_lines', {
    p_items: items.map((i) => ({
      variant_id: i.variantId,
      start_date: i.startDate,
      rental_days: i.rentalDays,
      ...(i.pieces?.length ? { pieces: i.pieces } : {}),
    })),
    p_delivery_method: delivery,
  })
  if (error || !Array.isArray(data)) return null
  type Row = { price: number | string; deposit: number | string; phase: PricePhase | null } | null
  return (data as Row[]).map((d) =>
    d == null ? null : { price: Number(d.price), deposit: Number(d.deposit), phase: d.phase ?? null },
  )
}

export type Range = { min: number; max: number }
export type PriceRange = { price: Range; deposit: Range }

// ค่าเช่าและมัดจำต่ำสุด–สูงสุดของตัวที่พร้อมเช่าในแต่ละไซส์ (ก่อนเลือกวัน)
export async function fetchPriceRanges(variantIds: string[]): Promise<Record<string, PriceRange>> {
  const supabase = createClient()
  if (!supabase || variantIds.length === 0) return {}
  const { data, error } = await supabase.rpc('variant_price_ranges', { p_variant_ids: variantIds })
  if (error) return {}
  type Row = {
    variant_id: string
    min_price: number | string
    max_price: number | string
    min_deposit: number | string
    max_deposit: number | string
  }
  return Object.fromEntries(
    ((data ?? []) as Row[]).map((r) => [
      r.variant_id,
      {
        price: { min: Number(r.min_price), max: Number(r.max_price) },
        deposit: { min: Number(r.min_deposit), max: Number(r.max_deposit) },
      },
    ]),
  )
}
