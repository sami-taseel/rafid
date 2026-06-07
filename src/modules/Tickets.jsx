import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useToast } from '../Toast'

// صفحة معالجة البلاغات للموظفين (المدير يرى الكل، المشرف يرى نوعه)
export default function Tickets() {
  const [tickets, setTickets] = useState([])
  const [types, setTypes] = useState([])
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [myRoles, setMyRoles] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [fStatus, setFStatus] = useState('')

  async function loadMeta() {
    const { data: au } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('persons').select('id, user_roles(roles(code))').eq('auth_user_id', au.user.id).maybeSingle()
    const codes = (p?.user_roles || []).map(ur => ur.roles?.code)
    setMyRoles(codes)
    setIsAdmin(codes.includes('system_admin') || codes.includes('project_manager'))
    const [t, s] = await Promise.all([
      supabase.from('ticket_types').select('*'),
      supabase.from('ticket_statuses').select('*').order('sort_order'),
    ])
    setTypes(t.data || []); setStatuses(s.data || [])
    return { codes, admin: codes.includes('system_admin') || codes.includes('project_manager'), types: t.data || [] }
  }

  async function loadTickets(meta) {
    const { data } = await supabase.from('tickets')
      .select('*, ticket_types(name, handler_role), students(persons(full_name))')
      .order('updated_at', { ascending: false })
    let list = data || []
    // المشرف غير المدير: يرى أنواع البلاغات التي هو مسؤول عنها فقط
    if (!meta.admin) {
      list = list.filter(t => t.ticket_types?.handler_role && meta.codes.includes(t.ticket_types.handler_role))
    }
    setTickets(list); setLoading(false)
  }

  useEffect(() => { loadMeta().then(loadTickets) }, [])

  function statusName(code) { return (statuses.find(s => s.code === code) || {}).name || code }

  if (loading) return <Spinner />
  if (sel) return <TicketThread ticketId={sel} statuses={statuses} isStaff onBack={() => { setSel(null); loadMeta().then(loadTickets) }} />

  const filtered = fStatus ? tickets.filter(t => t.status_code === fStatus) : tickets
  const openCount = tickets.filter(t => !['closed'].includes(t.status_code)).length

  return (
    <div>
      <div className="stats">
        <div className="stat-card"><div className="num">{tickets.length}</div><div className="label">إجمالي البلاغات</div></div>
        <div className="stat-card"><div className="num">{openCount}</div><div className="label">غير مغلقة</div></div>
      </div>
      <div className="filter-row" style={{ marginBottom: 14 }}>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {statuses.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
      </div>
      {filtered.length === 0 && <div className="panel muted">لا توجد بلاغات.</div>}
      {filtered.map(t => (
        <div key={t.id} className="ticket-card" onClick={() => setSel(t.id)}>
          <div className="ticket-main">
            <div className="ticket-title">{t.title}</div>
            <div className="ticket-meta">
              <span className="pill">{t.ticket_types?.name}</span>
              <span className="muted">{t.students?.persons?.full_name}</span>
            </div>
          </div>
          <span className={'tk-status s-' + t.status_code}>{statusName(t.status_code)}</span>
        </div>
      ))}
    </div>
  )
}

// خيط محادثة البلاغ (مشترك بين الطالب والموظف)
export function TicketThread({ ticketId, statuses, isStaff, onBack }) {
  const [ticket, setTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [body, setBody] = useState('')
  const [file, setFile] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  async function load() {
    const { data: t } = await supabase.from('tickets').select('*, ticket_types(name), students(person_id, persons(full_name))').eq('id', ticketId).single()
    setTicket(t)
    const { data: r } = await supabase.from('ticket_replies').select('*, persons(full_name)').eq('ticket_id', ticketId).order('created_at')
    setReplies(r || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [ticketId])

  async function send() {
    if (!body.trim() && !file && !newStatus) { toast('اكتب رداً أو غيّر الحالة', 'error'); return }
    const { data: au } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('persons').select('id').eq('auth_user_id', au.user.id).maybeSingle()
    let attachment = null
    if (file) {
      const path = `tickets/${ticketId}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('student-docs').upload(path, file)
      if (!error) attachment = path
    }
    await supabase.from('ticket_replies').insert({
      ticket_id: ticketId, author: p?.id, is_staff: isStaff,
      body: body || null, attachment, status_set: newStatus || null,
    })
    if (newStatus) {
      await supabase.from('tickets').update({ status_code: newStatus, updated_at: new Date().toISOString() }).eq('id', ticketId)
    }
    // إشعار الطالب عند رد الموظف
    if (isStaff && ticket?.students?.person_id) {
      const { data: s } = await supabase.from('students').select('id').eq('person_id', ticket.students.person_id).maybeSingle()
      if (s) await supabase.from('notifications').insert({ student_id: s.id, title: 'رد جديد على بلاغك: ' + ticket.title, body: body || 'تم تحديث حالة البلاغ', kind: 'info' })
    }
    setBody(''); setFile(null); setNewStatus(''); load()
  }

  async function confirmClose(answers) {
    // الطالب يؤكّد الإغلاق ويُجيب الاستبيان
    for (const [qid, val] of Object.entries(answers)) {
      await supabase.from('ticket_survey_answers').insert({ ticket_id: ticketId, question_id: qid, answer: String(val) })
    }
    await supabase.from('tickets').update({ status_code: 'closed', closed_at: new Date().toISOString() }).eq('id', ticketId)
    toast('تم إغلاق البلاغ. شكراً لك.'); load()
  }

  if (loading) return <Spinner />
  const statusName = (code) => (statuses.find(s => s.code === code) || {}).name || code
  const isTerminal = ['resolved', 'failed'].includes(ticket.status_code)

  return (
    <div>
      <button className="mini" onClick={onBack}>→ رجوع</button>
      <div className="thread-head">
        <div>
          <h3>{ticket.title}</h3>
          <span className="pill">{ticket.ticket_types?.name}</span>
          {isStaff && <span className="muted"> · {ticket.students?.persons?.full_name}</span>}
        </div>
        <span className={'tk-status s-' + ticket.status_code}>{statusName(ticket.status_code)}</span>
      </div>

      {ticket.description && <div className="panel"><div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>الوصف</div>{ticket.description}</div>}

      <div className="thread">
        {replies.map(r => (
          <div key={r.id} className={'msg ' + (r.is_staff ? 'staff' : 'student')}>
            <div className="msg-author">{r.persons?.full_name || (r.is_staff ? 'الإدارة' : 'الطالب')}</div>
            {r.body && <div className="msg-body">{r.body}</div>}
            {r.attachment && <a className="msg-file" href="#" onClick={async (e) => { e.preventDefault(); const { data } = await supabase.storage.from('student-docs').createSignedUrl(r.attachment, 3600); if (data) window.open(data.signedUrl) }}>📎 مرفق</a>}
            {r.status_set && <div className="msg-status">غيّر الحالة إلى: {statusName(r.status_set)}</div>}
            <div className="msg-date">{new Date(r.created_at).toLocaleString('ar')}</div>
          </div>
        ))}
        {replies.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>لا ردود بعد</div>}
      </div>

      {/* الطالب: تأكيد الإغلاق عند المعالجة/التعذّر */}
      {!isStaff && isTerminal && <CloseConfirm onConfirm={confirmClose} />}

      {/* صندوق الرد (يخفى للطالب بعد الإغلاق) */}
      {ticket.status_code !== 'closed' && (
        <div className="panel reply-box">
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="اكتب رداً…" rows={3} />
          <div className="reply-actions">
            <label className="mini upload-label">📎 مرفق<input type="file" hidden onChange={e => setFile(e.target.files[0])} /></label>
            {file && <span className="muted" style={{ fontSize: 12 }}>{file.name}</span>}
            {isStaff && (
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                <option value="">تغيير الحالة…</option>
                {statuses.filter(s => s.is_active && s.code !== 'closed').map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            )}
            <button className="save-btn" style={{ width: 'auto', padding: '10px 20px', marginTop: 0 }} onClick={send}>إرسال</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CloseConfirm({ onConfirm }) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [show, setShow] = useState(false)
  useEffect(() => { supabase.from('ticket_survey_questions').select('*').eq('is_active', true).order('sort_order').then(({ data }) => setQuestions(data || [])) }, [])
  if (!show) return (
    <div className="panel close-prompt">
      <p>هل تم حل مشكلتك؟ يمكنك تأكيد إغلاق البلاغ.</p>
      <button className="save-btn" onClick={() => setShow(true)}>تأكيد الإغلاق وتقييم الخدمة</button>
    </div>
  )
  return (
    <div className="panel">
      <h3>تقييم الخدمة قبل الإغلاق</h3>
      {questions.map(q => (
        <div className="field" key={q.id}>
          <label>{q.q_text}</label>
          {q.q_type === 'stars' ? (
            <div className="stars">{[1,2,3,4,5].map(n => <span key={n} className={(answers[q.id]||0)>=n?'star on':'star'} onClick={() => setAnswers({...answers,[q.id]:n})}>★</span>)}</div>
          ) : q.q_type === 'yesno' ? (
            <div className="likert">{['نعم','لا'].map(o => <button key={o} type="button" className={answers[q.id]===o?'lk sel':'lk'} onClick={()=>setAnswers({...answers,[q.id]:o})}>{o}</button>)}</div>
          ) : q.q_type === 'likert' ? (
            <div className="likert">{['راضٍ جداً','راضٍ','محايد','غير راضٍ'].map(o => <button key={o} type="button" className={answers[q.id]===o?'lk sel':'lk'} onClick={()=>setAnswers({...answers,[q.id]:o})}>{o}</button>)}</div>
          ) : (
            <textarea value={answers[q.id]||''} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})} rows={2} />
          )}
        </div>
      ))}
      <button className="save-btn" onClick={() => onConfirm(answers)}>إغلاق البلاغ نهائياً</button>
    </div>
  )
}
