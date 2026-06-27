import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'

const EMPTY = { first_name: '', last_name: '', phone: '', mobile: '', email: '', address: '', postcode: '' }

/**
 * A small "+ New" button that sits next to a customer dropdown. Opens a quick
 * create-customer form; on save it creates the customer and hands the new record
 * back via onCreated so the parent can add it to its list and auto-select it.
 * Saves a trip to the Customers page mid-booking/quote.
 */
export default function NewCustomerButton({ onCreated, className }: { onCreated: (c: any) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  const F = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const save = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) return
    setSaving(true)
    try {
      const c = await api.createCustomer({
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      })
      setForm({ ...EMPTY })
      setOpen(false)
      onCreated(c)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'btn-ghost text-xs py-1 px-2 text-[#F4A523] inline-flex items-center gap-1'}
        title="Create a new customer"
      >
        <UserPlus className="w-3.5 h-3.5" /> New
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Customer"
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || (!form.first_name.trim() && !form.last_name.trim())} className="btn-primary">
            {saving ? 'Saving…' : 'Create & select'}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">First name *</label><input className="input" value={form.first_name} onChange={F('first_name')} autoFocus /></div>
            <div><label className="label">Last name</label><input className="input" value={form.last_name} onChange={F('last_name')} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={F('phone')} /></div>
            <div><label className="label">Mobile</label><input className="input" value={form.mobile} onChange={F('mobile')} /></div>
          </div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={F('email')} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Address</label><input className="input" value={form.address} onChange={F('address')} /></div>
            <div><label className="label">Postcode</label><input className="input" value={form.postcode} onChange={F('postcode')} /></div>
          </div>
        </div>
      </Modal>
    </>
  )
}
