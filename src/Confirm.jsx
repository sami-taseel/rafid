import { createContext, useContext, useState, useCallback } from 'react'

const ConfirmCtx = createContext(null)
const PromptCtx = createContext(null)
export function useConfirm() { return useContext(ConfirmCtx) }
export function usePrompt() { return useContext(PromptCtx) }

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const [promptState, setPromptState] = useState(null)
  const [promptValue, setPromptValue] = useState('')

  // confirm({ title, message, confirmText, cancelText, danger }) => Promise<boolean>
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), [])
  // prompt({ title, message, placeholder, defaultValue, multiline, confirmText }) => Promise<string|null>
  const prompt = useCallback((opts) => new Promise((resolve) => {
    setPromptValue(opts.defaultValue || '')
    setPromptState({ ...opts, resolve })
  }), [])

  function close(result) { if (state?.resolve) state.resolve(result); setState(null) }
  function closePrompt(val) { if (promptState?.resolve) promptState.resolve(val); setPromptState(null); setPromptValue('') }

  return (
    <ConfirmCtx.Provider value={confirm}>
      <PromptCtx.Provider value={prompt}>
        {children}
        {state && (
          <div className="confirm-overlay" onClick={() => close(false)}>
            <div className="confirm-box" onClick={e => e.stopPropagation()}>
              <div className={'confirm-icon ' + (state.danger ? 'danger' : 'info')}>{state.danger ? '⚠️' : '❓'}</div>
              <div className="confirm-title">{state.title || 'تأكيد'}</div>
              {state.message && <div className="confirm-msg">{state.message}</div>}
              <div className="confirm-actions">
                <button className="confirm-cancel" onClick={() => close(false)}>{state.cancelText || 'إلغاء'}</button>
                <button className={'confirm-ok' + (state.danger ? ' danger' : '')} onClick={() => close(true)}>{state.confirmText || 'تأكيد'}</button>
              </div>
            </div>
          </div>
        )}
        {promptState && (
          <div className="confirm-overlay" onClick={() => closePrompt(null)}>
            <div className="confirm-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <div className="confirm-title">{promptState.title || 'إدخال'}</div>
              {promptState.message && <div className="confirm-msg">{promptState.message}</div>}
              {promptState.multiline ? (
                <textarea className="prompt-input" rows={4} value={promptValue} autoFocus
                  placeholder={promptState.placeholder || ''} onChange={e => setPromptValue(e.target.value)} />
              ) : (
                <input className="prompt-input" value={promptValue} autoFocus
                  placeholder={promptState.placeholder || ''} onChange={e => setPromptValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') closePrompt(promptValue) }} />
              )}
              <div className="confirm-actions">
                <button className="confirm-cancel" onClick={() => closePrompt(null)}>إلغاء</button>
                <button className="confirm-ok" onClick={() => closePrompt(promptValue)}>{promptState.confirmText || 'إرسال'}</button>
              </div>
            </div>
          </div>
        )}
      </PromptCtx.Provider>
    </ConfirmCtx.Provider>
  )
}
