export interface Customer {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  mobile: string
  address: string
  city: string
  postcode: string
  notes: string
  vehicle_count?: number
  job_count?: number
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: number
  customer_id: number
  registration: string
  make: string
  model: string
  year: number
  colour: string
  vin: string
  engine_size: string
  fuel_type: string
  mileage: number
  mot_due: string
  service_due: string
  notes: string
  // joined
  first_name?: string
  last_name?: string
  created_at: string
  updated_at: string
}

export type JobStatus = 'booked' | 'in_progress' | 'awaiting_parts' | 'complete' | 'invoiced'

export interface Job {
  id: number
  job_number: string
  customer_id: number
  vehicle_id: number
  status: JobStatus
  title: string
  description: string
  technician_notes: string
  assigned_to: string
  estimated_hours: number
  labour_rate: number
  booked_date: string
  started_date: string
  completed_date: string
  total_value?: number
  // joined
  first_name?: string
  last_name?: string
  registration?: string
  make?: string
  model?: string
  created_at: string
  updated_at: string
}

export interface LineItem {
  id?: number
  job_id?: number
  type: 'labour' | 'part' | 'other'
  description: string
  quantity: number
  unit_price: number
  total: number
  part_id?: number | null
}

export type InvoiceStatus = 'draft' | 'sent' | 'unpaid' | 'paid' | 'overdue'

export interface Invoice {
  id: number
  invoice_number: string
  job_id: number
  customer_id: number
  status: InvoiceStatus
  subtotal: number
  vat_rate: number
  vat_amount: number
  total: number
  notes: string
  due_date: string
  paid_date: string
  payment_method: string
  // joined
  first_name?: string
  last_name?: string
  job_number?: string
  job_title?: string
  registration?: string
  make?: string
  model?: string
  created_at: string
  updated_at: string
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted'

export interface Quote {
  id: number
  quote_number: string
  customer_id: number
  vehicle_id: number
  status: QuoteStatus
  title: string
  subtotal: number
  vat_rate: number
  vat_amount: number
  total: number
  notes: string
  valid_until: string
  converted_job_id: number
  // joined
  first_name?: string
  last_name?: string
  registration?: string
  make?: string
  model?: string
  created_at: string
  updated_at: string
}

export interface Booking {
  id: number
  customer_id: number
  vehicle_id: number
  job_id: number
  title: string
  start_time: string
  end_time: string
  notes: string
  status: string
  // joined
  first_name?: string
  last_name?: string
  registration?: string
  make?: string
  model?: string
  created_at: string
  updated_at: string
}

export interface Part {
  id: number
  sku: string
  name: string
  description: string
  supplier: string
  cost_price: number
  sale_price: number
  stock_quantity: number
  min_stock: number
  location: string
  created_at: string
  updated_at: string
}

export interface Settings {
  id: number
  business_name: string
  address: string
  phone: string
  email: string
  vat_number: string
  vat_rate: number
  labour_rate: number
  invoice_prefix: string
  invoice_next: number
  quote_prefix: string
  quote_next: number
  currency: string
  logo_data?: string | null
  // Branding & appearance
  accent_color?: string
  ui_density?: 'comfortable' | 'compact'
  // Business defaults
  payment_terms?: string
  bank_details?: string
  reminder_lead_days?: number
  // Documents & templates
  terms?: string
  quote_notes?: string
  invoice_notes?: string
  invoice_footer?: string
  jobsheet_footer?: string
  // Opening hours (per-weekday)
  opening_hours?: Record<string, { open: boolean; from: string; to: string }>
}

export interface PresetJobItem {
  id?: number
  preset_job_id?: number
  type: 'labour' | 'part' | 'other'
  description: string
  quantity: number
  unit_price: number
  sort_order?: number
}

export interface PresetJob {
  id: number
  name: string
  category?: string
  description?: string
  labour_hours?: number
  active?: boolean
  sort_order?: number
  items: PresetJobItem[]
  created_at?: string
  updated_at?: string
}

export type InspectionStatus = 'pass' | 'advisory' | 'fail' | 'na'

export interface InspectionItem {
  category: string
  item: string
  status: InspectionStatus
  note?: string
}

export interface Inspection {
  id: number
  vehicle_id?: number | null
  customer_id?: number | null
  job_id?: number | null
  technician_id?: number | null
  status: 'in_progress' | 'complete'
  result: '' | 'pass' | 'advisory' | 'fail'
  mileage?: number | null
  notes?: string
  items: InspectionItem[]
  inspected_on?: string
  // joined
  registration?: string
  make?: string
  model?: string
  first_name?: string
  last_name?: string
  created_at?: string
  updated_at?: string
}
