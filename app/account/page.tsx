'use client'

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BankIcon,
  CaretRightIcon,
  CheckCircleIcon,
  HeartIcon,
  IdentificationCardIcon,
  MapPinIcon,
  PencilSimpleIcon,
  PlusIcon,
  ReceiptIcon,
  SignOutIcon,
  TrashIcon,
  type Icon,
} from '@phosphor-icons/react'
import { createClient } from '@/utils/client'
import CustomerLayout from '@/app/components/customer/CustomerLayout'
import {
  AVATAR_MAX_SIZE,
  BANKS,
  EMPTY_ADDRESS,
  EMPTY_BANK,
  addressProblem,
  bankProblem,
  deleteAddress,
  deleteBankAccount,
  fetchMyAccount,
  maskAccount,
  onlyDigits,
  removeMyAvatar,
  saveAddress,
  saveBankAccount,
  saveMyProfile,
  setDefaultAddress,
  setDefaultBankAccount,
  uploadMyAvatar,
  type Address,
  type BankAccount,
  type Profile,
  type SavedAddress,
  type SavedBankAccount,
} from '@/utils/customer/account'

const inputClass =
  'w-full rounded-xl border-2 border-[#EEEDF2] bg-white px-4 py-2.5 text-base text-[#263544] outline-none transition placeholder:text-[#263544]/40 focus:border-[#E5457F] focus:ring-2 focus:ring-[#E5457F]/20'

type Section = 'profile' | 'address' | 'bank'

const SECTIONS: { key: Section; label: string; title: string; subtitle: string; icon: Icon }[] = [
  {
    key: 'profile',
    label: 'ข้อมูลส่วนตัว',
    title: 'ข้อมูลของฉัน',
    subtitle: 'ข้อมูลที่บันทึกไว้จะถูกเติมให้อัตโนมัติตอนจองชุด',
    icon: IdentificationCardIcon,
  },
  {
    key: 'address',
    label: 'ที่อยู่จัดส่ง',
    title: 'ที่อยู่ของฉัน',
    subtitle: 'ที่อยู่ค่าเริ่มต้นจะถูกเติมให้อัตโนมัติตอนจองชุด',
    icon: MapPinIcon,
  },
  {
    key: 'bank',
    label: 'บัญชีรับเงินคืน',
    title: 'บัญชีธนาคารของฉัน',
    subtitle: 'ใช้รับเงินมัดจำคืน และเงินคืนกรณีร้านยกเลิกออเดอร์ บัญชีค่าเริ่มต้นจะถูกเติมให้ตอนจอง',
    icon: BankIcon,
  },
]

// id = null คือกำลังเพิ่มรายการใหม่
type Editing = { kind: 'address' | 'bank'; id: string | null } | null

export default function AccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [banks, setBanks] = useState<SavedBankAccount[]>([])

  const [section, setSection] = useState<Section>('profile')
  const [editing, setEditing] = useState<Editing>(null)
  const [draftProfile, setDraftProfile] = useState({ firstName: '', lastName: '', phone: '' })
  const [draftAddress, setDraftAddress] = useState<Address>(EMPTY_ADDRESS)
  const [draftBank, setDraftBank] = useState<BankAccount>(EMPTY_BANK)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function load() {
    const res = await fetchMyAccount()
    if (res.error) setLoadError(res.error)
    setProfile(res.profile)
    setAddresses(res.addresses)
    setBanks(res.banks)
    setDraftProfile({
      firstName: res.profile?.firstName ?? '',
      lastName: res.profile?.lastName ?? '',
      phone: res.profile?.phone ?? '',
    })
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function clearMessages() {
    setError(null)
    setNotice(null)
  }

  function selectSection(next: Section) {
    setSection(next)
    setEditing(null)
    clearMessages()
    setDraftProfile({ firstName: profile?.firstName ?? '', lastName: profile?.lastName ?? '', phone: profile?.phone ?? '' })
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')

  function openAddress(item: SavedAddress | null) {
    clearMessages()
    setDraftAddress(item ?? { ...EMPTY_ADDRESS, name: fullName, phone: onlyDigits(profile?.phone ?? '') })
    setEditing({ kind: 'address', id: item?.id ?? null })
  }

  function openBank(item: SavedBankAccount | null) {
    clearMessages()
    setDraftBank(item ?? { ...EMPTY_BANK, accountName: fullName })
    setEditing({ kind: 'bank', id: item?.id ?? null })
  }

  async function saveProfileForm() {
    clearMessages()
    if (draftProfile.phone && !/^0\d{8,9}$/.test(onlyDigits(draftProfile.phone))) {
      setError('เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0')
      return
    }
    setSaving(true)
    const err = await saveMyProfile(draftProfile)
    setSaving(false)
    if (err) return setError(err)
    setNotice('บันทึกเรียบร้อย')
    await load()
  }

  async function saveEditing() {
    if (!editing) return
    clearMessages()
    const problem = editing.kind === 'address' ? addressProblem(draftAddress) : bankProblem(draftBank)
    if (problem) return setError(problem)

    setSaving(true)
    const err =
      editing.kind === 'address' ? await saveAddress(draftAddress, editing.id) : await saveBankAccount(draftBank, editing.id)
    setSaving(false)
    if (err) return setError(err)

    setEditing(null)
    setNotice(editing.id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มเรียบร้อย')
    await load()
  }

  // ทำงานกับรายการ (ลบ / ตั้งค่าเริ่มต้น) แล้วโหลดใหม่
  async function runItemAction(id: string, action: () => Promise<string | null>, done: string) {
    clearMessages()
    setBusyId(id)
    const err = await action()
    setBusyId(null)
    if (err) return setError(err)
    setNotice(done)
    await load()
  }

  function removeAddress(item: SavedAddress) {
    if (!confirm('ลบที่อยู่นี้?')) return
    runItemAction(item.id, () => deleteAddress(item.id), 'ลบที่อยู่แล้ว')
  }

  function removeBank(item: SavedBankAccount) {
    if (!confirm('ลบบัญชีนี้? ออเดอร์เดิมยังโอนคืนเข้าบัญชีที่ใช้ตอนจองเหมือนเดิม')) return
    runItemAction(item.id, () => deleteBankAccount(item.id), 'ลบบัญชีแล้ว')
  }

  async function changeAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // ให้เลือกไฟล์เดิมซ้ำได้
    if (!file) return
    setAvatarError(null)
    setAvatarBusy(true)
    const res = await uploadMyAvatar(file)
    setAvatarBusy(false)
    if ('error' in res) setAvatarError(res.error)
    else setProfile((p) => (p ? { ...p, avatarUrl: res.url } : p))
  }

  async function deleteAvatar() {
    if (!confirm('ลบรูปโปรไฟล์นี้?')) return
    setAvatarError(null)
    setAvatarBusy(true)
    const err = await removeMyAvatar()
    setAvatarBusy(false)
    if (err) setAvatarError(err)
    else setProfile((p) => (p ? { ...p, avatarUrl: null } : p))
  }

  async function logout() {
    await createClient()?.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  const current = SECTIONS.find((s) => s.key === section)!
  const headerTitle = editing
    ? `${editing.id ? 'แก้ไข' : 'เพิ่ม'}${editing.kind === 'address' ? 'ที่อยู่' : 'บัญชีธนาคาร'}`
    : current.title

  const messages = (
    <>
      {notice && (
        <p className="inline-flex items-center gap-1.5 text-base font-medium text-[#1B6E45]">
          <CheckCircleIcon size={18} weight="fill" />
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="w-full rounded-xl bg-red-50 px-4 py-2.5 text-base text-red-600">
          {error}
        </p>
      )}
    </>
  )

  const formActions = (onSave: () => void, onCancel?: () => void) => (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="pop rounded-full bg-[#E5457F] px-10 py-2.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'กำลังบันทึก…' : 'บันทึก'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-base font-medium text-[#263544]/60 hover:text-[#263544]">
          ยกเลิก
        </button>
      )}
      {messages}
    </div>
  )

  const cancelEditing = () => {
    setEditing(null)
    clearMessages()
  }

  return (
    <CustomerLayout>
      <h1 className="text-3xl font-bold text-[#263544]">บัญชีของฉัน</h1>
      <p className="mb-8 mt-1 text-base text-[#263544]/60">จัดการข้อมูลส่วนตัว ที่อยู่ และบัญชีรับเงินคืนของคุณ</p>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="h-80 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      ) : loadError && !profile ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-6 text-center text-base text-red-600">
          {loadError}
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
          {/* ---------------- เมนูซ้าย ---------------- */}
          <aside className="overflow-hidden rounded-2xl border-2 border-[#263544] bg-white shadow-[4px_4px_0_0_#263544] lg:sticky lg:top-24">
            <div className="flex items-center gap-3 bg-[#FBDCE7] px-5 py-5">
              <Avatar profile={profile} className="h-14 w-14 text-xl" />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-[#263544]">{fullName || 'สมาชิก CosMate'}</p>
                <p className="truncate text-base text-[#263544]/60">{profile?.email}</p>
              </div>
            </div>

            <nav className="p-3" aria-label="เมนูบัญชี">
              <ul className="space-y-1">
                {SECTIONS.map(({ key, label, icon: ItemIcon }) => {
                  const active = section === key
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => selectSection(key)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium ${
                          active ? 'bg-[#FDE3EE] text-[#E5457F]' : 'nudge-x text-[#263544]'
                        }`}
                      >
                        <ItemIcon size={22} weight={active ? 'fill' : 'regular'} />
                        {label}
                        {active && <CaretRightIcon size={16} weight="bold" className="ml-auto" />}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <ul className="mt-2 space-y-1 border-t border-[#263544]/10 pt-2">
                <li>
                  <MenuLink href="/orders" icon={<ReceiptIcon size={22} />} label="ออเดอร์ของฉัน" />
                </li>
                <li>
                  <MenuLink href="/favorites" icon={<HeartIcon size={22} />} label="รายการโปรด" />
                </li>
                <li>
                  <button
                    type="button"
                    onClick={logout}
                    className="nudge-x flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium text-red-600"
                  >
                    <SignOutIcon size={22} />
                    ออกจากระบบ
                  </button>
                </li>
              </ul>
            </nav>
          </aside>

          {/* ---------------- เนื้อหาขวา ---------------- */}
          <section className="rounded-2xl border-2 border-[#263544] bg-white p-6 shadow-[4px_4px_0_0_#263544] sm:p-8">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#263544]/10 pb-5">
              <div>
                <h2 className="text-2xl font-bold text-[#263544]">{headerTitle}</h2>
                {!editing && <p className="mt-1 text-base text-[#263544]/60">{current.subtitle}</p>}
              </div>
              {!editing && section !== 'profile' && (
                <button
                  type="button"
                  onClick={() => (section === 'address' ? openAddress(null) : openBank(null))}
                  className="pop inline-flex items-center gap-2 rounded-full bg-[#E5457F] px-5 py-2.5 text-base font-semibold text-white"
                >
                  <PlusIcon size={18} weight="bold" />
                  {section === 'address' ? 'เพิ่มที่อยู่ใหม่' : 'เพิ่มบัญชีธนาคาร'}
                </button>
              )}
            </header>

            {/* ---------- ข้อมูลส่วนตัว ---------- */}
            {section === 'profile' && (
              <div className="flex flex-col-reverse gap-8 md:flex-row">
                <div className="flex-1 space-y-5">
                  <Row label="อีเมล">
                    <p className="text-base text-[#263544]">{profile?.email}</p>
                  </Row>
                  <Row label="ชื่อ">
                    <input
                      value={draftProfile.firstName}
                      onChange={(e) => setDraftProfile({ ...draftProfile, firstName: e.target.value })}
                      autoComplete="given-name"
                      placeholder="กรอกชื่อจริง"
                      className={inputClass}
                    />
                  </Row>
                  <Row label="นามสกุล">
                    <input
                      value={draftProfile.lastName}
                      onChange={(e) => setDraftProfile({ ...draftProfile, lastName: e.target.value })}
                      autoComplete="family-name"
                      placeholder="กรอกนามสกุล"
                      className={inputClass}
                    />
                  </Row>
                  <Row label="เบอร์โทรศัพท์">
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      value={draftProfile.phone}
                      onChange={(e) => setDraftProfile({ ...draftProfile, phone: onlyDigits(e.target.value) })}
                      autoComplete="tel"
                      placeholder="0xxxxxxxxx"
                      className={inputClass}
                    />
                  </Row>
                  <div className="pt-2">{formActions(saveProfileForm)}</div>
                </div>

                {/* รูปโปรไฟล์ */}
                <div className="flex flex-col items-center border-[#263544]/10 text-center md:w-60 md:border-l md:pl-8">
                  <Avatar profile={profile} className="h-32 w-32 text-5xl" />
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={changeAvatar}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={avatarBusy}
                    className="pop mt-5 rounded-full bg-white px-6 py-2 text-base font-semibold text-[#263544] disabled:opacity-50"
                  >
                    {avatarBusy ? 'กำลังอัปโหลด…' : 'เลือกรูป'}
                  </button>
                  {profile?.avatarUrl && !avatarBusy && (
                    <button type="button" onClick={deleteAvatar} className="mt-2 text-base font-medium text-red-600 hover:underline">
                      ลบรูป
                    </button>
                  )}
                  <p className="mt-3 text-base leading-relaxed text-[#263544]/50">
                    ขนาดไฟล์สูงสุด {AVATAR_MAX_SIZE / 1024 / 1024} MB
                    <br />
                    รองรับ .JPG, .PNG, .WEBP
                  </p>
                  {avatarError && (
                    <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-base text-red-600">
                      {avatarError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ---------- ที่อยู่ ---------- */}
            {section === 'address' &&
              (editing?.kind === 'address' ? (
                <div className="space-y-5">
                  <Row label="ชื่อผู้รับ">
                    <input value={draftAddress.name} onChange={(e) => setDraftAddress({ ...draftAddress, name: e.target.value })} className={inputClass} />
                  </Row>
                  <Row label="เบอร์โทรผู้รับ">
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      value={draftAddress.phone}
                      onChange={(e) => setDraftAddress({ ...draftAddress, phone: onlyDigits(e.target.value) })}
                      className={inputClass}
                    />
                  </Row>
                  <Row label="บ้านเลขที่ ซอย ถนน">
                    <input value={draftAddress.line} onChange={(e) => setDraftAddress({ ...draftAddress, line: e.target.value })} className={inputClass} />
                  </Row>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Row label="ตำบล/แขวง">
                      <input
                        value={draftAddress.subdistrict}
                        onChange={(e) => setDraftAddress({ ...draftAddress, subdistrict: e.target.value })}
                        className={inputClass}
                      />
                    </Row>
                    <Row label="อำเภอ/เขต">
                      <input
                        value={draftAddress.district}
                        onChange={(e) => setDraftAddress({ ...draftAddress, district: e.target.value })}
                        className={inputClass}
                      />
                    </Row>
                    <Row label="จังหวัด">
                      <input
                        value={draftAddress.province}
                        onChange={(e) => setDraftAddress({ ...draftAddress, province: e.target.value })}
                        className={inputClass}
                      />
                    </Row>
                    <Row label="รหัสไปรษณีย์">
                      <input
                        inputMode="numeric"
                        maxLength={5}
                        value={draftAddress.postalCode}
                        onChange={(e) => setDraftAddress({ ...draftAddress, postalCode: onlyDigits(e.target.value) })}
                        className={inputClass}
                      />
                    </Row>
                  </div>
                  <div className="pt-2">{formActions(saveEditing, cancelEditing)}</div>
                </div>
              ) : (
                <>
                  {messages}
                  {addresses.length === 0 ? (
                    <EmptyList text="ยังไม่มีที่อยู่ เพิ่มไว้แล้วตอนจองไม่ต้องกรอกใหม่" />
                  ) : (
                    <ul className="divide-y divide-[#263544]/10">
                      {addresses.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 py-5 first:pt-2">
                          <div className="min-w-0 text-base">
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="font-semibold text-[#263544]">{a.name}</span>
                              <span className="border-l border-[#263544]/20 pl-3 text-[#263544]/60">{a.phone}</span>
                            </p>
                            <p className="mt-1 text-[#263544]/70">{a.line}</p>
                            <p className="text-[#263544]/70">
                              {[a.subdistrict, a.district, a.province, a.postalCode].filter(Boolean).join(', ')}
                            </p>
                            {a.isDefault && <DefaultBadge />}
                          </div>
                          <ItemActions
                            busy={busyId === a.id}
                            isDefault={a.isDefault}
                            canDelete={!a.isDefault || addresses.length === 1}
                            onEdit={() => openAddress(a)}
                            onDelete={() => removeAddress(a)}
                            onSetDefault={() => runItemAction(a.id, () => setDefaultAddress(a.id), 'ตั้งเป็นค่าเริ่มต้นแล้ว')}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ))}

            {/* ---------- บัญชีธนาคาร ---------- */}
            {section === 'bank' &&
              (editing?.kind === 'bank' ? (
                <div className="space-y-5">
                  <Row label="ชื่อเจ้าของบัญชี">
                    <input
                      value={draftBank.accountName}
                      onChange={(e) => setDraftBank({ ...draftBank, accountName: e.target.value })}
                      className={inputClass}
                    />
                  </Row>
                  <Row label="ธนาคาร">
                    <select value={draftBank.bank} onChange={(e) => setDraftBank({ ...draftBank, bank: e.target.value })} className={inputClass}>
                      <option value="">เลือกธนาคาร</option>
                      {BANKS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </Row>
                  <Row label="เลขที่บัญชี">
                    <input
                      inputMode="numeric"
                      maxLength={18}
                      value={draftBank.accountNumber}
                      onChange={(e) => setDraftBank({ ...draftBank, accountNumber: e.target.value.replace(/[^0-9-]/g, '') })}
                      placeholder="xxx-x-xxxxx-x"
                      className={`${inputClass} tabular-nums`}
                    />
                  </Row>
                  <p className="text-base text-[#263544]/60">
                    การเปลี่ยนแปลงมีผลกับการจองครั้งถัดไป ออเดอร์ที่จองไปแล้วยังโอนคืนเข้าบัญชีที่ใช้ตอนจอง
                  </p>
                  <div className="pt-2">{formActions(saveEditing, cancelEditing)}</div>
                </div>
              ) : (
                <>
                  {messages}
                  {banks.length === 0 ? (
                    <EmptyList text="ยังไม่มีบัญชีรับเงินคืน เพิ่มไว้แล้วตอนจองไม่ต้องกรอกใหม่" />
                  ) : (
                    <ul className="divide-y divide-[#263544]/10">
                      {banks.map((b) => (
                        <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 py-5 first:pt-2">
                          <div className="flex min-w-0 items-center gap-4">
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-[#263544] bg-[#FFFAFC] text-[#E5457F]">
                              <BankIcon size={28} weight="fill" />
                            </span>
                            <div className="min-w-0 text-base">
                              <p className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-[#263544]">{b.bank}</span>
                                {b.isDefault && <DefaultBadge inline />}
                              </p>
                              <p className="mt-0.5 text-[#263544]/70">ชื่อบัญชี: {b.accountName}</p>
                              <p className="mt-0.5 font-medium tabular-nums text-[#263544]">{maskAccount(b.accountNumber)}</p>
                            </div>
                          </div>
                          <ItemActions
                            busy={busyId === b.id}
                            isDefault={b.isDefault}
                            canDelete={!b.isDefault || banks.length === 1}
                            onEdit={() => openBank(b)}
                            onDelete={() => removeBank(b)}
                            onSetDefault={() => runItemAction(b.id, () => setDefaultBankAccount(b.id), 'ตั้งเป็นค่าเริ่มต้นแล้ว')}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ))}
          </section>
        </div>
      )}
    </CustomerLayout>
  )
}

// ปุ่มด้านขวาของแต่ละรายการ: ดินสอ (แก้ไข) · ถังขยะ (ลบ) · ตั้งเป็นค่าเริ่มต้น
// ค่าเริ่มต้นลบไม่ได้ถ้ายังมีรายการอื่น (ให้ตั้งอันอื่นเป็นค่าเริ่มต้นก่อน) เหมือน Shopee
function ItemActions({
  busy,
  isDefault,
  canDelete,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  busy: boolean
  isDefault: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}) {
  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          aria-label="แก้ไข"
          title="แก้ไข"
          className="nudge flex h-9 w-9 items-center justify-center rounded-full text-[#263544] disabled:opacity-40"
        >
          <PencilSimpleIcon size={20} />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label="ลบ"
            title="ลบ"
            className="nudge flex h-9 w-9 items-center justify-center rounded-full text-red-600 disabled:opacity-40"
          >
            <TrashIcon size={20} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onSetDefault}
        disabled={busy || isDefault}
        className="pop rounded-full bg-white px-4 py-1.5 text-base font-semibold text-[#263544] disabled:opacity-40"
      >
        {busy ? 'กำลังบันทึก…' : 'ตั้งเป็นค่าเริ่มต้น'}
      </button>
    </div>
  )
}

function DefaultBadge({ inline = false }: { inline?: boolean }) {
  return (
    <span
      className={`inline-block rounded-full border border-[#E5457F] bg-[#FDE3EE] px-2.5 py-0.5 text-sm font-semibold text-[#E5457F] ${inline ? '' : 'mt-2'}`}
    >
      ค่าเริ่มต้น
    </span>
  )
}

function EmptyList({ text }: { text: string }) {
  return <p className="rounded-xl bg-[#FFFAFC] px-4 py-6 text-center text-base text-[#263544]/70">{text}</p>
}

// ช่องฟอร์ม: ชื่อช่องอยู่บน ช่องกรอกอยู่ล่าง
// ใช้ <label> ครอบเมื่อมีชื่อ เพื่อผูกชื่อกับช่องกรอกโดยไม่ต้องใส่ id
function Row({ label, children }: { label?: string; children: ReactNode }) {
  if (!label) return <div>{children}</div>
  return (
    <label className="block space-y-2">
      <span className="block text-base font-medium text-[#263544]">{label}</span>
      {children}
    </label>
  )
}

function Avatar({ profile, className }: { profile: Profile | null; className: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#263544] bg-white font-bold uppercase text-[#E5457F] ${className}`}
    >
      {profile?.avatarUrl ? (
        <img src={profile.avatarUrl} alt="รูปโปรไฟล์" className="h-full w-full object-cover" />
      ) : (
        // ใช้ตัวแรกของอีเมลให้ตรงกับปุ่มบัญชีใน navbar
        (profile?.email || '?').charAt(0)
      )}
    </span>
  )
}

function MenuLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="nudge-x flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-[#263544]"
    >
      {icon}
      {label}
    </Link>
  )
}
