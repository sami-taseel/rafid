import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icon'

// نواقص ملف الطالب بالتفصيل
export default function ProfileGapsModal({ student, onClose }) {
  const [gaps, setGaps] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.rpc('profile_gaps', { p_student: student.id })
      .then(({ data, error }) => {
        if (error) { setErr(error.message); setGaps([]) } else setGaps(data || [])
      }, e => { setErr(String(e?.message || e)); setGaps([]) })
  }, [student.id])

  const byKind = {}
  ;(gaps || []).forEach(g => { (byKind[g.kind] = byKind[g.kind] || []).push(g.item) })

  return createPortal(
    <div className="exc-overlay" onClick={onClose}>
      <div className="exc-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="exc-dialog-hero" style={{ background: 'linear-gradient(135deg,#b3730a,#d4941f)' }}>
          <button className="exc-close" onClick={onClose} aria-label="إغلاق"><Icon name="x" size={18} /></button>
          <div className="exc-hero-ic"><Icon name="clipboard" size={22} /></div>
          <h3 className="exc-hero-title">نواقص الملف</h3>
          <p className="exc-hero-sub">{student.name || 'الطالب'}</p>
        </div>

        <div className="exc-dialog-body">
          {gaps === null && <div className="state"><div className="spinner"></div></div>}

          {err && <div className="attach-error">⚠ {err}</div>}

          {gaps && gaps.length === 0 && !err && (
            <div className="pg-ok"><Icon name="check" size={28} />
              <div style={{ marginTop: 8, fontWeight: 700 }}>لا نواقص — الملف مكتمل</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                إن كان مصنّفاً «ناقص» فراجع اعتماد الملف من صفحة تفاصيله.
              </div>
            </div>
          )}

          {gaps && gaps.length > 0 && (
            <>
              <div className="pg-head">
                <Icon name="alert" size={17} />
                <span>ينقص <strong>{gaps.length}</strong> عنصراً لإكمال الملف</span>
              </div>
              {Object.entries(byKind).map(([kind, items]) => (
                <div className="pg-group" key={kind}>
                  <div className="pg-kind">
                    {kind === 'حقل' ? '📝 حقول ناقصة' : kind === 'مرفق' ? '📎 مرفقات ناقصة' : '✍ أخرى'}
                    <span className="pg-n">{items.length}</span>
                  </div>
                  <div className="pg-items">
                    {items.map((it, i) => <span className="pg-item" key={i}>{it}</span>)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
