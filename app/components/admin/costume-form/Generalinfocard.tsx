'use client'

import SectionCard from './Sectioncard'
import { FormField } from './FormFields'
import type { ProductBasicInfo } from './types'

type Props = {
	value: ProductBasicInfo
	onChange: (value: ProductBasicInfo) => void
}

export default function GeneralInfoCard({ value, onChange }: Props) {
	function set<K extends keyof ProductBasicInfo>(key: K, fieldValue: ProductBasicInfo[K]) {
		onChange({ ...value, [key]: fieldValue })
	}

	return (
		<SectionCard title="ข้อมูลทั่วไป" subtitle="ข้อมูลหลักของชุดที่แสดงในคลังสินค้า">
			<div className="space-y-4">
				<FormField
					id="skuPrefix"
					label="รหัสอ้างอิงชุด (SKU Prefix)"
					placeholder="เช่น DEMON-SLAYER-01"
					value={value.skuPrefix}
					onChange={(event) => set('skuPrefix', event.target.value)}
					required
				/>
				<FormField
					id="name"
					label="ชื่อชุด"
					placeholder="เช่น ชุดนักล่าอสูร"
					value={value.name}
					onChange={(event) => set('name', event.target.value)}
					required
				/>
			</div>
		</SectionCard>
	)
}
