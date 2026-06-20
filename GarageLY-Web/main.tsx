import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from '@/App'
import '@/index.css'

// Web entry point. Same App component as the desktop app, but with a
// BrowserRouter (clean URLs) instead of the desktop's HashRouter.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
