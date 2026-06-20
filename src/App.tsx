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
import Auth from './pages/Auth'
import UpdateBanner from './components/UpdateBanner'
import DemoBanner from './components/DemoBanner'
import { supabase } from './lib/supabase'

type Status = 'checking' | 'unauthed' | 'authed'

export default function App() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'authed' : 'unauthed')
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'authed' : 'unauthed')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-[#16181D] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#F4A523] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#6B7280] text-sm">Starting GarageLY…</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthed') {
    return <Auth />
  }

  return (
    <>
      <Layout>
        <DemoBanner />
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
