'use client'

import { useEffect, useState } from 'react'
import AdminLayout from '@/app/components/admin/AdminLayout'
import { PageHeader, Panel, primaryButtonClass, secondaryButtonClass } from '@/app/components/admin/ui'
import {
  fetchSizeDefaults,
  saveClothingDefaults,
  saveShoeDefaults,
  type ClothingDefault,
  type ShoeDefault,
} from '@/utils/sizeDefaults'

// ไซส์มาตรฐานของร้าน (Step 18) — ค่าที่ฟอร์มเพิ่มชุดเติมให้อัตโนมัติเมื่อเลือกไซส์
// แก้ตรงนี้ไม่กระทบชุดที่บันทึกไปแล้ว (แต่ละชุดเก็บสัดส่วนของตัวเองใน size_charts)
// แต่ละตารางเปิดมาเป็นโหมดดูอย่างเดียว ต้องกด "แก้ไข" ก่อน กันเผลอแก้ค่าที่ทุกชุดใช้ร่วมกัน

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

// ช่วงต่ำสุด–สูงสุด: โหมดดูเป็นตัวหนังสือ โหมดแก้เป็นช่องกรอก 2 ช่อง
function RangeCell({
  editing,
  label,
  step,
  min,
  max,
  onMin,
  onMax,
}: {
  editing: boolean
  label: string
  step: string
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
}) {
  if (!editing) {
    return (
      <span className="tabular-nums text-[#263544]">
        {min}–{max}
      </span>
    )
  }
  const bad = isBad(min, max)
  return (
    <span className="inline-flex items-center gap-1.5">
      <NumberCell label={`${label} ต่ำสุด`} step={step} value={min} invalid={bad} onChange={onMin} />
      <span aria-hidden className="text-[#9AA3AF]">–</span>
      <NumberCell label={`${label} สูงสุด`} step={step} value={max} invalid={bad} onChange={onMax} />
    </span>
  )
}

function EditButton({ editing, disabled, onClick }: { editing: boolean; disabled: boolean; onClick: () => void }) {
  if (editing) return null
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={secondaryButtonClass}>
      แก้ไข
    </button>
  )
}

function SaveBar({
  dirty,
  saving,
  message,
  error,
  editing,
  onCancel,
  onSave,
}: {
  dirty: boolean
  saving: boolean
  message: string | null
  error: string | null
  editing: boolean
  onCancel: () => void
  onSave: () => void
}) {
  if (!editing && !message) return null
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[#EEEDF2] pt-4">
      {error && <p className="mr-auto text-sm text-[#B42318]">{error}</p>}
      {!error && message && <p className="mr-auto text-sm text-[#2E7D4F]">{message}</p>}
      {!error && !message && dirty && <p className="mr-auto text-sm text-[#875200]">ยังไม่ได้บันทึก</p>}
      {editing && (
        <>
          <button type="button" onClick={onCancel} disabled={saving} className={secondaryButtonClass}>
            ยกเลิก
          </button>
          <button type="button" onClick={onSave} disabled={!dirty || saving} className={primaryButtonClass}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </>
      )}
    </div>
  )
}

export default function SizeDefaultsPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [clothing, setClothing] = useState<ClothingDraft[]>([])
  const [clothingSaved, setClothingSaved] = useState<ClothingDraft[]>([])
  const [clothingEditing, setClothingEditing] = useState(false)
  const [clothingDirty, setClothingDirty] = useState(false)
  const [clothingSaving, setClothingSaving] = useState(false)
  const [clothingMsg, setClothingMsg] = useState<string | null>(null)
  const [clothingErr, setClothingErr] = useState<string | null>(null)

  const [shoes, setShoes] = useState<ShoeDraft[]>([])
  const [shoesSaved, setShoesSaved] = useState<ShoeDraft[]>([])
  const [shoesEditing, setShoesEditing] = useState(false)
  const [shoesDirty, setShoesDirty] = useState(false)
  const [shoesSaving, setShoesSaving] = useState(false)
  const [shoesMsg, setShoesMsg] = useState<string | null>(null)
  const [shoesErr, setShoesErr] = useState<string | null>(null)

  useEffect(() => {
    fetchSizeDefaults().then(({ data, error }) => {
      if (error) setLoadError(error)
      const clothingRows = data.clothing.map(toClothingDraft)
      const shoeRows = data.shoes
        .map((r) => ({ size: r.size, footMin: String(r.footMin), footMax: String(r.footMax) }))
        .sort((a, b) => Number(a.size) - Number(b.size))
      setClothing(clothingRows)
      setClothingSaved(clothingRows)
      setShoes(shoeRows)
      setShoesSaved(shoeRows)
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

  function startEditClothing() {
    setClothingEditing(true)
    setClothingMsg(null)
    setClothingErr(null)
  }

  function cancelClothing() {
    setClothing(clothingSaved)
    setClothingDirty(false)
    setClothingEditing(false)
    setClothingErr(null)
  }

  function startEditShoes() {
    setShoesEditing(true)
    setShoesMsg(null)
    setShoesErr(null)
  }

  function cancelShoes() {
    setShoes(shoesSaved)
    setShoesDirty(false)
    setShoesEditing(false)
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
    setClothingSaved(clothing)
    setClothingDirty(false)
    setClothingEditing(false)
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
    setShoesSaved(shoes)
    setShoesDirty(false)
    setShoesEditing(false)
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
              action={
                <EditButton editing={clothingEditing} disabled={clothing.length === 0} onClick={startEditClothing} />
              }
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
                        {CLOTHING_PAIRS.map((p) => (
                          <td key={p.label} className="py-2 pr-3">
                            <RangeCell
                              editing={clothingEditing}
                              label={`${r.size} ${p.label}`}
                              step="0.5"
                              min={r[p.min]}
                              max={r[p.max]}
                              onMin={(v) => editClothing(r.size, p.min, v)}
                              onMax={(v) => editClothing(r.size, p.max, v)}
                            />
                          </td>
                        ))}
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
                editing={clothingEditing}
                onCancel={cancelClothing}
                onSave={saveClothing}
              />
            </Panel>

            <Panel
              title="รองเท้า (ซม.)"
              description="ความยาวเท้าที่ใส่ไซส์ EU นั้นได้ ใช้ตารางเดียวทั้งหญิงและชาย"
              action={<EditButton editing={shoesEditing} disabled={shoes.length === 0} onClick={startEditShoes} />}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#6B7280]">
                    <th className="pb-2 pr-3 font-medium">ไซส์ EU</th>
                    <th className="pb-2 font-medium">ความยาวเท้า</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEDF2]">
                  {shoes.map((r) => (
                    <tr key={r.size}>
                      <td className="py-2 pr-3 font-bold tabular-nums text-[#263544]">{r.size}</td>
                      <td className="py-2">
                        <RangeCell
                          editing={shoesEditing}
                          label={`${r.size} ความยาวเท้า`}
                          step="0.1"
                          min={r.footMin}
                          max={r.footMax}
                          onMin={(v) => editShoe(r.size, 'footMin', v)}
                          onMax={(v) => editShoe(r.size, 'footMax', v)}
                        />
                      </td>
                    </tr>
                  ))}
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
                editing={shoesEditing}
                onCancel={cancelShoes}
                onSave={saveShoes}
              />
            </Panel>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
