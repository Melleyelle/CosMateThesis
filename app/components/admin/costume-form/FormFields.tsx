// ช่องกรอกและ select ที่ใช้ร่วมกันทุกสเตป หน้าตาเดียวกับ AuthField แต่แยกไฟล์
// เพราะฟอร์มนี้อยู่คนละโฟลเดอร์ (admin) และมีปุ่ม/label หลายแบบกว่าฟอร์ม auth

import DateInput from '../../DateInput'

// error: ข้อความใต้ช่อง + กรอบแดง + aria-invalid · hint: คำอธิบายใต้ช่อง (ซ่อนเมื่อมี error) — ไม่ส่ง = หน้าตาเดิม
type Feedback = { error?: string | null; hint?: React.ReactNode }

const controlClass = (invalid: boolean) =>
  `w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 ${
    invalid
      ? 'border-[#D92D20] focus:border-[#D92D20] focus:ring-[#D92D20]/15'
      : 'border-gray-300 focus:border-[#E5457F] focus:ring-[#E5457F]/15'
  }`

function FieldFeedback({ id, error, hint }: Feedback & { id?: string }) {
  if (error) return <p id={`${id}-feedback`} className="text-xs text-[#B42318]">{error}</p>
  if (hint) return <p id={`${id}-feedback`} className="text-xs text-[#6B7280]">{hint}</p>
  return null
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & Feedback & {
  label: string
}

export function FormField({ label, id, error, hint, ...inputProps }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-feedback` : undefined}
        {...inputProps}
        className={controlClass(!!error)}
      />
      <FieldFeedback id={id} error={error} hint={hint} />
    </div>
  )
}

// ช่องวันที่แบบ วัน/เดือน/ปี — value/onChange เป็น 'YYYY-MM-DD'
type DateFieldProps = Feedback & {
  label: string
  id: string
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
}

export function FormDateField({ label, id, error, hint, ...dateProps }: DateFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <DateInput
        id={id}
        invalid={!!error}
        aria-describedby={error || hint ? `${id}-feedback` : undefined}
        {...dateProps}
        className={controlClass(!!error)}
      />
      <FieldFeedback id={id} error={error} hint={hint} />
    </div>
  )
}

type TextAreaProps =React.TextareaHTMLAttributes<HTMLTextAreaElement> & Feedback & {
  label: string
}

export function FormTextArea({ label, id, error, hint, ...textAreaProps }: TextAreaProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-feedback` : undefined}
        {...textAreaProps}
        className={controlClass(!!error)}
      />
      <FieldFeedback id={id} error={error} hint={hint} />
    </div>
  )
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: React.ReactNode
}

export function FormSelect({ label, id, children, ...selectProps }: SelectProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        {...selectProps}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
      >
        {children}
      </select>
    </div>
  )
}

export function FormCheckbox({
  label,
  id,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 text-sm text-gray-700">
      <input
        id={id}
        type="checkbox"
        {...inputProps}
        className="h-4 w-4 rounded border-gray-300 text-[#E5457F] focus:ring-[#E5457F]/30"
      />
      {label}
    </label>
  )
}