// รวม type ของฟอร์มทั้ง 4 สเตปไว้ที่เดียว ให้ step ต่าง ๆ import ใช้ร่วมกันได้

export type FranchiseType =
  | 'anime'
  | 'manga'
  | 'game'
  | 'movie_series'
  | 'vtuber'
  | 'original'

export type CostumeCategory = 'cosplay' | 'fancy' | 'props_shoes'
export type GenderTag = 'male' | 'female' | 'unisex'
export type SizeOption = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Free Size'

// สเตป 1 — ตรงกับตาราง products
export type ProductBasicInfo = {
  skuPrefix: string
  name: string
  characterName: string
  seriesName: string
  franchiseType: FranchiseType | ''
  costumeCategory: CostumeCategory
  genderTag: GenderTag
  colorTags: string[]
  themeTags: string[]
  crossplayFriendly: boolean
  isGroupSet: boolean
  description: string
}

// สเตป 2 — ตรงกับตาราง product_images และ product_inclusions
export type ProductImage = {
  id: string // ใช้ทำ key ในหน้าเว็บเท่านั้น ไม่ใช่ id จริงจากฐานข้อมูล
  previewUrl: string // แสดงทันทีตอนเลือกไฟล์ (blob url ในเครื่อง) ใช้ได้แม้ยังอัปโหลดไม่เสร็จ
  uploadedUrl: string | null // URL จริงจาก Supabase Storage เมื่ออัปโหลดสำเร็จ (เก็บลง image_url ตอนบันทึก)
  uploading: boolean
  error: string | null
}

export type ProductInclusion = {
  id: string
  name: string
  imageUrl: string
  price: string // ค่าเช่าเมื่อลูกค้าเลือกแยกชิ้น — เว้นว่าง = ไม่เปิดให้เช่าแยก (product_inclusions.rental_price)
}

// สเตป 3 — ตรงกับตาราง product_variants และ size_charts
export type ProductVariant = {
  id: string
  size: SizeOption
  packagePrice: string
  packageDays: string
  depositAmount: string
  depositReturnHours: string
  laundryFee: string
  chestIn: string // รอบอก หน่วยนิ้ว
  waistIn: string // รอบเอว หน่วยนิ้ว
  hipIn: string // รอบสะโพก หน่วยนิ้ว
  lengthIn: string // ความยาวชุด หน่วยนิ้ว
  recommendedHeightMin: string // ส่วนสูงแนะนำ ยังเป็นหน่วยซม. ตามปกติ
  recommendedHeightMax: string
}

// สเตป 4 — ตรงกับตาราง product_items
export type ProductItem = {
  id: string
  variantId: string
  itemCode: string
}

export type CostumeFormData = {
  basicInfo: ProductBasicInfo
  coverImage: ProductImage | null // ตรงกับ products.cover_image_url (รูปหน้าปก มีได้รูปเดียว)
  images: ProductImage[] // ตรงกับ product_images (รูปประกอบ มีได้หลายรูป)
  inclusions: ProductInclusion[]
  variants: ProductVariant[]
  items: ProductItem[]
}

export const EMPTY_FORM_DATA: CostumeFormData = {
  basicInfo: {
    skuPrefix: '',
    name: '',
    characterName: '',
    seriesName: '',
    franchiseType: '',
    costumeCategory: 'cosplay',
    genderTag: 'unisex',
    colorTags: [],
    themeTags: [],
    crossplayFriendly: false,
    isGroupSet: false,
    description: '',
  },
  coverImage: null,
  images: [],
  inclusions: [],
  variants: [],
  items: [],
}