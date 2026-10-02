import type { ReactNode } from 'react'
import Image from 'next/image'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-6xl items-center gap-12 md:grid-cols-[1fr_1.1fr] lg:gap-20">
        {/* ภาพประกอบซ้าย — ซ่อนบนมือถือเพื่อให้ฟอร์มขึ้นมาก่อน */}
        <div className="hidden md:block">
          <Image
            src="/images/img-login.png"
            alt="ตัวอย่างชุดคอสเพลย์ที่เช่าได้กับ CosMate"
            width={1460}
            height={1424}
            priority
            sizes="(min-width: 1152px) 520px, 45vw"
            className="h-auto w-full"
          />
        </div>

        <section className="w-full">
          <header className="mb-8">
            <h1 className="text-[40px] font-extrabold leading-tight text-[#E5457F]">{title}</h1>
            <p className="mt-2 text-base text-[#263544]/70">{subtitle}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  )
}
