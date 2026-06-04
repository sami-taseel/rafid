import { useState, useRef, useEffect } from 'react'
import { useLang } from './LangContext'

export default function LangPicker() {
  const { lang, setLang, available } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (available.length <= 1) return null
  const current = available.find(l => l.code === lang)

  return (
    <div className="langpick" ref={ref}>
      <button type="button" className="langpick-btn" onClick={() => setOpen(!open)} aria-label="تغيير اللغة">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span className="langpick-code">{current?.code?.toUpperCase()}</span>
      </button>
      {open && (
        <div className="langpick-menu">
          {available.map(l => (
            <button key={l.code} type="button"
              className={'langpick-item' + (l.code === lang ? ' active' : '')}
              onClick={() => { setLang(l.code); setOpen(false) }}>
              <span>{l.name_native}</span>
              {l.code === lang && <span className="langpick-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
