import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { registerOfflineServiceWorker } from '@/lib/registerOfflineServiceWorker'

registerOfflineServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)