import type { ReactNode } from 'react'
import CustomerNavbar from './CustomerNavbar'
import CustomerFooter from './CustomerFooter'

interface CustomerLayoutProps {
  children: ReactNode
  width?: 'default' | 'full'
}

export default function CustomerLayout({ children, width = 'default' }: CustomerLayoutProps) {
  return (
    <>
      <CustomerNavbar />
      <main className={width === 'full' ? 'w-full' : 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6'}>
        {children}
      </main>
      <CustomerFooter />
    </>
  )
}