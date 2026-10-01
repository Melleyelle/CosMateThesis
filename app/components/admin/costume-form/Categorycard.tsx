'use client'

import SectionCard from './Sectioncard'
import { FormField, FormSelect, FormCheckbox } from './FormFields'
import TagInput from './TagInput'
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

        <TagInput
          label="แท็กสี"
          placeholder="พิมพ์สีแล้วกด Enter"
          tags={value.colorTags}
          onChange={(tags) => set('colorTags', tags)}
        />
        <TagInput
          label="แท็กธีมงาน"
          placeholder="พิมพ์ธีมแล้วกด Enter"
          tags={value.themeTags}
          onChange={(tags) => set('themeTags', tags)}
        />

        <div className="flex flex-col gap-2.5 rounded-xl bg-gray-50 px-4 py-3">
          <FormCheckbox
            id="crossplayFriendly"
            label="เหมาะกับการ Crossplay"
            checked={value.crossplayFriendly}
            onChange={(e) => set('crossplayFriendly', e.target.checked)}
          />
          <FormCheckbox
            id="isGroupSet"
            label="เป็นชุดธีมกลุ่ม/คู่"
            checked={value.isGroupSet}
            onChange={(e) => set('isGroupSet', e.target.checked)}
          />
        </div>
      </div>
    </SectionCard>
  )
}