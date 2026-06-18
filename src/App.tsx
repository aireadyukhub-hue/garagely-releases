import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Vehicles from './pages/Vehicles'
import VehicleDetail from './pages/VehicleDetail'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Invoices from './pages/Invoices'
import InvoiceDetail from './pages/InvoiceDetail'
import Quotes from './pages/Quotes'
import Calendar from './pages/Calendar'
import Parts from './pages/Parts'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Activate from './pages/Activate'
import UpdateBanner from './components/UpdateBanner'

type LicenceStatus = 'checking' | 'active' | 'none'

export default function App() {
  const [licenceStatus, setLicenceStatus] = useState<LicenceStatus>('checking')

  useEffect(() => {
    // Ask main process for the current licence state
    window.api.getLicence().then((licence) => {
      setLicenceStatus(licence ? 'active' : 'none')
    }).catch(() => {
      setLicenceStatus('none')
    })
  }, [])

  if (licenceStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#16181D] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#F4A523] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#6B7280] text-sm">Starting GarageLY…</p>
        </div>
      </div>
    )
  }

  if (licenceStatus === 'none') {
    return <Activate onActivated={() => setLicenceStatus('active')} />
  }

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/vehicles/:id" element={<VehicleDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/parts" element={<Parts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <UpdateBanner />
    </>
  )
}
