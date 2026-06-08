import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ToastProvider } from './Toast'
import { ConfirmProvider } from './Confirm'
import ErrorBoundary from './ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ConfirmProvider>
    </ToastProvider>
  </React.StrictMode>,
)
