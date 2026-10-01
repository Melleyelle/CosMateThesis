import { createClient } from '@/utils/client'

export type SizeFit = 'small' | 'fit' | 'large'

export const SIZE_FIT_LABEL: Record<SizeFit, string> = {
  small: 'คับไป',
  fit: 'พอดี',
  large: 'หลวมไป',
}

export type Review = {
  id: string
  orderItemId: string
  productId: string
  size: string | null
  rating: number
  sizeFit: SizeFit | null
  heightCm: number | null
  comment: string | null
  imageUrls: string[]
  reviewerName: string
  rentedOn: string | null
  isHidden: boolean
  adminReply: string | null
  adminRepliedAt: string | null
  createdAt: string
}

export type RatingSummary = {
  productId: string
  avgRating: number
  reviewCount: number
  stars: Record<1 | 2 | 3 | 4 | 5, number>
  fit: Record<SizeFit, number>
}

type ReviewRow = {
  id: string
  order_item_id: string
  product_id: string
  size: string | null
  rating: number
  size_fit: SizeFit | null
  reviewer_height_cm: number | null
  comment: string | null
  image_urls: string[] | null
  reviewer_name: string
  rented_on: string | null
  is_hidden: boolean
  admin_reply: string | null
  admin_replied_at: string | null
  created_at: string
}

type SummaryRow = {
  product_id: string
  avg_rating: number | string
  review_count: number
  star5: number
  star4: number
  star3: number
  star2: number
  star1: number
  fit_small: number
  fit_ok: number
  fit_large: number
}

const REVIEW_COLUMNS =
  'id, order_item_id, product_id, size, rating, size_fit, reviewer_height_cm, comment, image_urls, reviewer_name, rented_on, is_hidden, admin_reply, admin_replied_at, created_at'

function mapReview(r: ReviewRow): Review {
  return {
    id: r.id,
    orderItemId: r.order_item_id,
    productId: r.product_id,
    size: r.size,
    rating: r.rating,
    sizeFit: r.size_fit,
    heightCm: r.reviewer_height_cm,
    comment: r.comment,
    imageUrls: r.image_urls ?? [],
    reviewerName: r.reviewer_name,
    rentedOn: r.rented_on,
    isHidden: r.is_hidden,
    adminReply: r.admin_reply,
    adminRepliedAt: r.admin_replied_at,
    createdAt: r.created_at,
  }
}

function mapSummary(s: SummaryRow): RatingSummary {
  return {
    productId: s.product_id,
    avgRating: Number(s.avg_rating),
    reviewCount: s.review_count,
    stars: { 5: s.star5, 4: s.star4, 3: s.star3, 2: s.star2, 1: s.star1 },
    fit: { small: s.fit_small, fit: s.fit_ok, large: s.fit_large },
  }
}

// สรุปคะแนนทุกชุด (ใช้กับการ์ดในหน้าสำรวจ) — ถ้ายังไม่ได้รัน Step 11 จะได้ {} เฉย ๆ หน้าไม่พัง
export async function fetchRatingSummaries(productIds?: string[]): Promise<Record<string, RatingSummary>> {
  const supabase = createClient()
  if (!supabase) return {}
  let query = supabase.from('product_rating_summary').select('*')
  if (productIds) {
    if (productIds.length === 0) return {}
    query = query.in('product_id', productIds)
  }
  const { data, error } = await query
  if (error || !data) return {}
  return Object.fromEntries((data as SummaryRow[]).map((s) => [s.product_id, mapSummary(s)]))
}

// รีวิวที่แสดงในหน้ารายละเอียดชุด (RLS กรองรีวิวที่ถูกซ่อนออกให้แล้ว)
export async function fetchProductReviews(
  productId: string,
): Promise<{ reviews: Review[]; summary: RatingSummary | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { reviews: [], summary: null, error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }

  const [list, summaries] = await Promise.all([
    supabase
      .from('product_reviews')
      .select(REVIEW_COLUMNS)
      .eq('product_id', productId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(100),
    fetchRatingSummaries([productId]),
  ])

  if (list.error) return { reviews: [], summary: null, error: list.error.message }
  return {
    reviews: ((list.data ?? []) as ReviewRow[]).map(mapReview),
    summary: summaries[productId] ?? null,
    error: null,
  }
}

// รีวิวของฉันตามรายการเช่า (ใช้ในหน้าออเดอร์ เพื่อรู้ว่ารายการไหนรีวิวแล้ว)
export async function fetchMyReviewsByOrderItem(orderItemIds: string[]): Promise<Record<string, Review>> {
  const supabase = createClient()
  if (!supabase || orderItemIds.length === 0) return {}
  const { data, error } = await supabase
    .from('product_reviews')
    .select(REVIEW_COLUMNS)
    .in('order_item_id', orderItemIds)
  if (error || !data) return {}
  return Object.fromEntries((data as ReviewRow[]).map((r) => [r.order_item_id, mapReview(r)]))
}

// แอดมิน: รีวิวทั้งหมดรวมที่ถูกซ่อน พร้อมชื่อชุด
export async function fetchAllReviewsForAdmin(): Promise<{
  data: (Review & { productName: string })[]
  error: string | null
}> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { data, error } = await supabase
    .from('product_reviews')
    .select(`${REVIEW_COLUMNS}, products ( name )`)
    .order('created_at', { ascending: false })
  if (error) return { data: [], error: error.message }
  return {
    data: ((data ?? []) as unknown as (ReviewRow & { products: { name: string } | null })[]).map((r) => ({
      ...mapReview(r),
      productName: r.products?.name ?? 'ชุดที่ถูกลบ',
    })),
    error: null,
  }
}

export type ReviewInput = {
  orderItemId: string
  rating: number
  sizeFit: SizeFit | null
  comment: string
  imageUrls: string[]
  heightCm: number | null
  anonymous: boolean
}

export async function submitReview(input: ReviewInput): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const { error } = await supabase.rpc('submit_review', {
    p_order_item_id: input.orderItemId,
    p_rating: input.rating,
    p_size_fit: input.sizeFit,
    p_comment: input.comment.trim() || null,
    p_image_urls: input.imageUrls,
    p_height_cm: input.heightCm,
    p_anonymous: input.anonymous,
  })
  return { error: error?.message ?? null }
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // ต้องตรงกับ file_size_limit ของ bucket review-images
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// อัปโหลดรูปรีวิวไปที่ review-images/<user id>/<สุ่ม>.<นามสกุล>
export async function uploadReviewImage(file: File): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_TYPES.includes(file.type)) return { error: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP' }
  if (file.size > MAX_FILE_SIZE) return { error: 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB' }

  const supabase = createClient()
  if (!supabase) return { error: 'Supabase ยังไม่ได้ถูกตั้งค่า' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('review-images')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) return { error: error.message }

  return { url: supabase.storage.from('review-images').getPublicUrl(path).data.publicUrl }
}

// สรุปเรื่องไซส์จากรีวิว เช่น "ส่วนใหญ่บอกว่าไซส์พอดี (8 จาก 10 คน)"
export function sizeFitVerdict(summary: RatingSummary | null): string | null {
  if (!summary) return null
  const total = summary.fit.small + summary.fit.fit + summary.fit.large
  if (total === 0) return null
  const [key, count] = (Object.entries(summary.fit) as [SizeFit, number][]).sort((a, b) => b[1] - a[1])[0]
  return `ส่วนใหญ่บอกว่าไซส์${SIZE_FIT_LABEL[key]} (${count} จาก ${total} คน)`
}
