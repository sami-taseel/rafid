import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)
export function useToast() { return useContext(ToastCtx) }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const show = useCallback((text, type = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, text, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={'toast ' + t.type}>
            {t.type === 'ok' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
