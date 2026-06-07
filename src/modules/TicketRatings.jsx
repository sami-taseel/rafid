import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

// سجل تقييمات البلاغات: كل بلاغ مغلق مع تفاصيل تقييمه
export default function TicketRatings() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // نحدّد دور المستخدم: المدير يرى الكل، المشرف يرى بلاغات نوعه
      const { data: au } = await supabase.auth.getUser()
      let roles = [], admin = false
      if (au?.user) {
        const { data: p } = await supabase.from('persons').select('user_roles(roles(code))').eq('auth_user_id', au.user.id).maybeSingle()
        roles = (p?.user_roles || []).map(ur => ur.roles?.code).filter(Boolean)
        admin = roles.includes('system_admin') || roles.includes('project_manager')
      }
      // البلاغات المغلقة مع نوعها وطالبها
      const { data: tkAll } = await supabase.from('tickets')
        .select('id, title, closed_at, ticket_types(name, handler_role), students(persons(full_name))')
        .eq('status_code', 'closed').order('closed_at', { ascending: false })
      const tickets = (tkAll || []).filter(t => admin || (t.ticket_types?.handler_role && roles.includes(t.ticket_types.handler_role)))
      const ids = tickets.map(t => t.id)
      let answersByTicket = {}
      if (ids.length) {
        const { data: ans } = await supabase.from('ticket_survey_answers')
          .select('ticket_id, answer, ticket_survey_questions(q_text, q_type, sort_order)')
          .in('ticket_id', ids)
        ;(ans || []).forEach(a => {
          if (!answersByTicket[a.ticket_id]) answersByTicket[a.ticket_id] = []
          answersByTicket[a.ticket_id].push(a)
        })
      }
      setRows((tickets || []).map(t => ({ ...t, answers: (answersByTicket[t.id] || []).sort((x,y)=>(x.ticket_survey_questions?.sort_order||0)-(y.ticket_survey_questions?.sort_order||0)) })))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Spinner />

  // متوسط النجوم العام
  const allStars = []
  rows.forEach(t => t.answers.forEach(a => { if (a.ticket_survey_questions?.q_type === 'stars') allStars.push(Number(a.answer)) }))
  const avg = allStars.length ? (allStars.reduce((s,n)=>s+n,0) / allStars.length).toFixed(1) : '—'

  return (
    <div>
      <div className="stats">
        <div className="stat-card"><div className="num">{rows.length}</div><div className="label">بلاغات مقيّمة</div></div>
        <div className="stat-card"><div className="num">{avg} ★</div><div className="label">متوسط الرضا</div></div>
      </div>

      {rows.length === 0 && <div className="panel muted">لا توجد بلاغات مغلقة ومقيّمة بعد.</div>}
      {rows.map(t => {
        const stars = t.answers.find(a => a.ticket_survey_questions?.q_type === 'stars')
        return (
          <div className="panel" key={t.id}>
            <div className="rating-head">
              <div>
                <strong>{t.title}</strong>
                <span className="pill" style={{ marginRight: 8 }}>{t.ticket_types?.name}</span>
              </div>
              {stars && <span className="tk-stars big">{'★'.repeat(Number(stars.answer))}{'☆'.repeat(5 - Number(stars.answer))}</span>}
            </div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
              {t.students?.persons?.full_name || 'طالب'} · أُغلق {t.closed_at ? new Date(t.closed_at).toLocaleDateString('ar') : ''}
            </div>
            <div className="rating-details">
              {t.answers.map((a, i) => (
                <div key={i} className="rating-row">
                  <span className="rating-q">{a.ticket_survey_questions?.q_text}</span>
                  <span className="rating-a">
                    {a.ticket_survey_questions?.q_type === 'stars'
                      ? '★'.repeat(Number(a.answer)) + '☆'.repeat(5 - Number(a.answer))
                      : (a.answer || '—')}
                  </span>
                </div>
              ))}
              {t.answers.length === 0 && <span className="muted">لا إجابات.</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
