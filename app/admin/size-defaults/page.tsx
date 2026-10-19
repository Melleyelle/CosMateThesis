'use client'

import { useEffect, useState } from 'react'
import AdminLayout from '@/app/components/admin/AdminLayout'
import { PageHeader, Panel, primaryButtonClass } from '@/app/components/admin/ui'
import {
  fetchSizeDefaults,
  saveClothingDefaults,
  saveShoeDefaults,
  type ClothingDefault,
  type ShoeDefault,
} from '@/utils/sizeDefaults'

// ไซส์มาตรฐานของร้าน (Step 18) — ค่าที่ฟอร์มเพิ่มชุดเติมให้อัตโนมัติเมื่อเลือกไซส์
// แก้ตรงนี้ไม่กระทบชุดที่บันทึกไปแล้ว (แต่ละชุดเก็บสัดส่วนของตัวเองใน size_charts)

const CLOTHING_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
type ClothingDraft = Omit<ClothingDefault, 'chestMin' | 'chestMax' | 'waistMin' | 'waistMax' | 'hipMin' | 'hipMax'> &
  Record<'chestMin' | 'chestMax' | 'waistMin' | 'waistMax' | 'hipMin' | 'hipMax', string>
type ShoeDraft = { size: string; footMin: string; footMax: string }

const CLOTHING_PAIRS = [
  { label: 'รอบอก', min: 'chestMin', max: 'chestMax' },
  { label: 'รอบเอว', min: 'waistMin', max: 'waistMax' },
  { label: 'รอบสะโพก', min: 'hipMin', max: 'hipMax' },
] as const

function toClothingDraft(r: ClothingDefault): ClothingDraft {
  return {
    size: r.size,
    chestMin: String(r.chestMin),
    chestMax: String(r.chestMax),
    waistMin: String(r.waistMin),
    waistMax: String(r.waistMax),
    hipMin: String(r.hipMin),
    hipMax: String(r.hipMax),
  }
}

const isBad = (min: string, max: string) =>
  min.trim() === '' || max.trim() === '' || Number(min) > Number(max) || Number(min) <= 0

function NumberCell({
  value,
  onChange,
  invalid,
  label,
  step,
}: {
  value: string
  onChange: (v: string) => void
  invalid: boolean
  label: string
  step: string
}) {
  return (
    <input
      type="number"
      min="0"
      step={step}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-16 rounded-lg border bg-white px-2 py-1.5 text-center text-sm tabular-nums text-[#263544] outline-none focus:ring-2 ${
        invalid
          ? 'border-[#D92D20] focus:ring-[#D92D20]/15'
          : 'border-[#D5D9E0] focus:border-[#E5457F] focus:ring-[#E5457F]/15'
      }`}
    />
  )
}

function SaveBar({
  dirty,
  saving,
  message,
  error,
  disabled,
  onSave,
}: {
  dirty: boolean
  saving: boolean
  message: string | null
  error: string | null
  disabled: boolean
  onSave: () => void
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[#EEEDF2] pt-4">
      {error && <p className="mr-auto text-sm text-[#B42318]">{error}</p>}
      {!error && message && <p className="mr-auto text-sm text-[#2E7D4F]">{message}</p>}
      {!error && !message && dirty && <p className="mr-auto text-sm text-[#875200]">ยังไม่ได้บันทึก</p>}
      <button type="button" onClick={onSave} disabled={!dirty || saving || disabled} className={primaryButtonClass}>
        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </div>
  )
}

export default function SizeDefaultsPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [clothing, setClothing] = useState<ClothingDraft[]>([])
  const [clothingDirty, setClothingDirty] = useState(false)
  const [clothingSaving, setClothingSaving] = useState(false)
  const [clothingMsg, setClothingMsg] = useState<string | null>(null)
  const [clothingErr, setClothingErr] = useState<string | null>(null)

  const [shoes, setShoes] = useState<ShoeDraft[]>([])
  const [shoesDirty, setShoesDirty] = useState(false)
  const [shoesSaving, setShoesSaving] = useState(false)
  const [shoesMsg, setShoesMsg] = useState<string | null>(null)
  const [shoesErr, setShoesErr] = useState<string | null>(null)

  useEffect(() => {
    fetchSizeDefaults().then(({ data, error }) => {
      if (error) setLoadError(error)
      setClothing(data.clothing.map(toClothingDraft))
      setShoes(
        data.shoes
          .map((r) => ({ size: r.size, footMin: String(r.footMin), footMax: String(r.footMax) }))
          .sort((a, b) => Number(a.size) - Number(b.size)),
      )
      setLoading(false)
    })
  }, [])

  const clothingRows = [...clothing].sort((a, b) => CLOTHING_ORDER.indexOf(a.size) - CLOTHING_ORDER.indexOf(b.size))

  const clothingInvalid = clothing.some((r) => CLOTHING_PAIRS.some((p) => isBad(r[p.min], r[p.max])))
  const shoesInvalid = shoes.some((r) => isBad(r.footMin, r.footMax))

  function editClothing(size: string, key: keyof ClothingDraft, value: string) {
    setClothing((rows) => rows.map((r) => (r.size === size ? { ...r, [key]: value } : r)))
    setClothingDirty(true)
    setClothingMsg(null)
    setClothingErr(null)
  }

  function editShoe(size: string, key: 'footMin' | 'footMax', value: string) {
    setShoes((rows) => rows.map((r) => (r.size === size ? { ...r, [key]: value } : r)))
    setShoesDirty(true)
    setShoesMsg(null)
    setShoesErr(null)
  }

  async function saveClothing() {
    if (clothingInvalid) {
      setClothingErr('มีช่องว่างหรือค่าต่ำสุดมากกว่าสูงสุด (กรอบสีแดง)')
      return
    }
    setClothingSaving(true)
    const error = await saveClothingDefaults(
      clothing.map((r) => ({
        size: r.size,
        chestMin: Number(r.chestMin),
        chestMax: Number(r.chestMax),
        waistMin: Number(r.waistMin),
        waistMax: Number(r.waistMax),
        hipMin: Number(r.hipMin),
        hipMax: Number(r.hipMax),
      })),
    )
    setClothingSaving(false)
    if (error) {
      setClothingErr(error)
      return
    }
    setClothingDirty(false)
    setClothingMsg('บันทึกแล้ว ชุดที่เพิ่มใหม่จะใช้ค่านี้')
  }

  async function saveShoes() {
    if (shoesInvalid) {
      setShoesErr('มีช่องว่างหรือค่าต่ำสุดมากกว่าสูงสุด (กรอบสีแดง)')
      return
    }
    setShoesSaving(true)
    const error = await saveShoeDefaults(
      shoes.map((r) => ({ size: r.size, footMin: Number(r.footMin), footMax: Number(r.footMax) })),
    )
    setShoesSaving(false)
    if (error) {
      setShoesErr(error)
      return
    }
    setShoesDirty(false)
    setShoesMsg('บันทึกแล้ว รองเท้าที่เพิ่มใหม่จะใช้ค่านี้')
  }

  return (
    <AdminLayout>
      <div className="px-5 pb-16 pt-7 sm:px-8">
        <PageHeader
          title="ไซส์มาตรฐาน"
          description="ค่าที่ระบบเติมให้เมื่อเลือกไซส์ในฟอร์มเพิ่มชุด แก้ตรงนี้ไม่เปลี่ยนชุดที่บันทึกไปแล้ว"
        />

        {loadError && (
          <p role="alert" className="mb-6 rounded-xl bg-[#FDE8E8] px-4 py-3 text-sm text-[#B42318]">
            โหลดไม่สำเร็จ: {loadError}
          </p>
        )}

        {loading ? (
          <div className="h-80 animate-pulse rounded-2xl bg-white" />
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Panel
              title="เสื้อผ้า (นิ้ว)"
              description="สัดส่วนร่างกายลูกค้าที่ใส่ไซส์นั้นได้ ใช้ตารางเดียวกับชุดทุกตัว ไม่แยกเพศ"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[#6B7280]">
                      <th className="pb-2 pr-3 font-medium">ไซส์</th>
                      {CLOTHING_PAIRS.map((p) => (
                        <th key={p.label} className="pb-2 pr-3 font-medium">
                          {p.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEEDF2]">
                    {clothingRows.map((r) => (
                      <tr key={r.size}>
                        <td className="py-2 pr-3 font-bold text-[#263544]">{r.size}</td>
                        {CLOTHING_PAIRS.map((p) => {
                          const bad = isBad(r[p.min], r[p.max])
                          return (
                            <td key={p.label} className="py-2 pr-3">
                              <span className="inline-flex items-center gap-1.5">
                                <NumberCell
                                  label={`${r.size} ${p.label} ต่ำสุด`}
                                  step="0.5"
                                  value={r[p.min]}
                                  invalid={bad}
                                  onChange={(v) => editClothing(r.size, p.min, v)}
                                />
                                <span aria-hidden className="text-[#9AA3AF]">–</span>
                                <NumberCell
                                  label={`${r.size} ${p.label} สูงสุด`}
                                  step="0.5"
                                  value={r[p.max]}
                                  invalid={bad}
                                  onChange={(v) => editClothing(r.size, p.max, v)}
                                />
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clothingRows.length === 0 && (
                  <p className="py-6 text-center text-sm text-[#6B7280]">ยังไม่มีข้อมูล — รัน SQL Step 18 ก่อน</p>
                )}
              </div>
              <p className="mt-3 text-xs text-[#6B7280]">
                Free Size ไม่มีค่ามาตรฐาน กรอกสัดส่วนในหน้าชุดนั้นเอง
              </p>
              <SaveBar
                dirty={clothingDirty}
                saving={clothingSaving}
                message={clothingMsg}
                error={clothingErr}
                disabled={clothing.length === 0}
                onSave={saveClothing}
              />
            </Panel>

            <Panel title="รองเท้า (ซม.)" description="ความยาวเท้าที่ใส่ไซส์ EU นั้นได้ ใช้ตารางเดียวทั้งหญิงและชาย">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#6B7280]">
                    <th className="pb-2 pr-3 font-medium">ไซส์ EU</th>
                    <th className="pb-2 font-medium">ความยาวเท้า</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEDF2]">
                  {shoes.map((r) => {
                    const bad = isBad(r.footMin, r.footMax)
                    return (
                      <tr key={r.size}>
                        <td className="py-2 pr-3 font-bold tabular-nums text-[#263544]">{r.size}</td>
                        <td className="py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <NumberCell
                              label={`${r.size} ความยาวเท้า ต่ำสุด`}
                              step="0.1"
                              value={r.footMin}
                              invalid={bad}
                              onChange={(v) => editShoe(r.size, 'footMin', v)}
                            />
                            <span aria-hidden className="text-[#9AA3AF]">–</span>
                            <NumberCell
                              label={`${r.size} ความยาวเท้า สูงสุด`}
                              step="0.1"
                              value={r.footMax}
                              invalid={bad}
                              onChange={(v) => editShoe(r.size, 'footMax', v)}
                            />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {shoes.length === 0 && (
                <p className="py-6 text-center text-sm text-[#6B7280]">ยังไม่มีข้อมูล — รัน SQL Step 18 ก่อน</p>
              )}
              <SaveBar
                dirty={shoesDirty}
                saving={shoesSaving}
                message={shoesMsg}
                error={shoesErr}
                disabled={shoes.length === 0}
                onSave={saveShoes}
              />
            </Panel>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
