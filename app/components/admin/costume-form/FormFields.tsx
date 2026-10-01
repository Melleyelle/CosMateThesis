// ช่องกรอกและ select ที่ใช้ร่วมกันทุกสเตป หน้าตาเดียวกับ AuthField แต่แยกไฟล์
// เพราะฟอร์มนี้อยู่คนละโฟลเดอร์ (admin) และมีปุ่ม/label หลายแบบกว่าฟอร์ม auth

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function FormField({ label, id, ...inputProps }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        {...inputProps}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
      />
    </div>
  )
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
}

export function FormTextArea({ label, id, ...textAreaProps }: TextAreaProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        {...textAreaProps}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/15"
      />
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