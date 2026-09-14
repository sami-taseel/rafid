import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icon'
import { formatDate, formatTime } from '../dateUtils'

const DOW_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const ATT_LBL = { present:'حاضر', absent:'غائب', excused:'مستأذن', recorded:'استماع', pending:'بانتظار التأكيد' }

// معاينة حساب الطالب كما يراه — للقراءة فقط
export default function StudentPreview({ studentId, onClose }) {
  const [d, setD] = useState(null)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    async function load() {
      const [st, att, cats, pts, tickets, excuses] = await Promise.all([
        supabase.from('students').select('*, persons(*)').eq('id', studentId).maybeSingle(),
        supabase.from('attendance')
          .select('status, absence_reason, sessions(title, planned_date, start_time, activity_id, activities(title, activity_type))')
          .eq('student_id', studentId),
        supabase.rpc('category_students_of', { p_student: studentId }).then(r => r, () => ({ data: null })),
        supabase.rpc('student_points', { p_student: studentId }).then(r => r, () => ({ data: 0 })),
        supabase.from('tickets').select('id, title, status_code, created_at').eq('student_id', studentId)
          .order('created_at', { ascending: false }).then(r => r, () => ({ data: [] })),
        supabase.from('excuse_requests').select('reason, status, reject_reason, created_at')
          .eq('student_id', studentId).order('created_at', { ascending: false }).then(r => r, () => ({ data: [] })),
      ])
      setD({
        s: st.data, att: att.data || [], points: pts.data || 0,
        tickets: tickets.data || [], excuses: excuses.data || [],
      })
    }
    load()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [studentId])

  if (!d) return createPortal(
    <div className="spv-overlay"><div className="spv-box"><div className="spinner"></div></div></div>,
    document.body)

  const p = d.s?.persons || {}
  const att = d.att
  const prim = att.filter(x => x.sessions)
  const present = att.filter(x => x.status === 'present' || x.status === 'recorded').length
  const absent = att.filter(x => x.status === 'absent').length
  const excused = att.filter(x => x.status === 'excused').length
  const tot = present + absent + excused
  const rate = tot ? Math.round(present / tot * 100) : 0

  return createPortal(
    <div className="spv-overlay" onClick={onClose}>
      <div className="spv-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="spv-head">
          <button className="spv-close" onClick={onClose} aria-label="إغلاق"><Icon name="x" size={18} /></button>
          <div className="spv-av">{(p.full_name || '؟').charAt(0)}</div>
          <div className="spv-who">
            <div className="spv-name">{p.full_name || '—'}</div>
            <div className="spv-sub">{[d.s?.degree_level, p.nationality].filter(Boolean).join(' · ')}</div>
          </div>
          <span className="spv-readonly">👁 عرض فقط</span>
        </div>

        <div className="spv-tabs">
          {[['overview','نظرة عامة'],['attendance','الحضور'],['excuses','طلبات الإذن'],['tickets','البلاغات']].map(([v,l]) => (
            <button key={v} className={'spv-tab' + (tab === v ? ' on' : '')} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>

        <div className="spv-body">
          {tab === 'overview' && (
            <>
              <div className="spv-metrics">
                <div className="spv-m"><div className="spv-m-n">{rate}%</div><div className="spv-m-l">نسبة الحضور</div></div>
                <div className="spv-m"><div className="spv-m-n">{present}</div><div className="spv-m-l">حضور</div></div>
                <div className="spv-m"><div className="spv-m-n">{absent}</div><div className="spv-m-l">غياب</div></div>
                <div className="spv-m"><div className="spv-m-n">{d.points}</div><div className="spv-m-l">نقطة</div></div>
              </div>
              <div className="spv-info">
                {[['البريد', p.email], ['الجوال', p.phone], ['رقم الإقامة', p.residency_no],
                  ['الجنسية', p.nationality], ['المرحلة', d.s?.degree_level],
                  ['حالة الملف', d.s?.profile_reviewed ? 'مكتمل' : 'ناقص'],
                  ['مشرف تحضير', d.s?.is_monitor ? 'نعم' : 'لا']].map(([k, v]) => (
                  <div className="spv-row" key={k}><span className="spv-k">{k}</span><span className="spv-v">{v || '—'}</span></div>
                ))}
              </div>
            </>
          )}

          {tab === 'attendance' && (
            <div className="spv-list">
              {prim.length === 0 && <div className="muted" style={{ padding: 16 }}>لا سجلّات حضور.</div>}
              {prim.sort((a,b) => (b.sessions?.planned_date||'').localeCompare(a.sessions?.planned_date||'')).map((x, i) => (
                <div className="spv-item" key={i}>
                  <div className="spv-item-main">
                    <div className="spv-item-t">{x.sessions?.activities?.title || 'نشاط'}</div>
                    <div className="spv-item-s">{x.sessions?.title} · {x.sessions?.planned_date}</div>
                    {x.absence_reason && <div className="spv-item-s">العذر: {x.absence_reason}</div>}
                  </div>
                  <span className={'spv-badge ' + x.status}>{ATT_LBL[x.status] || x.status}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'excuses' && (
            <div className="spv-list">
              {d.excuses.length === 0 && <div className="muted" style={{ padding: 16 }}>لا طلبات إذن.</div>}
              {d.excuses.map((e, i) => (
                <div className="spv-item" key={i}>
                  <div className="spv-item-main">
                    <div className="spv-item-t">{e.reason}</div>
                    <div className="spv-item-s">{formatDate(String(e.created_at).slice(0,10))}</div>
                    {e.reject_reason && <div className="spv-item-s">سبب الرفض: {e.reject_reason}</div>}
                  </div>
                  <span className={'spv-badge ' + e.status}>
                    {e.status === 'approved' ? 'مقبول' : e.status === 'rejected' ? 'مرفوض' : 'معلّق'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 'tickets' && (
            <div className="spv-list">
              {d.tickets.length === 0 && <div className="muted" style={{ padding: 16 }}>لا بلاغات.</div>}
              {d.tickets.map(t => (
                <div className="spv-item" key={t.id}>
                  <div className="spv-item-main">
                    <div className="spv-item-t">{t.title || 'بلاغ'}</div>
                    <div className="spv-item-s">{formatDate(String(t.created_at).slice(0,10))}</div>
                  </div>
                  <span className="spv-badge">{t.status_code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
