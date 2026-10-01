import Image from 'next/image'

type Props = {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-white px-6 py-10"
    >
      <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* รูปประกอบ: แสดงเฉพาะจอ lg (>= 1024px) ขึ้นไป จอเล็กซ่อนไว้ให้ฟอร์มขึ้นก่อน */}
        <div className="hidden lg:block">
          <Image
            src="/images/img-login.png"
            alt="ตัวอย่างชุดคอสเพลย์จาก CosMate"
            width={1000}
            height={1000}
            sizes="50vw"
            priority
            className="h-auto w-full"
          />
        </div>

        {/* ฝั่งฟอร์ม */}
        <div className="mx-auto w-full max-w-lg">
          <header className="mb-10">
            <h1 className="text-[40px] font-extrabold! text-[#E5457F]">{title}</h1>
            {subtitle && <p className="mt-1 text-lg text-gray-500 sm:text-xl">{subtitle}</p>}
          </header>
          {children}
        </div>
      </div>
    </main>
  )
}
