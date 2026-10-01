import type { ReactNode } from 'react'
import CustomerNavbar from './CustomerNavbar'
import CustomerFooter from './CustomerFooter'

// โครงหน้าฝั่งลูกค้าทุกหน้า: navbar + เนื้อหา + footer
// width="full" ให้หน้าจัดความกว้างเอง (เช่น หน้าสำรวจชุดที่มีแถบตัวกรองชิดซ้าย)
export default function CustomerLayout({
  children,
  width = 'default',
}: {
  children: ReactNode
  width?: 'default' | 'full'
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <CustomerNavbar />
      <main className={`flex-1 ${width === 'full' ? '' : 'mx-auto w-full max-w-6xl px-4 py-8 sm:px-6'}`}>
        {children}
      </main>
      <CustomerFooter />
    </div>
  )
}
