import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Licences from './pages/Licences'
import CreateTrial from './pages/CreateTrial'
import Sidebar from './components/Sidebar'

function isLoggedIn(): boolean {
  return !!localStorage.getItem('admin_secret')
}

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn)

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar onLogout={() => { localStorage.removeItem('admin_secret'); setAuthed(false) }} />
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/licences" element={<Licences />} />
          <Route path="/create-trial" element={<CreateTrial />} />
        </Routes>
      </main>
    </div>
  )
}
