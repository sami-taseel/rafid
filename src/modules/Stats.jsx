import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function Stats() {
  const [data, setData] = useState(null)
  const [risk, setRisk] = useState([])

  useEffect(() => {
    async function load() {
      const [students, sessions, attendance, sanctions, support, responses, summary] = await Promise.all([
        supabase.from('students').select('id, degree_level, profile_reviewed, persons(nationality)'),
        supabase.from('sessions').select('id, status, planned_date'),
        supabase.from('attendance').select('status'),
        supabase.from('sanctions').select('level, status'),
        supabase.from('support_records').select('kind'),
        supabase.from('survey_responses').select('id'),
        supabase.rpc('students_at_risk'),
      ])
      setData({
        students: students.data || [], sessions: sessions.data || [],
        attendance: attendance.data || [], sanctions: sanctions.data || [],
        support: support.data || [], responses: responses.data || [],
      })
      setRisk(summary.data || [])
    }
    load()
  }, [])

  if (!data) return <Spinner />
  const nats = {}; data.students.forEach(s => { const n = s.persons?.nationality; if (n) nats[n] = (nats[n]||0)+1 })
  const degs = {}; data.students.forEach(s => { const d = s.degree_level || 'غير محدد'; degs[d] = (degs[d]||0)+1 })
  const present = data.attendance.filter(a => a.status === 'present').length
  const absent = data.attendance.filter(a => a.status === 'absent').length
  const attRate = (present + absent) ? Math.round(present / (present + absent) * 100) : 0
  const pendingEvict = data.sanctions.filter(s => s.status === 'pending_review').length
  const incomplete = data.students.filter(s => !s.profile_reviewed).length
  const todaySessions = data.sessions.filter(s => s.planned_date === new Date().toISOString().slice(0,10))

  // مهام المشرف
  const tasks = []
  if (pendingEvict > 0) tasks.push({ icon: '🚨', text: `${pendingEvict} إخلاء معلّق يحتاج مراجعتك`, type: 'urgent' })
  if (incomplete > 0) tasks.push({ icon: '📝', text: `${incomplete} طالب لم يكمل بياناته`, type: 'warn' })
  if (todaySessions.length > 0) tasks.push({ icon: '📅', text: `${todaySessions.length} جلسة مجدولة اليوم`, type: 'info' })
  const highRisk = risk.filter(r => r.risk_level === 'مرتفع').length
  if (highRisk > 0) tasks.push({ icon: '⚠️', text: `${highRisk} طالب معرّض للخطر (حضور متدنٍّ أو جزاءات)`, type: 'urgent' })

  return (
    <div>
      {tasks.length > 0 && (
        <div className="tasks-panel">
          <h3>يحتاج انتباهك</h3>
          {tasks.map((t, i) => <div key={i} className={'task-item ' + t.type}>{t.icon} {t.text}</div>)}
        </div>
      )}

      <div className="stats big">
        <Big num={data.students.length} label="الطلاب" icon="👥" />
        <Big num={data.sessions.length} label="الجلسات" icon="📚" />
        <Big num={attRate + '%'} label="نسبة الحضور" icon="✓" />
        <Big num={data.sanctions.length} label="الجزاءات" icon="⚠️" />
        <Big num={data.support.length} label="الدعم" icon="🎁" />
        <Big num={data.responses.length} label="ردود الاستبانات" icon="📋" />
      </div>

      {risk.length > 0 && (
        <div className="panel">
          <h3>الطلاب المعرّضون للخطر ({risk.length})</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>طلاب يحتاجون متابعة بناءً على الحضور والجزاءات.</p>
          {risk.map(r => (
            <div key={r.student_id} className="risk-row">
              <span className={'risk-badge ' + (r.risk_level === 'مرتفع' ? 'high' : r.risk_level === 'متوسط' ? 'mid' : 'low')}>{r.risk_level}</span>
              <span style={{ flex: 1 }}>{r.full_name}</span>
              <span className="muted">حضور {r.attendance_rate ?? '—'}% · جزاءات {r.sanctions_count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="charts-row">
        <div className="panel"><h3>التوزيع حسب الجنسية</h3><BarList data={nats} /></div>
        <div className="panel"><h3>التوزيع حسب المرحلة</h3><BarList data={degs} /></div>
      </div>
    </div>
  )
}
function Big({ num, label, icon }) {
  return <div className="stat-card big-card"><div className="big-icon">{icon}</div><div className="num">{num}</div><div className="label">{label}</div></div>
}
function BarList({ data }) {
  const max = Math.max(1, ...Object.values(data))
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1])
  return (
    <div className="bar-list">
      {sorted.map(([k, v]) => (
        <div className="bar-item" key={k}>
          <span className="bar-label">{k}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: (v / max * 100) + '%' }}></div></div>
          <span className="bar-val">{v}</span>
        </div>
      ))}
      {sorted.length === 0 && <div className="muted">لا توجد بيانات بعد.</div>}
    </div>
  )
}
