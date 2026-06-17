import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, CheckCircle, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import { Invoice } from '@/types'
import { formatDate, formatCurrency, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, cn } from '@/lib/utils'

interface InvoiceDetail {
  invoice: Invoice & { first_name: string; last_name: string; email: string; address: string; city: string; postcode: string }
  lineItems: Array<{ id: number; description: string; quantity: number; unit_price: number; total: number }>
  settings: { business_name: string; address: string; phone: string; email: string; vat_number: string }
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<InvoiceDetail | null>(null)
  const [markPaidOpen, setMarkPaidOpen] = useState(false)
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0])
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = () => api.getInvoice(Number(id)).then(d => setData(d as InvoiceDetail))
  useEffect(() => { load() }, [id])

  const handleMarkPaid = async () => {
    await api.updateInvoice(Number(id), { status: 'paid', paid_date: paidDate })
    setMarkPaidOpen(false)
    await load()
  }

  const handleDelete = async () => {
    await api.deleteInvoice(Number(id))
    navigate('/invoices')
  }

  const handlePrint = () => window.print()

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const { invoice, lineItems, settings } = data

  return (
    <div className="pt-2">
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <button onClick={() => navigate('/invoices')} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title font-mono">{invoice.invoice_number}</h1>
            <span className={cn('status-badge', INVOICE_STATUS_COLORS[invoice.status])}>{INVOICE_STATUS_LABELS[invoice.status]}</span>
          </div>
        </div>
        {invoice.status !== 'paid' && (
          <button onClick={() => setMarkPaidOpen(true)} className="btn-primary">
            <CheckCircle className="w-4 h-4" /> Mark Paid
          </button>
        )}
        <button onClick={handlePrint} className="btn-secondary"><Printer className="w-4 h-4" /> Print / PDF</button>
        <button onClick={() => setDeleteOpen(true)} className="btn-danger"><Trash2 className="w-4 h-4" /></button>
      </div>

      {/* Invoice document */}
      <div className="card max-w-3xl mx-auto print:shadow-none print:border-0">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white">{settings.business_name}</h2>
              <p className="text-sm text-zinc-400 mt-1 whitespace-pre-line">{settings.address}</p>
              {settings.phone && <p className="text-sm text-zinc-400">{settings.phone}</p>}
              {settings.email && <p className="text-sm text-zinc-400">{settings.email}</p>}
              {settings.vat_number && <p className="text-xs text-zinc-500 mt-1">VAT: {settings.vat_number}</p>}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#1F6FEB] font-mono">{invoice.invoice_number}</div>
              <div className="text-xs text-zinc-500 mt-2">Date: {formatDate(invoice.created_at)}</div>
              {invoice.due_date && <div className="text-xs text-zinc-500">Due: {formatDate(invoice.due_date)}</div>}
              {invoice.paid_date && <div className="text-xs text-green-400 font-medium mt-1">Paid: {formatDate(invoice.paid_date)}</div>}
            </div>
          </div>

          {/* Bill to */}
          <div className="mb-8">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Bill To</p>
            <p className="font-semibold text-zinc-200">{invoice.first_name} {invoice.last_name}</p>
            {invoice.address && <p className="text-sm text-zinc-400">{invoice.address}</p>}
            {(invoice.city || invoice.postcode) && <p className="text-sm text-zinc-400">{[invoice.city, invoice.postcode].filter(Boolean).join(', ')}</p>}
            {invoice.email && <p className="text-sm text-zinc-400">{invoice.email}</p>}
          </div>

          {/* Job reference */}
          {invoice.job_number && (
            <div className="mb-6 p-3 bg-zinc-800/50 rounded-lg">
              <p className="text-xs text-zinc-500">Re: Job <span className="font-mono text-zinc-300">{invoice.job_number}</span> — {invoice.job_title}</p>
            </div>
          )}

          {/* Line items */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-2.5 text-xs text-zinc-500 font-medium uppercase">Description</th>
                <th className="text-right py-2.5 text-xs text-zinc-500 font-medium uppercase">Qty</th>
                <th className="text-right py-2.5 text-xs text-zinc-500 font-medium uppercase">Unit</th>
                <th className="text-right py-2.5 text-xs text-zinc-500 font-medium uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map(item => (
                <tr key={item.id} className="border-b border-zinc-800/50">
                  <td className="py-3 text-zinc-200">{item.description}</td>
                  <td className="py-3 text-right text-zinc-400">{item.quantity}</td>
                  <td className="py-3 text-right text-zinc-400">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 text-right text-zinc-200 font-medium">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-700">
                <td colSpan={3} className="py-3 text-right text-zinc-400 text-xs">Subtotal</td>
                <td className="py-3 text-right text-zinc-200 font-medium">{formatCurrency(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 text-right text-zinc-400 text-xs">VAT ({invoice.vat_rate}%)</td>
                <td className="py-2 text-right text-zinc-400">{formatCurrency(invoice.vat_amount)}</td>
              </tr>
              <tr className="bg-zinc-800/40">
                <td colSpan={3} className="py-3.5 px-2 text-right font-bold text-zinc-200">Total Due</td>
                <td className="py-3.5 px-2 text-right font-bold text-xl text-white">{formatCurrency(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>

          {invoice.notes && (
            <div className="border-t border-zinc-800 pt-4">
              <p className="text-xs text-zinc-500 mb-1">Notes</p>
              <p className="text-sm text-zinc-400">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Mark paid modal */}
      <Modal open={markPaidOpen} onClose={() => setMarkPaidOpen(false)} title="Mark as Paid"
        footer={
          <>
            <button onClick={() => setMarkPaidOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleMarkPaid} className="btn-primary">Confirm Payment</button>
          </>
        }
      >
        <div>
          <label className="label">Payment Date</label>
          <input type="date" className="input" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Invoice"
        footer={
          <>
            <button onClick={() => setDeleteOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Invoice</button>
          </>
        }
      >
        <p className="text-zinc-300">Delete invoice <strong className="font-mono">{invoice.invoice_number}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  )
}
