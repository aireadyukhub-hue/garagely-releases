import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Customers
  getCustomers: () => ipcRenderer.invoke('customers:getAll'),
  getCustomer: (id: number) => ipcRenderer.invoke('customers:get', id),
  createCustomer: (data: unknown) => ipcRenderer.invoke('customers:create', data),
  updateCustomer: (id: number, data: unknown) => ipcRenderer.invoke('customers:update', id, data),
  deleteCustomer: (id: number) => ipcRenderer.invoke('customers:delete', id),

  // Vehicles
  getVehicles: (customerId?: number) => ipcRenderer.invoke('vehicles:getAll', customerId),
  getVehicle: (id: number) => ipcRenderer.invoke('vehicles:get', id),
  createVehicle: (data: unknown) => ipcRenderer.invoke('vehicles:create', data),
  updateVehicle: (id: number, data: unknown) => ipcRenderer.invoke('vehicles:update', id, data),
  deleteVehicle: (id: number) => ipcRenderer.invoke('vehicles:delete', id),

  // Jobs
  getJobs: (filters?: unknown) => ipcRenderer.invoke('jobs:getAll', filters),
  getJob: (id: number) => ipcRenderer.invoke('jobs:get', id),
  createJob: (data: unknown) => ipcRenderer.invoke('jobs:create', data),
  updateJob: (id: number, data: unknown) => ipcRenderer.invoke('jobs:update', id, data),
  deleteJob: (id: number) => ipcRenderer.invoke('jobs:delete', id),

  // Job line items
  getJobLineItems: (jobId: number) => ipcRenderer.invoke('jobLineItems:get', jobId),
  saveJobLineItems: (jobId: number, items: unknown) => ipcRenderer.invoke('jobLineItems:save', jobId, items),

  // Invoices
  getInvoices: (filters?: unknown) => ipcRenderer.invoke('invoices:getAll', filters),
  getInvoice: (id: number) => ipcRenderer.invoke('invoices:get', id),
  createInvoice: (data: unknown) => ipcRenderer.invoke('invoices:create', data),
  updateInvoice: (id: number, data: unknown) => ipcRenderer.invoke('invoices:update', id, data),
  deleteInvoice: (id: number) => ipcRenderer.invoke('invoices:delete', id),
  generateInvoicePDF: (id: number) => ipcRenderer.invoke('invoices:generatePDF', id),

  // Quotes
  getQuotes: () => ipcRenderer.invoke('quotes:getAll'),
  getQuote: (id: number) => ipcRenderer.invoke('quotes:get', id),
  createQuote: (data: unknown) => ipcRenderer.invoke('quotes:create', data),
  updateQuote: (id: number, data: unknown) => ipcRenderer.invoke('quotes:update', id, data),
  deleteQuote: (id: number) => ipcRenderer.invoke('quotes:delete', id),
  convertQuoteToJob: (id: number) => ipcRenderer.invoke('quotes:convertToJob', id),

  // Bookings
  getBookings: (filters?: unknown) => ipcRenderer.invoke('bookings:getAll', filters),
  getBooking: (id: number) => ipcRenderer.invoke('bookings:get', id),
  createBooking: (data: unknown) => ipcRenderer.invoke('bookings:create', data),
  updateBooking: (id: number, data: unknown) => ipcRenderer.invoke('bookings:update', id, data),
  deleteBooking: (id: number) => ipcRenderer.invoke('bookings:delete', id),

  // Parts
  getParts: () => ipcRenderer.invoke('parts:getAll'),
  getPart: (id: number) => ipcRenderer.invoke('parts:get', id),
  createPart: (data: unknown) => ipcRenderer.invoke('parts:create', data),
  updatePart: (id: number, data: unknown) => ipcRenderer.invoke('parts:update', id, data),
  deletePart: (id: number) => ipcRenderer.invoke('parts:delete', id),

  // Dashboard
  getDashboardData: () => ipcRenderer.invoke('dashboard:getData'),

  // Reports
  getRevenueReport: (from: string, to: string) => ipcRenderer.invoke('reports:revenue', from, to),
  getJobsReport: (from: string, to: string) => ipcRenderer.invoke('reports:jobs', from, to),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (data: unknown) => ipcRenderer.invoke('settings:update', data),
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
