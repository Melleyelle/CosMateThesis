import Image from 'next/image'
import Link from 'next/link'

export default function CustomerFooter() {
  return (
    <footer className="mt-16 border-t border-gray-100 bg-white text-[#263544]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <Link href="/" aria-label="CosMate หน้าหลัก" className="inline-block">
            <Image src="/images/logo.png" alt="CosMate" width={1144} height={274} className="h-8 w-auto" />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-[#263544]/70">
            ร้านเช่าชุดคอสเพลย์และแฟนซีออนไลน์ เลือกวันใช้งาน ระบบจัดวันส่งและวันคืนให้อัตโนมัติ
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold text-[#E5457F]">เมนู</p>
          <ul className="space-y-2 text-sm text-[#263544]/80">
            <li>
              <Link href="/costumes" className="hover:text-[#E5457F]">สำรวจชุด</Link>
            </li>
            <li>
              <Link href="/#how-it-works" className="hover:text-[#E5457F]">วิธีการเช่า</Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-[#E5457F]">ตะกร้าของฉัน</Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-[#E5457F]">ออเดอร์ของฉัน</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold text-[#E5457F]">เงื่อนไขการเช่า</p>
          <ul className="space-y-2 text-sm text-[#263544]/80">
            <li>ได้รับชุดก่อนวันใช้งาน 1 วัน</li>
            <li>ส่งคืนภายในวันถัดจากวันใช้งาน</li>
            <li>คืนมัดจำหลังร้านตรวจสภาพชุดเรียบร้อย</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-100 py-4 text-center text-xs text-[#263544]/50">
        © {new Date().getFullYear()} CosMate · โปรเจกต์ธีสิส
      </div>
    </footer>
  )
}
