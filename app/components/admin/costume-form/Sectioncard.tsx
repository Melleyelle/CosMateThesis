type Props = {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}

// การ์ดสีขาวมุมโค้งที่ใช้ห่อแต่ละหมวดของฟอร์ม ให้หน้าตาเหมือนกันทุกส่วน
export default function SectionCard({ title, subtitle, action, children }: Props) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}