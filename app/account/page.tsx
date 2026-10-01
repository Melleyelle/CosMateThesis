'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { BankIcon, IdentificationCardIcon, MapPinIcon, NotePencilIcon, ReceiptIcon } from '@phosphor-icons/react'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import {
  BANKS,
  EMPTY_ADDRESS,
  EMPTY_BANK,
  addressProblem,
  bankProblem,
  deleteMyBankAccount,
  fetchMyAccount,
  maskAccount,
  onlyDigits,
  saveDefaultAddress,
  saveMyBankAccount,
  saveMyProfile,
  type Address,
  type BankAccount,
  type Profile,
} from '@/utils/customer/account'

const inputClass =
  'w-full rounded-lg bg-[#EFEFEF] px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#E5457F]/30'

type Section = 'profile' | 'address' | 'bank'

export default function AccountPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [address, setAddress] = useState<Address | null>(null)
  const [bank, setBank] = useState<BankAccount | null>(null)

  const [editing, setEditing] = useState<Section | null>(null)
  const [draftProfile, setDraftProfile] = useState({ firstName: '', lastName: '', phone: '' })
  const [draftAddress, setDraftAddress] = useState<Address>(EMPTY_ADDRESS)
  const [draftBank, setDraftBank] = useState<BankAccount>(EMPTY_BANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Section | null>(null)

  async function load() {
    const res = await fetchMyAccount()
    if (res.error) setLoadError(res.error)
    setProfile(res.profile)
    setAddress(res.address)
    setBank(res.bank)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(section: Section) {
    setError(null)
    setSaved(null)
    setEditing(section)
    if (section === 'profile' && profile) {
      setDraftProfile({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone })
    }
    if (section === 'address') {
      const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')
      setDraftAddress(address ?? { ...EMPTY_ADDRESS, name: fullName, phone: onlyDigits(profile?.phone ?? '') })
    }
    if (section === 'bank') {
      const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')
      setDraftBank(bank ?? { ...EMPTY_BANK, accountName: fullName })
    }
  }

  async function save() {
    setError(null)
    let problem: string | null = null
    if (editing === 'address') problem = addressProblem(draftAddress)
    if (editing === 'bank') problem = bankProblem(draftBank)
    if (editing === 'profile' && draftProfile.phone && !/^0\d{8,9}$/.test(onlyDigits(draftProfile.phone))) {
      problem = 'เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0'
    }
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    const err =
      editing === 'profile'
        ? await saveMyProfile(draftProfile)
        : editing === 'address'
          ? await saveDefaultAddress(draftAddress)
          : await saveMyBankAccount(draftBank)
    setSaving(false)

    if (err) {
      setError(err.includes('user_bank_accounts') ? 'ระบบยังไม่พร้อมบันทึกบัญชีธนาคาร (ยังไม่ได้รัน SQL Step 13)' : err)
      return
    }
    setSaved(editing)
    setEditing(null)
    await load()
  }

  async function removeBank() {
    if (!confirm('ลบบัญชีรับเงินคืนนี้? ออเดอร์เดิมยังโอนคืนเข้าบัญชีที่ใช้ตอนจองเหมือนเดิม')) return
    const err = await deleteMyBankAccount()
    if (err) setError(err)
    else await load()
  }

  const actions = (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-[#263544] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1a2632] disabled:opacity-50"
      >
        {saving ? 'กำลังบันทึก…' : 'บันทึก'}
      </button>
      <button type="button" onClick={() => setEditing(null)} className="text-sm font-medium text-[#263544]/60 hover:text-[#263544]">
        ยกเลิก
      </button>
      {error && (
        <p role="alert" className="w-full rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )

  return (
    <CustomerLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-[#263544]">บัญชีของฉัน</h1>
        <p className="mb-8 mt-1 text-sm text-[#263544]/60">ข้อมูลที่บันทึกไว้จะถูกเติมให้อัตโนมัติตอนจองชุด</p>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : loadError && !profile ? (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-6 text-center text-sm text-red-600">
            {loadError}
          </p>
        ) : (
          <div className="space-y-5">
            {/* ---------------- ข้อมูลติดต่อ ---------------- */}
            <Card
              icon={<IdentificationCardIcon size={24} weight="fill" />}
              title="ข้อมูลติดต่อ"
              onEdit={editing === null ? () => startEdit('profile') : undefined}
              saved={saved === 'profile'}
            >
              {editing === 'profile' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="ชื่อ">
                      <input
                        value={draftProfile.firstName}
                        onChange={(e) => setDraftProfile({ ...draftProfile, firstName: e.target.value })}
                        autoComplete="given-name"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="นามสกุล">
                      <input
                        value={draftProfile.lastName}
                        onChange={(e) => setDraftProfile({ ...draftProfile, lastName: e.target.value })}
                        autoComplete="family-name"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="เบอร์โทรศัพท์">
                      <input
                        inputMode="numeric"
                        maxLength={10}
                        value={draftProfile.phone}
                        onChange={(e) => setDraftProfile({ ...draftProfile, phone: onlyDigits(e.target.value) })}
                        autoComplete="tel"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  {actions}
                </>
              ) : (
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[120px_1fr]">
                  <dt className="text-[#263544]/60">ชื่อ</dt>
                  <dd className="font-medium text-[#263544]">
                    {[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || <Muted>ยังไม่ได้ระบุ</Muted>}
                  </dd>
                  <dt className="text-[#263544]/60">เบอร์โทร</dt>
                  <dd className="font-medium text-[#263544]">{profile?.phone || <Muted>ยังไม่ได้ระบุ</Muted>}</dd>
                  <dt className="text-[#263544]/60">อีเมล</dt>
                  <dd className="font-medium text-[#263544]">{profile?.email}</dd>
                </dl>
              )}
            </Card>

            {/* ---------------- ที่อยู่จัดส่งหลัก ---------------- */}
            <Card
              icon={<MapPinIcon size={24} weight="fill" />}
              title="ที่อยู่จัดส่งหลัก"
              onEdit={editing === null ? () => startEdit('address') : undefined}
              editLabel={address ? 'แก้ไข' : 'เพิ่มที่อยู่'}
              saved={saved === 'address'}
            >
              {editing === 'address' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="ชื่อผู้รับ">
                      <input value={draftAddress.name} onChange={(e) => setDraftAddress({ ...draftAddress, name: e.target.value })} className={inputClass} />
                    </Field>
                    <Field label="เบอร์โทรผู้รับ">
                      <input
                        inputMode="numeric"
                        maxLength={10}
                        value={draftAddress.phone}
                        onChange={(e) => setDraftAddress({ ...draftAddress, phone: onlyDigits(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="บ้านเลขที่ ซอย ถนน" wide>
                      <input value={draftAddress.line} onChange={(e) => setDraftAddress({ ...draftAddress, line: e.target.value })} className={inputClass} />
                    </Field>
                    <Field label="ตำบล/แขวง">
                      <input value={draftAddress.subdistrict} onChange={(e) => setDraftAddress({ ...draftAddress, subdistrict: e.target.value })} className={inputClass} />
                    </Field>
                    <Field label="อำเภอ/เขต">
                      <input value={draftAddress.district} onChange={(e) => setDraftAddress({ ...draftAddress, district: e.target.value })} className={inputClass} />
                    </Field>
                    <Field label="จังหวัด">
                      <input value={draftAddress.province} onChange={(e) => setDraftAddress({ ...draftAddress, province: e.target.value })} className={inputClass} />
                    </Field>
                    <Field label="รหัสไปรษณีย์">
                      <input
                        inputMode="numeric"
                        maxLength={5}
                        value={draftAddress.postalCode}
                        onChange={(e) => setDraftAddress({ ...draftAddress, postalCode: onlyDigits(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  {actions}
                </>
              ) : address ? (
                <div className="text-sm">
                  <p className="font-semibold text-[#263544]">
                    {address.name} ({address.phone})
                  </p>
                  <p className="mt-1 text-[#263544]/70">
                    {[address.line, address.subdistrict, address.district, address.province, address.postalCode].filter(Boolean).join(' ')}
                  </p>
                </div>
              ) : (
                <Muted>ยังไม่มีที่อยู่หลัก เพิ่มไว้แล้วตอนจองไม่ต้องกรอกใหม่</Muted>
              )}
            </Card>

            {/* ---------------- บัญชีรับเงินคืน ---------------- */}
            <Card
              icon={<BankIcon size={24} weight="fill" />}
              title="บัญชีรับเงินคืน"
              subtitle="ใช้รับเงินมัดจำคืน และเงินคืนกรณีร้านยกเลิกออเดอร์"
              onEdit={editing === null ? () => startEdit('bank') : undefined}
              editLabel={bank ? 'แก้ไข' : 'เพิ่มบัญชี'}
              saved={saved === 'bank'}
            >
              {editing === 'bank' ? (
                <>
                  <div className="space-y-3">
                    <BankRow label="ชื่อเจ้าของบัญชี">
                      <input
                        value={draftBank.accountName}
                        onChange={(e) => setDraftBank({ ...draftBank, accountName: e.target.value })}
                        className={inputClass}
                      />
                    </BankRow>
                    <BankRow label="ธนาคาร">
                      <select value={draftBank.bank} onChange={(e) => setDraftBank({ ...draftBank, bank: e.target.value })} className={inputClass}>
                        <option value="">เลือกธนาคาร</option>
                        {BANKS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </BankRow>
                    <BankRow label="เลขที่บัญชี">
                      <input
                        inputMode="numeric"
                        maxLength={18}
                        value={draftBank.accountNumber}
                        onChange={(e) => setDraftBank({ ...draftBank, accountNumber: e.target.value.replace(/[^0-9-]/g, '') })}
                        placeholder="xxx-x-xxxxx-x"
                        className={`${inputClass} tabular-nums`}
                      />
                    </BankRow>
                  </div>
                  <p className="mt-3 text-xs text-[#263544]/60">
                    เปลี่ยนบัญชีที่นี่มีผลกับการจองครั้งถัดไป ออเดอร์ที่จองไปแล้วยังโอนคืนเข้าบัญชีที่ใช้ตอนจอง
                  </p>
                  {actions}
                </>
              ) : bank ? (
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[120px_1fr]">
                    <dt className="text-[#263544]/60">ชื่อบัญชี</dt>
                    <dd className="font-medium text-[#263544]">{bank.accountName}</dd>
                    <dt className="text-[#263544]/60">ธนาคาร</dt>
                    <dd className="font-medium text-[#263544]">{bank.bank}</dd>
                    <dt className="text-[#263544]/60">เลขที่บัญชี</dt>
                    <dd className="font-medium tabular-nums text-[#263544]">{maskAccount(bank.accountNumber)}</dd>
                  </dl>
                  <button type="button" onClick={removeBank} className="text-xs font-medium text-red-600 hover:underline">
                    ลบบัญชีนี้
                  </button>
                </div>
              ) : (
                <Muted>ยังไม่มีบัญชีรับเงินคืน เพิ่มไว้แล้วตอนจองไม่ต้องกรอกใหม่</Muted>
              )}
            </Card>

            <Link
              href="/orders"
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm font-medium text-[#263544] transition hover:border-[#263544]"
            >
              <ReceiptIcon size={22} className="text-[#E5457F]" />
              ดูออเดอร์ของฉัน
            </Link>
          </div>
        )}
      </div>
    </CustomerLayout>
  )
}

function Card({
  icon,
  title,
  subtitle,
  onEdit,
  editLabel = 'แก้ไข',
  saved,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  onEdit?: () => void
  editLabel?: string
  saved?: boolean
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[#263544] bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-[#263544]">{icon}</span>
          <div>
            <h2 className="text-lg font-medium text-[#263544]">{title}</h2>
            {subtitle && <p className="text-xs text-[#263544]/60">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs font-medium text-[#1B6E45]">บันทึกแล้ว</span>}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[#263544] transition hover:bg-[#FDE3EE] hover:text-[#E5457F]"
            >
              <NotePencilIcon size={20} />
              {editLabel}
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-[#263544]/70">{label}</span>
      {children}
    </label>
  )
}

function BankRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid items-center gap-1 sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="text-sm text-[#263544]">{label}</span>
      <span className="sm:max-w-sm">{children}</span>
    </label>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-sm text-[#263544]/50">{children}</span>
}
