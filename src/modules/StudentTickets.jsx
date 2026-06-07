import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { uploadTicketFile } from '../ticketUtils'
import Attachment from './Attachment'

export default function StudentTickets({ studentId }) {
  const [view, setView] = useState('list')   // list | new | detail
  const [tickets, setTickets] = useState([])
  const [types, setTypes] = useState([])
  const [statuses, setStatuses] = useState([])
  const [sel, setSel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ratings, setRatings] = useState({})

  async function load() {
    const [tk, ty, st] = await Promise.all([
      supabase.from('tickets').select('*, ticket_types(name)').eq('student_id', studentId).order('updated_at', { ascending: false }),
      supabase.from('ticket_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('ticket_statuses').select('*').order('sort_order'),
    ])
    // نجلب تقييم النجوم لكل بلاغ مغلق
    const closedIds = (tk.data || []).filter(t => t.status_code === 'closed').map(t => t.id)
    let ratingMap = {}
    if (closedIds.length) {
      const { data: ans } = await supabase.from('ticket_survey_answers')
        .select('ticket_id, answer, ticket_survey_questions(q_type)').in('ticket_id', closedIds)
      ;(ans || []).forEach(a => { if (a.ticket_survey_questions?.q_type === 'stars') ratingMap[a.ticket_id] = Number(a.answer) })
    }
    setRatings(ratingMap)
    setTickets(tk.data || []); setTypes(ty.data || []); setStatuses(st.data || [])
    setLoading(false)
  }
  useEffect(() => { if (studentId) load() }, [studentId])

  const statusName = (code) => (statuses.find(s => s.code === code) || {}).name || code
  const statusClass = (code) => ({ open: 'open', in_progress: 'prog', resolved: 'done', failed: 'fail', closed: 'closed' }[code] || 'open')

  if (loading) return <div className="state"><div className="spinner"></div>…</div>

  if (view === 'new') return <NewTicket studentId={studentId} types={types} onBack={() => { setView('list'); load() }} />
  if (view === 'detail' && sel) return <TicketDetail ticket={sel} statuses={statuses} onBack={() => { setView('list'); load() }} />

  return (
    <div>
      <button className="sp-save" style={{ marginBottom: 16 }} onClick={() => setView('new')}>+ إنشاء بلاغ جديد</button>
      {tickets.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 30 }}>لا توجد بلاغات. أنشئ بلاغاً عند الحاجة.</div>}
      {tickets.map(t => (
        <div key={t.id} className={"ticket-card" + (t.status_code === "closed" ? " closed-card" : "")} onClick={() => { setSel(t); setView('detail') }}>
          <div className="ticket-card-head">
            <span className="ticket-title">{t.title}</span>
            <span className={'tk-status ' + statusClass(t.status_code)}>{statusName(t.status_code)}</span>
          </div>
          <div className="ticket-meta">
            <span className="pill">{t.ticket_types?.name}</span>
            <span className="muted">{new Date(t.created_at).toLocaleDateString('ar')}</span>
            {t.status_code === 'closed' && ratings[t.id] > 0 && (
              <span className="tk-stars">{'★'.repeat(ratings[t.id])}{'☆'.repeat(5 - ratings[t.id])}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function NewTicket({ studentId, types, onBack }) {
  const [form, setForm] = useState({ type_id: '', title: '', description: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit() {
    if (!form.type_id || !form.title.trim()) { setMsg('اختر النوع واكتب العنوان'); return }
    setBusy(true)
    const { data: tk, error } = await supabase.from('tickets').insert({
      student_id: studentId, type_id: form.type_id, title: form.title, description: form.description, status_code: 'open',
    }).select().single()
    if (error) { setMsg('تعذّر الإرسال: ' + error.message); setBusy(false); return }
    // مرفق اختياري كأول رد
    if (file) {
      try { const path = await uploadTicketFile(tk.id, file)
        await supabase.from('ticket_replies').insert({ ticket_id: tk.id, body: form.description, attachment: path, is_staff: false }) } catch {}
    }
    setBusy(false); onBack()
  }

  return (
    <div>
      <button className="mini" onClick={onBack}>→ رجوع</button>
      <div className="sp-card" style={{ marginTop: 12 }}>
        <div className="sp-card-title">بلاغ جديد</div>
        <div className="field"><label>نوع البلاغ</label>
          <select value={form.type_id} onChange={e => setForm({ ...form, type_id: e.target.value })}>
            <option value="">اختر…</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        <div className="field"><label>عنوان البلاغ</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="عنوان مختصر" /></div>
        <div className="field"><label>وصف البلاغ</label>
          <textarea rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="اشرح بلاغك بالتفصيل" /></div>
        <div className="field"><label>مرفق (اختياري)</label>
          <label className="file-btn">📎 {file ? file.name : 'اختر ملفاً'}
            <input type="file" hidden onChange={e => setFile(e.target.files[0])} /></label></div>
        {msg && <div className="login-error">{msg}</div>}
        <button className="sp-save" onClick={submit} disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'إرسال البلاغ'}</button>
      </div>
    </div>
  )
}

function TicketDetail({ ticket, statuses, onBack }) {
  const [replies, setReplies] = useState([])
  const [reply, setReply] = useState('')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState(ticket.status_code)
  const [surveyQs, setSurveyQs] = useState([])
  const [answers, setAnswers] = useState({})
  const [showSurvey, setShowSurvey] = useState(false)
  const [msg, setMsg] = useState(null)

  async function load() {
    const { data } = await supabase.from('ticket_replies').select('*, persons(full_name)').eq('ticket_id', ticket.id).order('created_at')
    setReplies(data || [])
    const { data: cur } = await supabase.from('tickets').select('status_code').eq('id', ticket.id).single()
    setStatus(cur?.status_code || ticket.status_code)
  }
  useEffect(() => { load() }, [ticket.id])

  const isTerminal = ['resolved', 'failed'].includes(status)

  async function sendReply() {
    if (!reply.trim() && !file) return
    let path = null
    if (file) { try { path = await uploadTicketFile(ticket.id, file) } catch {} }
    await supabase.from('ticket_replies').insert({ ticket_id: ticket.id, body: reply, attachment: path, is_staff: false })
    setReply(''); setFile(null); load()
  }

  async function confirmClose() {
    // نجلب أسئلة الاستبيان
    const { data } = await supabase.from('ticket_survey_questions').select('*').eq('is_active', true).order('sort_order')
    setSurveyQs(data || []); setShowSurvey(true)
  }
  async function submitSurvey() {
    const rows = surveyQs.map(q => ({ ticket_id: ticket.id, question_id: q.id, answer: String(answers[q.id] ?? '') }))
    if (rows.length) await supabase.from('ticket_survey_answers').insert(rows)
    await supabase.from('tickets').update({ status_code: 'closed', closed_at: new Date().toISOString() }).eq('id', ticket.id)
    setMsg('تم إغلاق البلاغ. شكراً لك.'); setShowSurvey(false); setTimeout(onBack, 1200)
  }

  const statusName = (code) => (statuses.find(s => s.code === code) || {}).name || code

  return (
    <div>
      <button className="mini" onClick={onBack}>→ رجوع للبلاغات</button>
      <div className="sp-card" style={{ marginTop: 12 }}>
        <div className="ticket-detail-head">
          <h3>{ticket.title}</h3>
          <span className={'tk-status ' + ({ open:'open',in_progress:'prog',resolved:'done',failed:'fail',closed:'closed' }[status]||'open')}>{statusName(status)}</span>
        </div>
        <p className="muted">{ticket.description}</p>
      </div>

      <div className="sp-card">
        <div className="sp-card-title">المحادثة</div>
        <div className="chat">
          {replies.map(r => (
            <div key={r.id} className={'chat-msg ' + (r.is_staff ? 'staff' : 'me')}>
              <div className="chat-author">{r.is_staff ? (r.persons?.full_name || 'المشرف') : 'أنا'}</div>
              {r.body && <div className="chat-body">{r.body}</div>}
              {r.attachment && <div style={{ marginTop: 6 }}><Attachment path={r.attachment} /></div>}
              {r.status_set && <div className="chat-status">الحالة: {statusName(r.status_set)}</div>}
            </div>
          ))}
          {replies.length === 0 && <div className="muted">لا ردود بعد.</div>}
        </div>

        {status !== 'closed' && (
          <div className="reply-box">
            <textarea rows={3} value={reply} onChange={e => setReply(e.target.value)} placeholder="اكتب رداً…" />
            <div className="reply-actions">
              <label className="file-btn">📎 {file ? 'ملف مرفق' : 'إرفاق ملف'}
                <input type="file" hidden onChange={e => setFile(e.target.files[0])} /></label>
              {file && <span className="muted" style={{ fontSize: 12 }}>{file.name}</span>}
              <button className="save-btn" style={{ width: 'auto', padding: '10px 22px' }} onClick={sendReply}>إرسال</button>
            </div>
          </div>
        )}
      </div>

      {isTerminal && status !== 'closed' && (
        <div className="sp-card close-confirm">
          <p>المشرف وضع البلاغ على «{statusName(status)}». لإغلاق البلاغ نهائياً، يرجى تأكيدك وتعبئة استبيان قصير.</p>
          <button className="sp-save" onClick={confirmClose}>تأكيد إغلاق البلاغ</button>
        </div>
      )}

      {showSurvey && (
        <div className="modal-overlay" onClick={() => setShowSurvey(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-head"><h2>استبيان إغلاق البلاغ</h2><button className="icon-btn" onClick={() => setShowSurvey(false)}>✕</button></div>
            {surveyQs.map((q, i) => (
              <div className="field" key={q.id}>
                <label>{i+1}. {q.q_text}</label>
                {q.q_type === 'stars' ? (
                  <div className="stars">{[1,2,3,4,5].map(n => <span key={n} className={(answers[q.id]||0)>=n?'star on':'star'} onClick={() => setAnswers({ ...answers, [q.id]: n })}>★</span>)}</div>
                ) : q.q_type === 'yesno' ? (
                  <select value={answers[q.id]||''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}><option value="">اختر…</option><option value="نعم">نعم</option><option value="لا">لا</option></select>
                ) : q.q_type === 'likert' ? (
                  <div className="likert">{['راضٍ جداً','راضٍ','محايد','غير راضٍ'].map(o => <button type="button" key={o} className={answers[q.id]===o?'lk sel':'lk'} onClick={() => setAnswers({ ...answers, [q.id]: o })}>{o}</button>)}</div>
                ) : (
                  <textarea rows={2} value={answers[q.id]||''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} />
                )}
              </div>
            ))}
            <button className="sp-save" onClick={submitSurvey}>إنهاء وإغلاق البلاغ</button>
          </div>
        </div>
      )}
      {msg && <div className="save-ok">{msg}</div>}
    </div>
  )
}
