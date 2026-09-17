import { useEffect, useState, Component } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icon'
import StudentHome from './StudentHome'
import StudentCalendar from './StudentCalendar'
import StudentSurveys from './StudentSurveys'
import StudentTickets from './StudentTickets'
import MonitorPanel from './MonitorPanel'
import StudentAttachments from './StudentAttachments'
import { LangProvider } from '../i18n/LangContext'

// حدّ خطأ: يمنع انهيار صفحة المدير إن فشل عرض جزء من صفحة الطالب
class PreviewBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div className="spv-err">
          <Icon name="alert" size={26} />
          <div style={{ marginTop: 8, fontWeight: 700 }}>تعذّر عرض هذا القسم</div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: .8 }}>{String(this.state.err?.message || '')}</div>
        </div>
      )
    }
    return this.props.children
  }
}

// عرض صفحة الطالب كما يراها تماماً — للقراءة فقط
export default function StudentPreview({ studentId, onClose }) {
  const [p, setP] = useState(null)
  const [tab, setTab] = useState('home')

  useEffect(() => {
    supabase.from('students').select('id, person_id, degree_level, is_monitor, signature_path, persons(full_name, nationality)')
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
          {[['home','الرئيسية'],['calendar','التقويم'],['surveys','الاستبانات'],
            ...(p?.is_monitor ? [['monitor','مجموعتي']] : []),
            ['tickets','البلاغات'],['files','المرفقات'],['gaps','نواقص الملف']].map(([v,l]) => (
            <button key={v} className={'spv-tab' + (tab === v ? ' on' : '')} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>

        {/* طبقة تمنع أي تفاعل — عرض خالص */}
        <div className="spv-body spv-locked">
          <div className="spv-shield" title="وضع العرض — لا يمكن تنفيذ أي إجراء"></div>
          <PreviewBoundary key={tab}><LangProvider>
            <div className="sp-container">
              {tab === 'home' && <StudentHome studentId={studentId} viewAs isFull />}
              {tab === 'calendar' && <StudentCalendar studentId={studentId} viewAs />}
              {tab === 'surveys' && <StudentSurveys studentId={studentId} />}
              {tab === 'monitor' && <MonitorPanel studentId={studentId} />}
              {tab === 'tickets' && <StudentTickets studentId={studentId} personId={p?.person_id} />}
              {tab === 'files' && <StudentAttachments studentId={studentId} />}
              {tab === 'gaps' && <ProfileGaps studentId={studentId} />}
            </div>
          </LangProvider></PreviewBoundary>
        </div>

        <div className="spv-foot">
          <Icon name="eye" size={14} /> هذه الصفحة للاطلاع فقط — كل الأزرار معطّلة
        </div>
      </div>
    </div>,
    document.body
  )
}

// نواقص ملف الطالب بالتفصيل
function ProfileGaps({ studentId }) {
  const [gaps, setGaps] = useState(null)
  useEffect(() => {
    supabase.rpc('profile_gaps', { p_student: studentId })
      .then(({ data }) => setGaps(data || []), () => setGaps([]))
  }, [studentId])

  if (gaps === null) return <div className="state"><div className="spinner"></div></div>
  if (gaps.length === 0) return (
    <div className="pg-ok"><Icon name="check" size={30} />
      <div style={{ marginTop: 8, fontWeight: 700 }}>الملف مكتمل</div>
    </div>
  )

  const byKind = {}
  gaps.forEach(g => { (byKind[g.kind] = byKind[g.kind] || []).push(g.item) })

  return (
    <div className="pg-wrap">
      <div className="pg-head">
        <Icon name="alert" size={18} />
        <span>ينقص هذا الطالب <strong>{gaps.length}</strong> عنصراً لإكمال ملفه</span>
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
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        نبّه الطالب لإكمال هذه العناصر من صفحة «ملفي» في حسابه.
      </p>
    </div>
  )
}
