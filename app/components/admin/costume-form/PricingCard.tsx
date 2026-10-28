'use client'

import SectionCard from './Sectioncard'
import { FormField } from './FormFields'
import type { ProductPricing, ProductVariant } from './types'
import { depositForRound, suggestedRent, type PricingMode, type RentalTier } from '@/utils/rentalTiers'
import { formatBaht } from '@/utils/dateUtils'

type Props = {
  pricing: ProductPricing
  onChange: (pricing: ProductPricing) => void
  mode: PricingMode
  tiers: RentalTier[]
  tiersError: string | null
  variants: ProductVariant[]
  onApplyRent: (price: number) => void
}

// ต้นทุนชุด → เทียร์ → ค่าเช่าแนะนำ + ตารางมัดจำตามรอบ (docs/deposit-pricing-spec.md)
// ไม่กรอกต้นทุน = กำหนดค่าเช่าและมัดจำเองรายไซส์แบบเดิม
export default function PricingCard({ pricing, onChange, mode, tiers, tiersError, variants, onApplyRent }: Props) {
  const { cost, tier, override, minRent } = mode
  const rent = tier && cost != null ? suggestedRent(tier, cost) : null
  const allApplied = rent != null && variants.length > 0 && variants.every((v) => Number(v.packagePrice) === rent)
  const lowRent = minRent != null ? variants.filter((v) => v.packagePrice && Number(v.packagePrice) < minRent) : []
  const range = tiers.length > 0 ? `${formatBaht(tiers[0].costMin)}–${formatBaht(tiers[tiers.length - 1].costMax)}` : null

  return (
    <SectionCard
      title="ต้นทุน ค่าเช่า และมัดจำ"
      subtitle="กรอกต้นทุนชุด ระบบเสนอค่าเช่า 40% ของต้นทุน และคิดมัดจำของชุดแต่ละตัวตามรอบที่ถูกเช่า"
    >
      {tiersError ? (
        <p className="rounded-xl bg-[#FFF8EB] px-4 py-2.5 text-xs text-[#875200]">
          ยังไม่ได้รัน SQL Step 21 — กำหนดค่าเช่าและมัดจำเองรายไซส์ได้ตามเดิม
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="cost-price"
              label="ต้นทุนชุด (บาท)"
              type="number"
              min="0"
              step="1"
              placeholder="เว้นว่าง = กำหนดเองรายไซส์"
              value={pricing.costPrice}
              onChange={(e) => onChange({ ...pricing, costPrice: e.target.value })}
            />
            <FormField
              id="deposit-override"
              label="มัดจำกำหนดเอง (ไม่บังคับ)"
              type="number"
              min="0"
              step="1"
              placeholder="เว้นว่าง = ตามเทียร์"
              value={pricing.depositOverride}
              onChange={(e) => onChange({ ...pricing, depositOverride: e.target.value })}
            />
          </div>

          {cost != null && !tier && (
            <p className="rounded-xl bg-[#FFF8EB] px-4 py-2.5 text-xs text-[#875200]">
              ต้นทุนอยู่นอกช่วง {range} ระบบไม่จัดเทียร์ให้ — กำหนดค่าเช่าเองรายไซส์
              {override == null && ' และกรอกมัดจำเองรายไซส์ (หรือใส่มัดจำกำหนดเองด้านบน)'}
            </p>
          )}

          {tier && rent != null && (
            <div className="rounded-xl bg-[#FAFAFB] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-900">เทียร์ {tier.tierId}</span> · ค่าเช่าแนะนำ{' '}
                  <span className="font-semibold text-gray-900">{formatBaht(rent)}</span>
                  <span className="text-gray-500">
                    {' '}
                    (ช่วงเทียร์ {formatBaht(tier.rentMin)}–{formatBaht(tier.rentMax)})
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => onApplyRent(rent)}
                  disabled={variants.length === 0 || allApplied}
                  className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {allApplied ? 'ใช้กับทุกไซส์แล้ว' : variants.length === 0 ? 'เลือกไซส์ก่อน' : 'ใช้ค่าเช่านี้กับทุกไซส์'}
                </button>
              </div>

              <p className="mb-2 mt-4 text-xs font-semibold text-[#5B6472]">
                มัดจำเช่าทั้งชุด ตามรอบของชุดแต่ละตัว{override != null && ' — ใช้มัดจำกำหนดเองแทนทุกรอบ'}
              </p>
              <ol className={`grid grid-cols-5 gap-2 text-center ${override != null ? 'opacity-40' : ''}`}>
                {[1, 2, 3, 4, 5].map((round) => (
                  <li key={round} className="rounded-lg bg-white px-1 py-2 ring-1 ring-inset ring-gray-200">
                    <span className="block text-[11px] text-gray-500">{round === 5 ? 'รอบ 5+' : `รอบ ${round}`}</span>
                    <span className="block text-sm font-semibold tabular-nums text-gray-900">
                      {formatBaht(depositForRound(tier, round))}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-gray-500">
                นับรอบเฉพาะครั้งที่ลูกค้าคืนและตรวจสภาพเสร็จแล้ว ตัวที่ซื้อเพิ่มทีหลังเริ่มรอบ 1 ใหม่ · เช่าแยกชิ้นคิดมัดจำตามสัดส่วนราคา
              </p>
            </div>
          )}

          {mode.auto && (
            <p className="text-xs text-gray-500">มัดจำคิดอัตโนมัติ ช่องมัดจำรายไซส์ด้านล่างจึงไม่ต้องกรอก</p>
          )}

          {lowRent.length > 0 && minRent != null && (
            <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-2.5 text-xs text-[#B42318]">
              ไซส์ {lowRent.map((v) => v.size).join(', ')} ค่าเช่าต่ำกว่า 40% ของต้นทุน ({formatBaht(minRent)}) — จะคืนทุนช้ากว่า 3 รอบ
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}
