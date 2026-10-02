import Image from 'next/image'

// โลโก้หลักจาก public/images/logo.png ใช้ร่วมกันทั้งฝั่งลูกค้าและหลังร้าน
export default function CosMateLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const height = size === 'lg' ? 'h-10' : size === 'sm' ? 'h-7' : 'h-8'
  return <Image src="/images/logo.png" alt="CosMate" width={1144} height={274} priority className={`${height} w-auto`} />
}
