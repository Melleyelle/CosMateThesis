'use client'

import { useState } from 'react'
import SectionCard from './Sectioncard'
import { FormField } from './FormFields'
import type { ProductPricing } from './types'
import {
  AUTO_COST_MAX,
  AUTO_COST_MIN,
  MIN_RENT,
  PHASE_LABEL,
  SLOW_PAYBACK_PERCENT,
  beyondDepositTable,
  depositForRent,
  isAutoCost,
  paybackRounds,
  savePhaseSettings,
  suggestedPrices,
  type DepositTier,
  type PhaseSettings,
  type PricePhase,
} from '@/utils/rentalTiers'
import { formatBaht } from '@/utils/dateUtils'

type Props = {
  pricing: ProductPricing
  onChange: (pricing: ProductPricing) => void
  tiers: DepositTier[]
  phase: PhaseSettings
  onPhaseChange: (phase: PhaseSettings) => void
  configError: string | null
}

const PRICE_KEY: Record<PricePhase, 'priceNew' | 'priceNormal' | 'priceOld'> = {
  new: 'priceNew',
  normal: 'priceNormal',
  old: 'priceOld',
}

// ต้นทุนชุด → ค่าเช่า 3 ช่วง (ใช้กับทุกไซส์) + มัดจำตามตาราง + พรีวิวการคืนทุน (docs/deposit-pricing-spec.md v2)
// ต้นทุนอยู่ในช่วง 600–2,500 = ระบบเติมราคาให้ · นอกช่วง/ไม่มีต้นทุน = แอดมินกำหนดเอง
export default function PricingCard({ pricing, onChange, tiers, phase, onPhaseChange, configError }: Props) {
  const cost = pricing.costPrice.trim() ? Number(pricing.costPrice) : null
  const auto = isAutoCost(cost)
  const suggested = auto ? suggestedPrices(cost) : null
  const prices: Record<PricePhase, number | null> = {
    new: pricing.priceNew.trim() ? Number(pricing.priceNew) : null,
    normal: pricing.priceNormal.trim() ? Number(pricing.priceNormal) : null,
    old: pricing.priceOld.trim() ? Number(pricing.priceOld) : null,
  }
  const override = pricing.depositOverride.trim() ? Number(pricing.depositOverride) : null
  const depositOf = (rent: number | null) => (rent == null ? null : (override ?? depositForRent(tiers, rent)))
  const differsFromSuggested =
    suggested != null && (['new', 'normal', 'old'] as const).some((k) => prices[k] !== suggested[k])

  // ไม่มีต้นทุน = ไม่มีช่วงชุดใหม่ (ถือว่าคืนทุนแล้ว) เริ่มที่ราคาปกติ
  const hasCost = cost != null && cost > 0
  const rounds = hasCost && prices.new != null ? paybackRounds(cost, prices.new) : null
  const firstLoss = hasCost && prices.new != null ? cost - prices.new - (depositOf(prices.new) ?? 0) : null

  function changeCost(value: string) {
    const next = { ...pricing, costPrice: value }
    const n = value.trim() ? Number(value) : null
    // ยังไม่ได้แก้ราคาเอง → ราคาตามต้นทุนใหม่ทันที
    if (!pricing.manual && isAutoCost(n)) {
      const s = suggestedPrices(n)
      Object.assign(next, { priceNew: String(s.new), priceNormal: String(s.normal), priceOld: String(s.old) })
    }
    onChange(next)
  }

  function applySuggested() {
    if (!suggested) return
    onChange({
      ...pricing,
      priceNew: String(suggested.new),
      priceNormal: String(suggested.normal),
      priceOld: String(suggested.old),
      manual: false,
    })
  }

  const lowPrices = (['new', 'normal', 'old'] as const).filter((k) => prices[k] != null && prices[k]! < MIN_RENT)
  const slowPayback =
    hasCost && prices.new != null && rounds != null && prices.new < (cost * SLOW_PAYBACK_PERCENT) / 100
  const beyondTable =
    override == null && (['new', 'normal', 'old'] as const).some((k) => prices[k] != null && beyondDepositTable(tiers, prices[k]!))

  const roundText: Record<PricePhase, string> = {
    new: !hasCost ? 'ไม่มีต้นทุน ข้ามช่วงนี้' : rounds != null ? `รอบที่ 1–${rounds}` : '—',
    normal: !hasCost ? 'ตั้งแต่รอบแรก' : rounds != null ? `ตั้งแต่รอบที่ ${rounds + 1}` : '—',
    old: phase.oldEnabled ? `ตั้งแต่รอบที่ ${phase.oldAfter + 1}` : 'ปิดอยู่ทั้งร้าน',
  }

  return (
    <SectionCard
      title="ต้นทุน ค่าเช่า และมัดจำ"
      subtitle="ใช้กับทุกไซส์ ระบบลดค่าเช่าของชุดแต่ละตัวเองตามรอบที่ถูกเช่า มัดจำคิดจากค่าเช่า ณ ตอนจอง"
    >
      {configError ? (
        <p className="rounded-xl bg-[#FFF8EB] px-4 py-2.5 text-xs text-[#875200]">
          ยังไม่ได้รัน SQL Step 25 — บันทึกค่าเช่าและมัดจำแบบใหม่ไม่ได้
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
              placeholder="เว้นว่าง = กำหนดค่าเช่าเอง"
              value={pricing.costPrice}
              onChange={(e) => changeCost(e.target.value)}
            />
            <FormField
              id="deposit-override"
              label="มัดจำกำหนดเอง (ไม่บังคับ)"
              type="number"
              min="0"
              step="1"
              placeholder="เว้นว่าง = ตามตารางมัดจำ"
              value={pricing.depositOverride}
              onChange={(e) => onChange({ ...pricing, depositOverride: e.target.value })}
            />
          </div>

          {cost != null && !auto && (
            <p className="rounded-xl bg-[#FFF8EB] px-4 py-2.5 text-xs text-[#875200]">
              ต้นทุนอยู่นอกช่วง {formatBaht(AUTO_COST_MIN)}–{formatBaht(AUTO_COST_MAX)} ระบบไม่เสนอราคาให้ กำหนดค่าเช่าเองทั้ง 3 ช่วง
            </p>
          )}

          {suggested && differsFromSuggested && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FAFAFB] px-4 py-2.5">
              <p className="text-xs text-gray-600">
                ราคาที่ระบบแนะนำ: {PHASE_LABEL.new} {formatBaht(suggested.new)} · {PHASE_LABEL.normal}{' '}
                {formatBaht(suggested.normal)} · {PHASE_LABEL.old} {formatBaht(suggested.old)}
              </p>
              <button
                type="button"
                onClick={applySuggested}
                className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-400"
              >
                ใช้ราคาที่แนะนำ
              </button>
            </div>
          )}

          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(['new', 'normal', 'old'] as const).map((k) => {
              const deposit = depositOf(prices[k])
              const dim = (k === 'new' && !hasCost) || (k === 'old' && !phase.oldEnabled)
              return (
                <li key={k} className={`rounded-xl bg-[#FAFAFB] p-3 ring-1 ring-inset ring-gray-200 ${dim ? 'opacity-50' : ''}`}>
                  <FormField
                    id={`price-${k}`}
                    label={`${PHASE_LABEL[k]} (บาท)`}
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={pricing[PRICE_KEY[k]]}
                    onChange={(e) => onChange({ ...pricing, [PRICE_KEY[k]]: e.target.value, manual: true })}
                  />
                  <p className="mt-2 text-xs tabular-nums text-gray-600">
                    มัดจำ <span className="font-semibold text-gray-900">{deposit != null ? formatBaht(deposit) : '—'}</span>
                    <span className="block text-gray-500">{roundText[k]}</span>
                  </p>
                </li>
              )
            })}
          </ol>

          {rounds != null && firstLoss != null && (
            <p className="text-xs text-gray-600">
              คาดว่าจะคืนทุนหลังรอบที่ {rounds} · ถ้าลูกค้าไม่คืนชุดในรอบแรก: ร้านได้{' '}
              {formatBaht(prices.new! + (depositOf(prices.new) ?? 0))}
              {firstLoss > 0 ? ` / ขาด ${formatBaht(firstLoss)}` : ' ครอบคลุมต้นทุน'}
            </p>
          )}

          {slowPayback && (
            <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-2.5 text-xs text-[#B42318]">
              ราคาชุดใหม่ต่ำกว่า {SLOW_PAYBACK_PERCENT}% ของต้นทุน ชุดนี้จะคืนทุนช้าลงเป็น {rounds} รอบ
            </p>
          )}
          {lowPrices.length > 0 && (
            <p role="alert" className="rounded-xl bg-[#FDE8E8] px-4 py-2.5 text-xs text-[#B42318]">
              {lowPrices.map((k) => PHASE_LABEL[k]).join(', ')} ต่ำกว่าค่าเช่าขั้นต่ำ {formatBaht(MIN_RENT)}
            </p>
          )}
          {beyondTable && (
            <p className="rounded-xl bg-[#FFF8EB] px-4 py-2.5 text-xs text-[#875200]">
              ค่าเช่าเกินตารางมัดจำ ระบบใช้มัดจำเทียร์สูงสุด ถ้าต้องการมากกว่านี้ให้ใส่มัดจำกำหนดเอง
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={pricing.priceLocked}
              onChange={(e) => onChange({ ...pricing, priceLocked: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[#E5457F]"
            />
            <span>
              ล็อกราคา
              <span className="block text-xs text-gray-500">
                ไม่ปรับช่วงราคาอัตโนมัติ ชุดแต่ละตัวคงช่วงราคาปัจจุบันไว้ (เช่น ชุดที่คนต้องการเยอะ) · ตัวที่เพิ่มหลังล็อกใช้ราคาชุดใหม่
              </span>
            </span>
          </label>

          <PhaseSettingsRow phase={phase} onChange={onPhaseChange} />
        </div>
      )}
    </SectionCard>
  )
}

// ช่วงชุดเก่าเป็นค่าของทั้งร้าน — แก้ที่นี่แล้วมีผลกับทุกชุดทันที
function PhaseSettingsRow({ phase, onChange }: { phase: PhaseSettings; onChange: (p: PhaseSettings) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(phase)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!Number.isInteger(draft.oldAfter) || draft.oldAfter < 1 || draft.oldAfter > 100) {
      return setError('จำนวนรอบต้องเป็น 1–100')
    }
    setSaving(true)
    const err = await savePhaseSettings(draft)
    setSaving(false)
    if (err) return setError(err)
    setError(null)
    setEditing(false)
    onChange(draft)
  }

  return (
    <div className="border-t border-gray-100 pt-3 text-xs text-gray-600">
      {!editing ? (
        <p className="flex flex-wrap items-center gap-x-2">
          ช่วงชุดเก่า (ตั้งค่าทั้งร้าน):{' '}
          <span className="font-semibold text-gray-900">
            {phase.oldEnabled ? `เปิด · เมื่อเช่าคืนสำเร็จครบ ${phase.oldAfter} รอบ` : 'ปิด'}
          </span>
          <button
            type="button"
            onClick={() => {
              setDraft(phase)
              setEditing(true)
            }}
            className="font-semibold text-[#E5457F] hover:underline"
          >
            เปลี่ยน
          </button>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.oldEnabled}
              onChange={(e) => setDraft({ ...draft, oldEnabled: e.target.checked })}
              className="h-4 w-4 accent-[#E5457F]"
            />
            เปิดช่วงชุดเก่า
          </label>
          <label className="flex items-center gap-2">
            หลังเช่าครบ
            <input
              type="number"
              min="1"
              max="100"
              value={draft.oldAfter}
              disabled={!draft.oldEnabled}
              onChange={(e) => setDraft({ ...draft, oldAfter: Math.floor(Number(e.target.value)) })}
              className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm"
            />
            รอบ
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-[#263544] px-4 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึก (ทุกชุด)'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="font-medium text-gray-500">
            ยกเลิก
          </button>
          {error && <p role="alert" className="w-full text-[#B42318]">{error}</p>}
        </div>
      )}
    </div>
  )
}
