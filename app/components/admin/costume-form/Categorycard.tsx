'use client'

import SectionCard from './Sectioncard'
import { CheckIcon } from '@phosphor-icons/react'
import { FormField, FormSelect } from './FormFields'
import TagInput from './TagInput'
import { COLOR_OPTIONS, colorKeysOf } from '@/utils/customer/filterOptions'
import type { ProductBasicInfo } from './types'

type Props = {
  value: ProductBasicInfo
  onChange: (value: ProductBasicInfo) => void
}

const FRANCHISE_OPTIONS: { value: ProductBasicInfo['franchiseType']; label: string }[] = [
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
  { value: 'game', label: 'Game' },
  { value: 'movie_series', label: 'Movie / Series' },
  { value: 'vtuber', label: 'VTuber' },
  { value: 'original', label: 'Original' },
]

// จัดหมวดหมู่ + แท็กสำหรับค้นหา/กรอง แยกออกมาจากข้อมูลทั่วไปเพื่อให้แต่ละการ์ดไม่ยาวเกินไป
export default function CategoryCard({ value, onChange }: Props) {
  function set<K extends keyof ProductBasicInfo>(key: K, val: ProductBasicInfo[K]) {
    onChange({ ...value, [key]: val })
  }

  return (
    <SectionCard title="หมวดหมู่และรายละเอียด" subtitle="ใช้จัดกลุ่มและค้นหาในหน้าคลังชุด/หน้าลูกค้า">
      <div className="space-y-4">
        <FormSelect
          id="franchiseType"
          label="ประเภทผลงาน"
          value={value.franchiseType}
          onChange={(e) => set('franchiseType', e.target.value as ProductBasicInfo['franchiseType'])}
        >
          <option value="">เลือกประเภทผลงาน</option>
          {FRANCHISE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </FormSelect>

        <FormSelect
          id="costumeCategory"
          label="หมวดหมู่สินค้า"
          value={value.costumeCategory}
          onChange={(e) => set('costumeCategory', e.target.value as ProductBasicInfo['costumeCategory'])}
        >
          <option value="cosplay">Cosplay</option>
          <option value="fancy">Fancy</option>
          <option value="props_shoes">พร็อพ / รองเท้า</option>
        </FormSelect>

        <FormSelect
          id="genderTag"
          label="เพศของตัวละคร"
          value={value.genderTag}
          onChange={(e) => set('genderTag', e.target.value as ProductBasicInfo['genderTag'])}
        >
          <option value="unisex">Unisex</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </FormSelect>

        <FormField
          id="characterName"
          label="ชื่อตัวละคร"
          placeholder="เช่น Nezuko Kamado"
          value={value.characterName}
          onChange={(e) => set('characterName', e.target.value)}
        />
        <FormField
          id="seriesName"
          label="ชื่อเรื่อง/ผลงานต้นฉบับ"
          placeholder="เช่น Kimetsu no Yaiba"
          value={value.seriesName}
          onChange={(e) => set('seriesName', e.target.value)}
        />

        <ColorPicker
          selected={colorKeysOf(value.colorTags)}
          onChange={(keys) => set('colorTags', keys)}
        />
        <TagInput
          label="แท็กธีมงาน"
          placeholder="พิมพ์ธีมแล้วกด Enter"
          tags={value.themeTags}
          onChange={(tags) => set('themeTags', tags)}
        />
      </div>
    </SectionCard>
  )
}

// กดเลือกสีจากชุดสีเดียวกับตัวกรองหน้าลูกค้า — ไม่ต้องพิมพ์ และไม่มีสีสะกดผิดจนกรองไม่เจอ
function ColorPicker({ selected, onChange }: { selected: string[]; onChange: (keys: string[]) => void }) {
  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-700">
        แท็กสี <span className="font-normal text-gray-400">(กดเลือกได้หลายสี)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {COLOR_OPTIONS.map((c) => {
          const active = selected.includes(c.key)
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm transition ${
                active
                  ? 'border-[#E5457F] bg-[#FCE7EF] font-semibold text-[#C92D67]'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full border border-black/15"
                style={{ backgroundColor: c.hex }}
              >
                {active && <CheckIcon size={12} weight="bold" className="text-white drop-shadow-[0_0_1px_rgba(0,0,0,0.9)]" />}
              </span>
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}