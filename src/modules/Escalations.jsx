import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import Icon from '../Icon'
import { Spinner } from './Students'
import { formatDate } from '../dateUtils'

// صفحة المدير: مراجعة بلاغات مشرفي الطلاب
export default function Escalations() {
  const toast = useToast()
  const [list, setList] = useState(null)
  const [filter, setFilter] = useState('open')
  const [acting, setActing] = useState(null)   // البلاغ قيد المعالجة
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.rpc('list_escalations', { p_status: filter })
    if (error) { toast('تعذّر تحميل البلاغات', 'error'); setList([]); return }
    setList(data || [])
  }
  useEffect(() => { load() }, [filter])

  async function resolve(action) {
    setBusy(true)
    const { data, error } = await supabase.rpc('resolve_escalation', {
      p_id: acting.id, p_action: action, p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) { toast('تعذّر تحديث البلاغ', 'error'); return }
    toast(action === 'reviewed' ? 'تمت المراجعة وإشعار الطالب' : 'أُغلق البلاغ', 'success')
    setActing(null); setNote(''); load()
  }

  if (list === null) return <Spinner />

  return (
    <div>
      <h2 className="section-title">بلاغات المشرفين</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        بلاغات يرفعها مشرفو الطلاب عن تكرار الغياب بلا عذر، لاتخاذ الإجراء المناسب.
      </p>

      <div className="esc-filters">
        {[['open', 'مفتوحة'], ['reviewed', 'تمت مراجعتها'], ['closed', 'مغلقة'], ['all', 'الكل']].map(([v, l]) => (
          <button key={v} className={'esc-filter' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Icon name="check" size={34} />
          <div style={{ marginTop: 8 }}>لا بلاغات {filter === 'open' ? 'مفتوحة' : ''}</div>
        </div>
      )}

      <div className="esc-list">
        {list.map(e => (
          <div className={'esc-card st-' + e.status} key={e.id}>
            <div className="esc-top">
              <div className="esc-av">{(e.student_name || '؟').charAt(0)}</div>
              <div className="esc-info">
                <div className="esc-name">{e.student_name}</div>
                <div className="esc-meta">
                  <span><Icon name="user" size={12} /> رفعه: {e.monitor_name}</span>
                  <span>{formatDate(e.created_at?.slice(0, 10))}</span>
                </div>
              </div>
              <div className="esc-badges">
                <span className="esc-abs">{e.absences} غياب بلا عذر</span>
                <span className={'esc-status ' + e.status}>
                  {e.status === 'open' ? 'مفتوح' : e.status === 'reviewed' ? 'تمت المراجعة' : 'مغلق'}
                </span>
              </div>
            </div>

            <div className="esc-reason">
              <span className="esc-label">ملاحظات المشرف:</span> {e.reason}
            </div>
            {e.admin_note && (
              <div className="esc-admin-note">
                <span className="esc-label">إجراء الإدارة:</span> {e.admin_note}
              </div>
            )}

            {e.status === 'open' && (
              <div className="esc-actions">
                <button className="esc-review" onClick={() => { setActing({ ...e, act: 'reviewed' }); setNote('') }}>
                  <Icon name="check" size={15} /> مراجعة وإشعار الطالب
                </button>
                <button className="esc-close-btn" onClick={() => { setActing({ ...e, act: 'closed' }); setNote('') }}>
                  إغلاق بلا إجراء
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* نافذة الإجراء */}
      {acting && createPortal(
        <div className="exc-overlay" onClick={() => !busy && setActing(null)}>
          <div className="exc-dialog" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 430 }}>
            <div className="exc-dialog-hero" style={{
              background: acting.act === 'reviewed'
                ? 'linear-gradient(135deg,#1f3864,#3a5da0)'
                : 'linear-gradient(135deg,#6b7280,#9ca3af)',
            }}>
              <button className="exc-close" onClick={() => !busy && setActing(null)}><Icon name="x" size={18} /></button>
              <h3 className="exc-hero-title">
                {acting.act === 'reviewed' ? 'مراجعة البلاغ' : 'إغلاق البلاغ'}
              </h3>
              <p className="exc-hero-sub">{acting.student_name} · {acting.absences} غياب</p>
            </div>
            <div className="exc-dialog-body">
              <label className="exc-label">
                <Icon name="edit" size={14} /> ملاحظة الإدارة
                {acting.act === 'reviewed' && <span className="exc-required">تصل الطالب</span>}
              </label>
              <textarea className="exc-textarea" rows={3} value={note} maxLength={400}
                onChange={ev => setNote(ev.target.value)} autoFocus
                placeholder={acting.act === 'reviewed'
                  ? 'وضّح الإجراء أو التنبيه الذي سيصل الطالب…'
                  : 'سبب الإغلاق (اختياري)…'} />
              {acting.act === 'reviewed' && (
                <div className="exc-info-box">
                  <Icon name="alert" size={15} />
                  <span>سيصل الطالب إشعار بمضمون ملاحظتك. إن تركتها فارغة يُرسل نص تنبيه عام.</span>
                </div>
              )}
            </div>
            <div className="exc-dialog-foot">
              <button className="exc-btn-cancel" onClick={() => !busy && setActing(null)}>إلغاء</button>
              <button className="exc-btn-send" disabled={busy}
                onClick={() => resolve(acting.act)}>
                {busy ? 'جارٍ…' : (acting.act === 'reviewed' ? 'اعتماد وإشعار' : 'إغلاق البلاغ')}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  )
}

export async function pendingEscalationCount() {
  const { data } = await supabase.rpc('pending_escalation_count')
  return data || 0
}
