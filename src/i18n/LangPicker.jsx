import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from './LangContext'

export default function LangPicker() {
  const { lang, setLang, available } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const [pos, setPos] = useState({ top: 60, left: 12 })

  useEffect(() => {
    function onClick(e) { if (e.target.closest && e.target.closest('.langpick-menu')) return
      if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (available.length <= 1) return null
  const current = available.find(l => l.code === lang)

  return (
    <div className="langpick" ref={ref}>
      <button type="button" className="langpick-btn" aria-label="تغيير اللغة"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setPos({ top: r.bottom + 8, left: Math.max(8, r.left) })
          setOpen(!open)
        }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span className="langpick-code">{current?.code?.toUpperCase()}</span>
      </button>
      {open && createPortal(
        <div className="langpick-menu langpick-fixed" style={{ top: pos.top, left: pos.left }}>
          {available.map(l => (
            <button key={l.code} type="button"
              className={'langpick-item' + (l.code === lang ? ' active' : '')}
              onClick={() => { setLang(l.code); setOpen(false) }}>
              <span>{l.name_native}</span>
              {l.code === lang && <span className="langpick-check">✓</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
