import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

// مؤشرات أداء المشرفين: زمن المعالجة، عدد البلاغات، رضا الطلاب
export default function SupervisorMetrics() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')   // all | 30 | 90

  useEffect(() => {
    async function load() {
      // نجلب الردود التي غيّرت الحالة (لمعرفة من عالج)، مع البلاغات وتقييماتها
      const { data: tickets } = await supabase.from('tickets')
        .select('id, status_code, created_at, closed_at, type_id, ticket_types(name, handler_role)')
      const { data: replies } = await supabase.from('ticket_replies')
        .select('ticket_id, author, is_staff, status_set, created_at, persons(full_name)')
        .eq('is_staff', true).not('status_set', 'is', null)
      const { data: answers } = await supabase.from('ticket_survey_answers')
        .select('ticket_id, answer, ticket_survey_questions(q_type)')
      const { data: persons } = await supabase.from('persons')
        .select('id, full_name, user_roles(roles(code, name_ar))')

      // خريطة: من هو المشرف لكل بلاغ (أول من غيّر حالته من الموظفين)
      const cutoff = period === 'all' ? null : new Date(Date.now() - Number(period) * 86400000)
      const handlerByTicket = {}
      ;(replies || []).forEach(r => {
        if (cutoff && new Date(r.created_at) < cutoff) return
        if (!handlerByTicket[r.ticket_id] && r.author) handlerByTicket[r.ticket_id] = { id: r.author, name: r.persons?.full_name }
      })

      // تقييم النجوم لكل بلاغ
      const starByTicket = {}
      ;(answers || []).forEach(a => { if (a.ticket_survey_questions?.q_type === 'stars') starByTicket[a.ticket_id] = Number(a.answer) })

      // نجمّع حسب المشرف
      const agg = {}
      ;(tickets || []).forEach(t => {
        const h = handlerByTicket[t.id]
        if (!h) return
        if (cutoff && new Date(t.created_at) < cutoff) return
        if (!agg[h.id]) agg[h.id] = { name: h.name, handled: 0, closed: 0, totalHours: 0, closedCount: 0, stars: [], }
        const a = agg[h.id]
        a.handled++
        if (t.status_code === 'closed') {
          a.closed++
          if (t.closed_at) { a.totalHours += (new Date(t.closed_at) - new Date(t.created_at)) / 3600000; a.closedCount++ }
        }
        if (starByTicket[t.id]) a.stars.push(starByTicket[t.id])
      })

      const result = Object.entries(agg).map(([id, a]) => ({
        id, name: a.name || 'مشرف',
        handled: a.handled, closed: a.closed,
        avgHours: a.closedCount ? Math.round(a.totalHours / a.closedCount) : null,
        avgStars: a.stars.length ? (a.stars.reduce((s, n) => s + n, 0) / a.stars.length).toFixed(1) : null,
      })).sort((x, y) => y.handled - x.handled)
      setRows(result)
      setLoading(false)
    }
    load()
  }, [period])

  if (loading) return <Spinner />

  const fmtHours = (h) => h == null ? '—' : h < 24 ? h + ' ساعة' : Math.round(h / 24) + ' يوم'

  return (
    <div>
      <div className="metrics-head">
        <p className="muted" style={{ fontSize: 13 }}>مؤشرات أداء المشرفين في معالجة البلاغات. تُعرض كأداة تطوير وتحفيز.</p>
        <select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">كل الفترات</option>
          <option value="30">آخر ٣٠ يوماً</option>
          <option value="90">آخر ٩٠ يوماً</option>
        </select>
      </div>

      {rows.length === 0 && <div className="panel muted">لا توجد بيانات معالجة بعد في هذه الفترة.</div>}

      <div className="metrics-grid">
        {rows.map(r => (
          <div key={r.id} className="metric-card">
            <div className="metric-name">{r.name}</div>
            <div className="metric-stats">
              <div className="metric-stat"><span className="ms-num">{r.handled}</span><span className="ms-lbl">عالجها</span></div>
              <div className="metric-stat"><span className="ms-num">{r.closed}</span><span className="ms-lbl">أُغلقت</span></div>
              <div className="metric-stat"><span className="ms-num">{fmtHours(r.avgHours)}</span><span className="ms-lbl">متوسط المعالجة</span></div>
              <div className="metric-stat"><span className="ms-num">{r.avgStars ? r.avgStars + ' ★' : '—'}</span><span className="ms-lbl">رضا الطلاب</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
