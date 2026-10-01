import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border-2 border-[#263544] bg-white p-6 shadow-[6px_6px_0_0_#263544] sm:p-10">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#263544]">{title}</h1>
          <p className="mt-2 text-gray-600">{subtitle}</p>
        </header>
        {children}
      </section>
    </main>
  )
}