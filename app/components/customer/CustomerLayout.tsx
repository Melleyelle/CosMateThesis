import type { ReactNode } from 'react'
import CustomerNavbar from './CustomerNavbar'
import CustomerFooter from './CustomerFooter'
import LineContact from './LineContact'

interface CustomerLayoutProps {
  children: ReactNode
  width?: 'default' | 'full'
  /** ซ่อนปุ่มลอย "ติดต่อแอดมิน" — ใช้กับหน้าที่มีแถบปุ่มติดล่างจอ (เช่น หน้าชำระเงิน) จะได้ไม่ทับกัน */
  hideContact?: boolean
}

export default function CustomerLayout({ children, width = 'default', hideContact = false }: CustomerLayoutProps) {
  return (
    <>
      <CustomerNavbar />
      <main className={width === 'full' ? 'w-full' : 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6'}>
        {children}
      </main>
      <CustomerFooter />
      {!hideContact && <LineContact />}
    </>
  )
}