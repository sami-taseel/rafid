import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useToast } from '../Toast'

// صفحة معالجة البلاغات للمشرف/المدير
// المدير (system_admin) يرى كل البلاغات. المشرف يرى بلاغات نوعه فقط.
export default function TicketsStaff() {
  const [tickets, setTickets] = useState([])
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [myRoles, setMyRoles] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [sel, setSel] = useState(null)
  const [fStatus, setFStatus] = useState('')

  async function load() {
    const { data: au } = await supabase.auth.getUser()
    let roles = [], admin = false, personId = null
    if (au?.user) {
      const { data: p } = await supabase.from('persons')
        .select('id, user_roles(roles(code))').eq('auth_user_id', au.user.id).maybeSingle()
      personId = p?.id
      roles = (p?.user_roles || []).map(ur => ur.roles?.code).filter(Boolean)
      admin = roles.includes('system_admin') || roles.includes('project_manager')
    }
    setMyRoles(roles); setIsAdmin(admin)

    const { data: st } = await supabase.from('ticket_statuses').select('*').eq('is_active', true).order('sort_order')
    setStatuses(st || [])

    // نجلب البلاغات مع نوعها وطالبها
    const { data: tk } = await supabase.from('tickets')
      .select('*, ticket_types(name, handler_role), students(persons(full_name))')
      .order('updated_at', { ascending: false })

    // المدير يرى الكل، المشرف يرى ما يطابق دوره
    const visible = (tk || []).filter(t => admin || (t.ticket_types?.handler_role && roles.includes(t.ticket_types.handler_role)))
    setTickets(visible)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <Spinner />
  if (sel) return <TicketThread ticket={sel} statuses={statuses} onBack={() => { setSel(null); load() }} />

  const statusName = (code) => statuses.find(s => s.code === code)?.name || code
  const filtered = fStatus ? tickets.filter(t => t.status_code === fStatus) : tickets
  const openCount = tickets.filter(t => !['closed'].includes(t.status_code)).length

  return (
    <div>
      <div className="stats">
        <div className="stat-card"><div className="num">{tickets.length}</div><div className="label">إجمالي البلاغات</div></div>
        <div className="stat-card"><div className="num">{openCount}</div><div className="label">قيد المتابعة</div></div>
        <div className="stat-card"><div className="num">{tickets.filter(t=>t.status_code==='closed').length}</div><div className="label">مغلقة</div></div>
      </div>

      {!isAdmin && <p className="muted" style={{ marginBottom: 12 }}>تعرض البلاغات الموجّهة لدورك فقط.</p>}

      <div className="filter-row" style={{ marginBottom: 14 }}>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {statuses.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 && <div className="panel muted">لا توجد بلاغات.</div>}
      {filtered.map(t => (
        <div key={t.id} className="ticket-card" onClick={() => setSel(t)}>
          <div className="ticket-card-head">
            <span className="ticket-title">{t.title}</span>
            <span className={'tk-status ' + tkClass(t.status_code)}>{statusName(t.status_code)}</span>
          </div>
          <div className="ticket-meta">
            <span className="pill">{t.ticket_types?.name}</span>
            <span className="muted">{t.students?.persons?.full_name || 'طالب'}</span>
            <span className="muted">{new Date(t.created_at).toLocaleDateString('ar')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function TicketThread({ ticket, statuses, onBack }) {
  const [replies, setReplies] = useState([])
  const [body, setBody] = useState('')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState(ticket.status_code)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function load() {
    const { data } = await supabase.from('ticket_replies').select('*, persons(full_name)').eq('ticket_id', ticket.id).order('created_at')
    setReplies(data || [])
  }
  useEffect(() => { load() }, [])

  async function send() {
    if (!body.trim() && !file && status === ticket.status_code) { toast('اكتب رداً أو غيّر الحالة', 'error'); return }
    setBusy(true)
    const { data: au } = await supabase.auth.getUser()
    let personId = null
    if (au?.user) { const { data: p } = await supabase.from('persons').select('id').eq('auth_user_id', au.user.id).maybeSingle(); personId = p?.id }
    let path = null
    if (file) { path = `tickets/${ticket.id}/${Date.now()}_${file.name}`; await supabase.storage.from('student-docs').upload(path, file) }
    const statusChanged = status !== ticket.status_code
    await supabase.from('ticket_replies').insert({
      ticket_id: ticket.id, author: personId, is_staff: true,
      body: body || null, attachment: path, status_set: statusChanged ? status : null,
    })
    if (statusChanged) {
      await supabase.from('tickets').update({ status_code: status, updated_at: new Date().toISOString() }).eq('id', ticket.id)
      // إشعار الطالب
      await supabase.from('notifications').insert({
        student_id: ticket.student_id, title: 'تحديث بلاغك: ' + ticket.title,
        body: 'الحالة الآن: ' + (statuses.find(s => s.code === status)?.name || status), kind: 'info',
      })
    }
    setBody(''); setFile(null); setBusy(false); toast('تم الإرسال'); load()
  }

  const terminalNote = statuses.find(s => s.code === status)?.is_terminal
  return (
    <div>
      <button className="mini" onClick={onBack}>← رجوع للبلاغات</button>
      <div className="ticket-detail-head">
        <h2>{ticket.title}</h2>
        <span className="pill">{ticket.ticket_types?.name}</span>
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>{ticket.description}</p>

      <div className="chat">
        {replies.map(r => (
          <div key={r.id} className={'chat-msg ' + (r.is_staff ? 'staff' : 'me')}>
            <div className="chat-author">{r.is_staff ? (r.persons?.full_name || 'المشرف') : 'الطالب'}</div>
            {r.body && <div className="chat-body">{r.body}</div>}
            {r.attachment && <a className="chat-file" href="#" onClick={async (e) => { e.preventDefault(); const { data } = await supabase.storage.from('student-docs').createSignedUrl(r.attachment, 3600); if (data) window.open(data.signedUrl) }}>📎 عرض المرفق</a>}
            {r.status_set && <div className="chat-status">غُيّرت الحالة إلى: {statuses.find(s => s.code === r.status_set)?.name || r.status_set}</div>}
          </div>
        ))}
        {replies.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>لا ردود بعد.</div>}
      </div>

      <div className="reply-box">
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="اكتب رداً للطالب…" rows={3} />
        <div className="reply-actions">
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {statuses.filter(s => s.code !== 'closed').map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <label className="file-pick">📎 مرفق<input type="file" hidden onChange={e => setFile(e.target.files[0])} /></label>
          {file && <span className="muted" style={{ fontSize: 12 }}>{file.name}</span>}
          <button className="save-btn" style={{ width: 'auto', padding: '10px 20px' }} disabled={busy} onClick={send}>{busy ? 'جارٍ…' : 'إرسال'}</button>
        </div>
        {terminalNote && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>هذه الحالة تتطلب تأكيد الطالب لإغلاق البلاغ نهائياً.</p>}
      </div>
    </div>
  )
}

function tkClass(code) {
  return { open: 'open', in_progress: 'prog', resolved: 'done', failed: 'fail', closed: 'closed' }[code] || 'open'
}
