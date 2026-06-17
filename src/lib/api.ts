// Type definition matching the API exposed via contextBridge in electron/preload.ts
export interface GaragelyAPI {
  getCustomers: () => Promise<unknown[]>
  getCustomer: (id: number) => Promise<unknown>
  createCustomer: (data: unknown) => Promise<unknown>
  updateCustomer: (id: number, data: unknown) => Promise<unknown>
  deleteCustomer: (id: number) => Promise<unknown>
  getVehicles: (customerId?: number) => Promise<unknown[]>
  getVehicle: (id: number) => Promise<unknown>
  createVehicle: (data: unknown) => Promise<unknown>
  updateVehicle: (id: number, data: unknown) => Promise<unknown>
  deleteVehicle: (id: number) => Promise<unknown>
  getJobs: (filters?: unknown) => Promise<unknown[]>
  getJob: (id: number) => Promise<unknown>
  createJob: (data: unknown) => Promise<unknown>
  updateJob: (id: number, data: unknown) => Promise<unknown>
  deleteJob: (id: number) => Promise<unknown>
  getJobLineItems: (jobId: number) => Promise<unknown[]>
  saveJobLineItems: (jobId: number, items: unknown) => Promise<unknown>
  getInvoices: (filters?: unknown) => Promise<unknown[]>
  getInvoice: (id: number) => Promise<unknown>
  createInvoice: (data: unknown) => Promise<unknown>
  updateInvoice: (id: number, data: unknown) => Promise<unknown>
  deleteInvoice: (id: number) => Promise<unknown>
  getQuotes: () => Promise<unknown[]>
  getQuote: (id: number) => Promise<unknown>
  createQuote: (data: unknown) => Promise<unknown>
  updateQuote: (id: number, data: unknown) => Promise<unknown>
  deleteQuote: (id: number) => Promise<unknown>
  convertQuoteToJob: (id: number) => Promise<unknown>
  getBookings: (filters?: unknown) => Promise<unknown[]>
  getBooking: (id: number) => Promise<unknown>
  createBooking: (data: unknown) => Promise<unknown>
  updateBooking: (id: number, data: unknown) => Promise<unknown>
  deleteBooking: (id: number) => Promise<unknown>
  getParts: () => Promise<unknown[]>
  getPart: (id: number) => Promise<unknown>
  createPart: (data: unknown) => Promise<unknown>
  updatePart: (id: number, data: unknown) => Promise<unknown>
  deletePart: (id: number) => Promise<unknown>
  getDashboardData: () => Promise<unknown>
  getRevenueReport: (from: string, to: string) => Promise<unknown>
  getJobsReport: (from: string, to: string) => Promise<unknown>
  getSettings: () => Promise<unknown>
  updateSettings: (data: unknown) => Promise<unknown>
}

// Bridge to the Electron IPC layer exposed via contextBridge
const api = (window as unknown as { api: GaragelyAPI }).api

export default api
