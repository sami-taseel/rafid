import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'

const STATUS = [
  ['active', 'نشط (دفعة حالية)'], ['pending', 'قيد المراجعة'], ['interview', 'مقابلة'],
  ['accepted', 'مقبول'], ['rejected', 'مرفوض'], ['frozen', 'مجمّد'],
]
export const statusLabel = (s) => (STATUS.find(x => x[0] === s) || [s, s])[1]

// تقييم الطالب وإدارة حالة قبوله
export default function StudentEval({ studentId, currentStatus, onStatusChange }) {
  const toast = useToast()
  const [criteria, setCriteria] = useState([])
  const [scores, setScores] = useState({})
  const [notes, setNotes] = useState('')
  const [evalType, setEvalType] = useState('interview')
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState(currentStatus || 'active')
  const [showForm, setShowForm] = useState(false)
  const [acctState, setAcctState] = useState(null)
  const [noticeTemplates, setNoticeTemplates] = useState([])
  const [issuedNotices, setIssuedNotices] = useState([])
  const [noticeTpl, setNoticeTpl] = useState('')
  const [noticeText, setNoticeText] = useState('')

  async function load() {
    const [cr, ev, nt, nr] = await Promise.all([
      supabase.from('eval_criteria').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('evaluations').select('*, persons(full_name)').eq('student_id', studentId).order('created_at', { ascending: false }),
      supabase.from('form_templates').select('*').eq('category', 'notice').eq('is_active', true).order('sort_order'),
      supabase.from('form_records').select('*, form_templates(title)').eq('student_id', studentId).order('created_at', { ascending: false }),
    ])
    setCriteria(cr.data || []); setHistory(ev.data || [])
    setNoticeTemplates(nt.data || []); setIssuedNotices((nr.data || []).filter(r => r.form_templates))
    const { data: st } = await supabase.from('students').select('account_state').eq('id', studentId).maybeSingle()
    setAcctState(st?.account_state || null)
  }
  useEffect(() => { if (studentId) load() }, [studentId])

  async function approveStudent() {
    const { data } = await supabase.rpc('approve_student', { p_student: studentId })
    toast(data || 'تم الاعتماد'); setAcctState('approved')
  }

  async function changeStatus(newStatus) {
    setStatus(newStatus)
    await supabase.from('students').update({ admission_status: newStatus }).eq('id', studentId)
    // إشعار الطالب بتغيير حالته
    const msgs = {
      frozen: 'تم تجميد حسابك مؤقتاً. يرجى مراجعة إدارة السكن.',
      rejected: 'نعتذر، لم يتم قبول طلب تسجيلك.',
      accepted: 'تهانينا! تم قبول طلبك في السكن.',
      active: 'تم تفعيل حسابك. مرحباً بك.',
      interview: 'تمت دعوتك لإجراء مقابلة. ستصلك التفاصيل قريباً.',
      pending: 'طلبك قيد المراجعة حالياً.',
    }
    if (msgs[newStatus]) {
      await supabase.from('notifications').insert({
        student_id: studentId, title: 'تحديث حالة حسابك',
        body: msgs[newStatus], kind: (newStatus === 'frozen' || newStatus === 'rejected') ? 'violation' : 'info',
      })
    }
    toast('تم تحديث حالة الطالب: ' + statusLabel(newStatus))
    onStatusChange && onStatusChange(newStatus)
  }

  async function submitEval() {
    async function issueNotice() {
    if (!noticeTpl) { toast('اختر نوع الإشعار', 'error'); return }
    const { data: au } = await supabase.auth.getUser()
    let pid = null
    if (au?.user) { const { data: p } = await supabase.from('persons').select('id').eq('auth_user_id', au.user.id).maybeSingle(); pid = p?.id }
    const tpl = noticeTemplates.find(t => t.id === noticeTpl)
    await supabase.from('form_records').insert({ template_id: noticeTpl, student_id: studentId, status: 'submitted', issued_by: pid, note: noticeText })
    await supabase.from('notifications').insert({ student_id: studentId, title: tpl?.title || 'إشعار إداري', body: noticeText || tpl?.title, kind: 'warning' })
    toast('تم إصدار الإشعار للطالب'); setNoticeTpl(''); setNoticeText(''); load()
  }

  const total = criteria.reduce((s, c) => s + (Number(scores[c.id]) || 0), 0)
    const maxTotal = criteria.reduce((s, c) => s + c.max_score, 0)
    const { data: au } = await supabase.auth.getUser()
    let pid = null
    if (au?.user) { const { data: p } = await supabase.from('persons').select('id').eq('auth_user_id', au.user.id).maybeSingle(); pid = p?.id }
    const { data: ev } = await supabase.from('evaluations').insert({
      student_id: studentId, eval_type: evalType, evaluator: pid,
      total_score: total, max_total: maxTotal, notes,
    }).select().single()
    if (ev) {
      const rows = criteria.map(c => ({ evaluation_id: ev.id, criteria_id: c.id, score: Number(scores[c.id]) || 0 }))
      await supabase.from('evaluation_scores').insert(rows)
    }
    setScores({}); setNotes(''); setShowForm(false); toast('تم حفظ التقييم'); load()
  }

  async function issueNotice() {
    if (!noticeTpl) { toast('اختر نوع الإشعار', 'error'); return }
    const { data: au } = await supabase.auth.getUser()
    let pid = null
    if (au?.user) { const { data: p } = await supabase.from('persons').select('id').eq('auth_user_id', au.user.id).maybeSingle(); pid = p?.id }
    const tpl = noticeTemplates.find(t => t.id === noticeTpl)
    await supabase.from('form_records').insert({ template_id: noticeTpl, student_id: studentId, status: 'submitted', issued_by: pid, note: noticeText })
    await supabase.from('notifications').insert({ student_id: studentId, title: tpl?.title || 'إشعار إداري', body: noticeText || tpl?.title, kind: 'warning' })
    toast('تم إصدار الإشعار للطالب'); setNoticeTpl(''); setNoticeText(''); load()
  }

  const total = criteria.reduce((s, c) => s + (Number(scores[c.id]) || 0), 0)
  const maxTotal = criteria.reduce((s, c) => s + c.max_score, 0)
  const pct = maxTotal ? Math.round(total / maxTotal * 100) : 0

  return (
    <div>
      {/* دورة حياة الحساب */}
      <div className="panel">
        <h3>حالة الحساب</h3>
        <div className="acct-state-row">
          <span className={'acct-state-badge st-' + (acctState || 'pending_data')}>
            {{ pending_data: '📝 يكمل بياناته', pending_approval: '⏳ بانتظار الاعتماد', approved: '✍️ معتمد (يوقّع النماذج)', active: '✅ حساب مكتمل' }[acctState] || '—'}
          </span>
          {acctState === 'pending_approval' && <button className="save-btn" style={{ width: 'auto', padding: '9px 20px' }} onClick={approveStudent}>اعتماد الطالب</button>}
        </div>
        {acctState === 'pending_approval' && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>الطالب أكمل بياناته ورفع طلب الاعتماد. بعد الاعتماد سيُطلب منه التوقيع على النماذج.</p>}
      </div>

      {/* حالة القبول */}
      <div className="panel">
        <h3>حالة الطالب</h3>
        <div className="status-pills">
          {STATUS.map(([v, l]) => (
            <button key={v} className={'status-pill' + (status === v ? ' on status-' + v : '')} onClick={() => changeStatus(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* التقييم */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3>التقييمات</h3>
          {!showForm && <button className="mini" onClick={() => setShowForm(true)}>+ تقييم جديد</button>}
        </div>

        {showForm && (
          <div className="eval-form">
            <div className="field"><label>نوع التقييم</label>
              <select value={evalType} onChange={e => setEvalType(e.target.value)}>
                <option value="interview">مقابلة قبول</option>
                <option value="annual">تقييم سنوي</option>
              </select></div>
            {criteria.map(c => (
              <div key={c.id} className="eval-crit">
                <span className="eval-crit-name">{c.name}</span>
                <div className="eval-crit-score">
                  <input type="range" min={0} max={c.max_score} value={scores[c.id] || 0}
                    onChange={e => setScores({ ...scores, [c.id]: e.target.value })} />
                  <span className="eval-crit-val">{scores[c.id] || 0}/{c.max_score}</span>
                </div>
              </div>
            ))}
            <div className="eval-total">المجموع: <strong>{total} / {maxTotal}</strong> ({pct}%)</div>
            <div className="field"><label>ملاحظات</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="save-btn" style={{ width: 'auto', padding: '10px 22px' }} onClick={submitEval}>حفظ التقييم</button>
              <button className="mini" onClick={() => setShowForm(false)}>إلغاء</button>
            </div>
          </div>
        )}

        {/* سجل التقييمات */}
        {history.map(h => (
          <div key={h.id} className="eval-hist">
            <div className="eval-hist-head">
              <span className="pill">{h.eval_type === 'annual' ? 'تقييم سنوي' : 'مقابلة'}</span>
              <strong>{h.total_score} / {h.max_total}</strong>
              <span className="muted">{new Date(h.created_at).toLocaleDateString('ar')} · {h.persons?.full_name || ''}</span>
            </div>
            {h.notes && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{h.notes}</p>}
          </div>
        ))}
        {history.length === 0 && !showForm && <div className="muted" style={{ fontSize: 13 }}>لا تقييمات بعد.</div>}
      </div>

      {/* إصدار إشعار إداري */}
      {noticeTemplates.length > 0 && (
        <div className="panel">
          <h3>إصدار إشعار إداري</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>لفت نظر، إنذار، إخلاء، أو إذن دخول — يصل الطالب فوراً.</p>
          <div className="field"><label>نوع الإشعار</label>
            <select value={noticeTpl} onChange={e => setNoticeTpl(e.target.value)}>
              <option value="">اختر…</option>
              {noticeTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select></div>
          <div className="field"><label>تفاصيل / سبب الإشعار</label>
            <textarea rows={3} value={noticeText} onChange={e => setNoticeText(e.target.value)} placeholder="تفاصيل المخالفة أو سبب الإشعار…" /></div>
          <button className="save-btn" style={{ width: 'auto', padding: '10px 22px' }} onClick={issueNotice}>إصدار الإشعار</button>

          {issuedNotices.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 14, marginBottom: 8 }}>إشعارات سابقة</h4>
              {issuedNotices.map(n => (
                <div key={n.id} className="eval-hist">
                  <div className="eval-hist-head">
                    <span className="pill">{n.form_templates?.title}</span>
                    <span className="muted">{new Date(n.created_at).toLocaleDateString('ar')}</span>
                  </div>
                  {n.note && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{n.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
