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
export type ClothingSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Free Size'
export type ShoeSize = '35' | '36' | '37' | '38' | '39' | '40' | '41' | '42' | '43' | '44' | '45'
export type SizeOption = ClothingSize | ShoeSize

// ระบบไซส์ของชุด (products.size_system — Step 18)
// clothing = ไซส์ตัวอักษร วัดอก/เอว/สะโพกเป็นนิ้ว · shoes = ไซส์ EU วัดความยาวเท้าเป็นซม.
export type SizeSystem = 'clothing' | 'shoes'

export const CLOTHING_SIZES: ClothingSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size']
export const SHOE_SIZES: ShoeSize[] = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']

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
  sizeSystem: SizeSystem
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
  laundryFee: string // ค่าซักรีดเมื่อเช่าแยกชิ้น (ไม่บังคับ, ว่าง = 0) (product_inclusions.laundry_fee)
  // ชิ้นนี้คือรองเท้าที่มากับชุด → id สินค้ารองเท้าในคลัง ('' = ชิ้นส่วนทั่วไป) (product_inclusions.shoe_product_id, Step 19)
  shoeProductId: string
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
  // ช่วงสัดส่วนที่ใส่ได้ หน่วยนิ้ว — ค่าต่ำสุดเก็บที่ chest_in/waist_in/hip_in เดิม ค่าสูงสุดที่ *_max_in (Step 18)
  chestIn: string
  chestMaxIn: string
  waistIn: string
  waistMaxIn: string
  hipIn: string
  hipMaxIn: string
  lengthIn: string // ความยาวชุด หน่วยนิ้ว
  recommendedHeightMin: string // ส่วนสูงแนะนำ ยังเป็นหน่วยซม. ตามปกติ
  recommendedHeightMax: string
  footMinCm: string // ความยาวเท้า ต่ำสุด (ซม.) — รองเท้าเท่านั้น
  footMaxCm: string
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
    sizeSystem: 'clothing',
  },
  coverImage: null,
  images: [],
  inclusions: [],
  variants: [],
  items: [],
}