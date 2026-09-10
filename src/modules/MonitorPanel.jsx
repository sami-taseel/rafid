import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import Icon from '../Icon'
import { formatDate } from '../dateUtils'

const DOW_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
function dayName(d) { return d ? DOW_AR[new Date(d + 'T00:00:00').getDay()] : '' }

const ABSENCE_REASONS = ['مرض', 'ظرف عائلي', 'ارتباط دراسي', 'سفر', 'بلا عذر', 'أخرى']

// لوحة مشرف الطلاب: متابعة حضور مجموعته وتصعيد البلاغات
export default function MonitorPanel({ studentId }) {
  const toast = useToast()
  const [sessions, setSessions] = useState([])
  const [sel, setSel] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)
  const [busy, setBusy] = useState(null)
  const [reasonFor, setReasonFor] = useState(null)
  const [reasonVal, setReasonVal] = useState('')
  const [escalateFor, setEscalateFor] = useState(null)
  const [escNote, setEscNote] = useState('')

  useEffect(() => {
    async function load() {
      const today = new Date().toLocaleDateString('en-CA')
      const { data, error } = await supabase.from('sessions')
        .select('id, title, planned_date, start_time, activities(title)')
        .lte('planned_date', today)
        .order('planned_date', { ascending: false }).limit(30)
      if (error) { setLoadErr(error.message) }
      setSessions(data || []); setLoading(false)
    }
    load()
  }, [studentId])

  async function openSession(s) {
    setSel(s); setRows([])
    const { data, error } = await supabase.rpc('monitor_session_students', { p_session: s.id })
    if (error) { toast('تعذّر تحميل قائمة طلابك', 'error'); return }
    setRows(data || [])
  }

  async function setStatus(sid, status, reason = null) {
    setBusy(sid)
    const { error } = await supabase.rpc('monitor_set_attendance', {
      p_session: sel.id, p_student: sid, p_status: status, p_reason: reason,
    })
    setBusy(null)
    if (error) { toast('تعذّر التحديث', 'error'); return }
    setRows(rs => rs.map(r => r.student_id === sid
      ? { ...r, status, absence_reason: reason } : r))
  }

  async function confirmAll() {
    const { data, error } = await supabase.rpc('monitor_confirm_all', { p_session: sel.id })
    if (error) { toast('تعذّر التأكيد الجماعي', 'error'); return }
    toast(`تم تأكيد حضور ${data || 0} طالباً`, 'success')
    openSession(sel)
  }

  async function submitReason() {
    const r = reasonVal === 'أخرى' ? (reasonFor.custom || '').trim() : reasonVal
    await setStatus(reasonFor.student_id, 'absent', r || null)
    setReasonFor(null); setReasonVal('')
    toast('سُجّل سبب الغياب', 'info')
  }

  async function submitEscalation() {
    const { data, error } = await supabase.rpc('raise_escalation', {
      p_student: escalateFor.student_id,
      p_reason: escNote.trim() || 'تكرار الغياب بلا عذر',
    })
    if (error) { toast('تعذّر رفع البلاغ', 'error'); return }
    toast(data || 'تم رفع البلاغ', 'success')
    setEscalateFor(null); setEscNote('')
  }

  if (loading) return <div className="state"><div className="spinner"></div>…</div>

  // عرض قائمة الجلسات
  if (!sel) {
    return (
      <div className="mon-panel">
        <div className="mon-head">
          <div className="mon-head-ic"><Icon name="users" size={20} /></div>
          <div>
            <h3 className="mon-title">متابعة حضور مجموعتي</h3>
            <p className="mon-sub">اختر جلسة لتأكيد حضور طلابك وتسجيل أسباب الغياب</p>
          </div>
        </div>
        {loadErr && <div className="attach-error">⚠ تعذّر تحميل الجلسات: {loadErr}</div>}
        {!loadErr && sessions.length === 0 && (
          <div className="muted" style={{ padding: 20, textAlign: 'center' }}>
            لا توجد جلسات سابقة ظاهرة لك.<br />
            <span style={{ fontSize: 12 }}>تأكد أن أنشطة مجموعتك تشملك ضمن فئاتها المستهدفة.</span>
          </div>
        )}
        <div className="mon-sessions">
          {sessions.map(s => (
            <button key={s.id} className="mon-sess" onClick={() => openSession(s)}>
              <div className="mon-sess-main">
                <div className="mon-sess-act">{s.activities?.title || 'نشاط'}</div>
                <div className="mon-sess-name">{s.title || 'جلسة'}</div>
              </div>
              <div className="mon-sess-date">{dayName(s.planned_date)} {formatDate(s.planned_date)}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // عرض طلاب الجلسة
  const pending = rows.filter(r => r.status === 'pending').length
  return (
    <div className="mon-panel">
      <div className="mon-bar">
        <button className="mon-back" onClick={() => setSel(null)}><Icon name="chevronRight" size={16} /> رجوع</button>
        <div className="mon-bar-title">{sel.activities?.title} · {sel.title}</div>
      </div>

      {pending > 0 && (
        <div className="mon-pending-bar">
          <span>{pending} طالباً سجّلوا حضورهم وينتظرون تأكيدك</span>
          <button className="mon-confirm-all" onClick={confirmAll}>✓ تأكيد الجميع</button>
        </div>
      )}

      <div className="mon-list">
        {rows.map(r => (
          <div className={'mon-row st-' + r.status} key={r.student_id}>
            <div className="mon-row-info">
              <span className="mon-name">{r.full_name}</span>
              <span className="mon-state">
                {/* نعرض فقط ما لا تُغنيه الأزرار: الانتظار، الإذن، سبب الغياب */}
                {r.status === 'pending' && <span className="mon-tag pending">سجّل حضوره — بانتظار تأكيدك</span>}
                {r.status === 'excused' && <span className="mon-tag excused">مستأذن</span>}
                {r.status === 'absent' && (
                  <span className="mon-tag absent">
                    {r.absence_reason ? `العذر: ${r.absence_reason}` : 'بلا عذر'}
                  </span>
                )}
                {r.status === 'not_recorded' && <span className="mon-tag none">لم يسجّل</span>}
              </span>
            </div>
            <div className="mon-actions">
              <button className={'mon-btn ok' + (r.status === 'present' ? ' on' : '')}
                disabled={busy === r.student_id}
                onClick={() => setStatus(r.student_id, 'present')}>
                {r.status === 'present' && '✓ '}حاضر
              </button>
              <button className={'mon-btn no' + (r.status === 'absent' ? ' on' : '')}
                disabled={busy === r.student_id}
                onClick={() => { setReasonFor(r); setReasonVal('') }}>
                {r.status === 'absent' && '✓ '}غائب
              </button>
              {r.unexcused_count >= 3 && (
                <button className="mon-btn esc" onClick={() => setEscalateFor(r)}
                  title={`${r.unexcused_count} غياب بلا عذر`}>
                  ⚠ تصعيد
                </button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="muted" style={{ padding: 20 }}>لا طلاب في مجموعتك بعد. راجع الإدارة.</div>}
      </div>

      {/* سبب الغياب */}
      {reasonFor && createPortal(
        <div className="exc-overlay" onClick={() => setReasonFor(null)}>
          <div className="exc-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="exc-dialog-hero" style={{ background: 'linear-gradient(135deg,#b3730a,#d4941f)' }}>
              <button className="exc-close" onClick={() => setReasonFor(null)}><Icon name="x" size={18} /></button>
              <h3 className="exc-hero-title">سبب الغياب</h3>
              <p className="exc-hero-sub">{reasonFor.full_name}</p>
            </div>
            <div className="exc-dialog-body">
              <div className="mon-reasons">
                {ABSENCE_REASONS.map(r => (
                  <button key={r} className={'mon-reason' + (reasonVal === r ? ' on' : '')}
                    onClick={() => setReasonVal(r)}>{r}</button>
                ))}
              </div>
              {reasonVal === 'أخرى' && (
                <input className="exc-textarea" style={{ marginTop: 10 }} placeholder="اكتب السبب…"
                  onChange={e => setReasonFor({ ...reasonFor, custom: e.target.value })} />
              )}
            </div>
            <div className="exc-dialog-foot">
              <button className="exc-btn-cancel" onClick={() => setReasonFor(null)}>إلغاء</button>
              <button className="exc-btn-send" onClick={submitReason} disabled={!reasonVal}>حفظ</button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* تصعيد بلاغ */}
      {escalateFor && createPortal(
        <div className="exc-overlay" onClick={() => setEscalateFor(null)}>
          <div className="exc-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="exc-dialog-hero" style={{ background: 'linear-gradient(135deg,#b32d2d,#d85a5a)' }}>
              <button className="exc-close" onClick={() => setEscalateFor(null)}><Icon name="x" size={18} /></button>
              <div className="exc-hero-ic"><Icon name="alert" size={24} /></div>
              <h3 className="exc-hero-title">تصعيد بلاغ</h3>
              <p className="exc-hero-sub">{escalateFor.full_name} · {escalateFor.unexcused_count} غياب بلا عذر</p>
            </div>
            <div className="exc-dialog-body">
              <label className="exc-label">ملاحظاتك للمشرف الإداري</label>
              <textarea className="exc-textarea" rows={3} value={escNote}
                onChange={e => setEscNote(e.target.value)}
                placeholder="صف الحالة ومحاولاتك للتواصل مع الطالب…" />
              <div className="exc-info-box" style={{ background: '#fce8e8', color: '#8a2020' }}>
                <Icon name="alert" size={15} />
                <span>سيصل البلاغ للمشرف الإداري لاتخاذ الإجراء المناسب.</span>
              </div>
            </div>
            <div className="exc-dialog-foot">
              <button className="exc-btn-cancel" onClick={() => setEscalateFor(null)}>إلغاء</button>
              <button className="exc-btn-send" style={{ background: 'linear-gradient(135deg,#b32d2d,#d85a5a)' }}
                onClick={submitEscalation}>رفع البلاغ</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  )
}
