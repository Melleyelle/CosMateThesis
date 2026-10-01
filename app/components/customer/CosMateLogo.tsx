// โลโก้ข้อความชั่วคราว — ถ้ามีไฟล์โลโก้จริง (เช่น public/logo.png) เปลี่ยนเป็น:
//   <img src="/logo.png" alt="CosMate" className="h-9 w-auto" />
export default function CosMateLogo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span
      className={`font-black tracking-tight text-[#E5457F] ${size === 'lg' ? 'text-3xl' : 'text-2xl'}`}
      style={{ WebkitTextStroke: '0.5px #263544' }}
    >
      Cos<span className="text-[#263544]" style={{ WebkitTextStroke: '0' }}>Mate</span>
    </span>
  )
}
