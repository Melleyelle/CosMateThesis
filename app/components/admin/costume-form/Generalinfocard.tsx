'use client'

import SectionCard from './Sectioncard'
import { FormField } from './FormFields'
import type { ProductBasicInfo } from './types'
import {
	SKU_PREFIX_MAX,
	SKU_PREFIX_MIN,
	normalizeSkuPrefix,
	previewItemCode,
	validateSkuPrefix,
} from '@/utils/skuPrefix'

type Props = {
	value: ProductBasicInfo
	onChange: (value: ProductBasicInfo) => void
}

export default function GeneralInfoCard({ value, onChange }: Props) {
	function set<K extends keyof ProductBasicInfo>(key: K, fieldValue: ProductBasicInfo[K]) {
		onChange({ ...value, [key]: fieldValue })
	}

	const sku = value.skuPrefix
	// เตือนทันทีเมื่อรูปแบบผิด (เช่น รหัสเก่าที่มีขีด) แต่ไม่เตือนตอนเพิ่งพิมพ์ตัวแรก
	const skuError = sku.length >= SKU_PREFIX_MIN ? validateSkuPrefix(sku) : null

	return (
		<SectionCard title="ข้อมูลทั่วไป" subtitle="ข้อมูลหลักของชุดที่แสดงในคลังสินค้า">
			<div className="space-y-4">
				<div>
					<FormField
						id="skuPrefix"
						label="รหัสอ้างอิงชุด (SKU Prefix)"
						placeholder="เช่น NEZUKO"
						value={sku}
						// พิมพ์เล็กแปลงเป็นใหญ่, ตัดภาษาไทย/ขีด/ช่องว่าง, ไม่เกิน 12 ตัว (รวมตอนวางข้อความ)
						onChange={(event) => set('skuPrefix', normalizeSkuPrefix(event.target.value))}
						required
					/>
					<div className="mt-1.5 flex items-start justify-between gap-3 text-xs leading-relaxed">
						{skuError ? (
							<p role="alert" className="text-[#B42318]">
								{skuError}
							</p>
						) : (
							<p className="text-[#6E6E6E]">
								A–Z และ 0–9 ยาว {SKU_PREFIX_MIN}–{SKU_PREFIX_MAX} ตัว · ป้ายชุดจริงจะเป็น{' '}
								<span className="font-mono font-semibold text-[#2E2E2E]">{previewItemCode(sku)}</span>
							</p>
						)}
						<span
							className={`shrink-0 tabular-nums ${sku.length >= SKU_PREFIX_MAX ? 'font-semibold text-[#2E2E2E]' : 'text-[#6E6E6E]'}`}
							aria-label={`ใช้ไป ${sku.length} จาก ${SKU_PREFIX_MAX} ตัวอักษร`}
						>
							{sku.length}/{SKU_PREFIX_MAX}
						</span>
					</div>
				</div>
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