import { createContext, useContext, useState, useCallback } from 'react'

const ConfirmCtx = createContext(null)
export function useConfirm() { return useContext(ConfirmCtx) }

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)

  // confirm({ title, message, confirmText, cancelText, danger }) => Promise<boolean>
  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({ ...opts, resolve })
    })
  }, [])

  function close(result) {
    if (state?.resolve) state.resolve(result)
    setState(null)
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-overlay" onClick={() => close(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className={'confirm-icon ' + (state.danger ? 'danger' : 'info')}>
              {state.danger ? '⚠️' : '❓'}
            </div>
            <div className="confirm-title">{state.title || 'تأكيد'}</div>
            {state.message && <div className="confirm-msg">{state.message}</div>}
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => close(false)}>{state.cancelText || 'إلغاء'}</button>
              <button className={'confirm-ok' + (state.danger ? ' danger' : '')} onClick={() => close(true)}>
                {state.confirmText || 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}
