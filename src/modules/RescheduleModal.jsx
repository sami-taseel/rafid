import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'

const DOW = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// نافذة تأجيل الجلسة: تقويم احترافي لاختيار الموعد الجديد + «إلى إشعار آخر»
export default function RescheduleModal({ session, onConfirm, onClose }) {
  const today = new Date()
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const sessName = session.title || session.activities?.title || 'الجلسة'

  const year = view.getFullYear(), month = view.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = today.toLocaleDateString('en-CA')

  function pick(d) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    onConfirm(ds)
  }

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return createPortal(
    <div className="rs-overlay" onClick={onClose}>
      <div className="rs-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="rs-close" onClick={onClose} aria-label="إغلاق"><Icon name="x" size={18} /></button>
        <div className="rs-head">
          <div className="rs-head-ic"><Icon name="calendar" size={20} /></div>
          <h3 className="rs-title">تأجيل الجلسة</h3>
          <p className="rs-sub">{sessName}</p>
        </div>

        <div className="rs-cal">
          <div className="rs-cal-bar">
            <button className="rs-nav" onClick={() => setView(new Date(year, month - 1, 1))} aria-label="السابق"><Icon name="chevronRight" size={18} /></button>
            <span className="rs-month">{MON[month]} {year}</span>
            <button className="rs-nav" onClick={() => setView(new Date(year, month + 1, 1))} aria-label="التالي"><Icon name="chevronLeft" size={18} /></button>
          </div>
          <div className="rs-dow">{DOW.map(d => <span key={d}>{d}</span>)}</div>
          <div className="rs-grid">
            {cells.map((d, i) => {
              if (!d) return <span key={i} className="rs-empty"></span>
              const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const isToday = ds === todayStr
              const isPast = ds < todayStr
              return (
                <button key={i} className={'rs-day' + (isToday ? ' today' : '') + (isPast ? ' past' : '')}
                  onClick={() => pick(d)} disabled={isPast}>{d}</button>
              )
            })}
          </div>
        </div>

        <button className="rs-tbd" onClick={() => onConfirm(null)}>
          <Icon name="clock" size={16} /> تأجيل إلى إشعار آخر
        </button>
      </div>
    </div>,
    document.body
  )
}
