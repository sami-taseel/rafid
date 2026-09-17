import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icon'
import StudentHome from './StudentHome'
import StudentCalendar from './StudentCalendar'
import StudentSurveys from './StudentSurveys'

// عرض صفحة الطالب كما يراها تماماً — للقراءة فقط
export default function StudentPreview({ studentId, onClose }) {
  const [p, setP] = useState(null)
  const [tab, setTab] = useState('home')

  useEffect(() => {
    supabase.from('students').select('degree_level, persons(full_name, nationality)')
      .eq('id', studentId).maybeSingle()
      .then(({ data }) => setP(data), () => setP(null))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [studentId])

  const name = p?.persons?.full_name || 'طالب'

  return createPortal(
    <div className="spv-overlay" onClick={onClose}>
      <div className="spv-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="spv-head">
          <button className="spv-close" onClick={onClose} aria-label="إغلاق"><Icon name="x" size={18} /></button>
          <div className="spv-av">{name.charAt(0)}</div>
          <div className="spv-who">
            <div className="spv-name">{name}</div>
            <div className="spv-sub">
              {[p?.degree_level, p?.persons?.nationality].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <span className="spv-readonly">👁 كما يراها الطالب</span>
        </div>

        <div className="spv-tabs">
          {[['home','الرئيسية'],['calendar','التقويم'],['surveys','الاستبانات']].map(([v,l]) => (
            <button key={v} className={'spv-tab' + (tab === v ? ' on' : '')} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>

        {/* طبقة تمنع أي تفاعل — عرض خالص */}
        <div className="spv-body spv-locked">
          <div className="spv-shield" title="وضع العرض — لا يمكن تنفيذ أي إجراء"></div>
          <div className="sp-container">
            {tab === 'home' && <StudentHome studentId={studentId} viewAs isFull />}
            {tab === 'calendar' && <StudentCalendar studentId={studentId} viewAs />}
            {tab === 'surveys' && <StudentSurveys studentId={studentId} />}
          </div>
        </div>

        <div className="spv-foot">
          <Icon name="eye" size={14} /> هذه الصفحة للاطلاع فقط — كل الأزرار معطّلة
        </div>
      </div>
    </div>,
    document.body
  )
}
