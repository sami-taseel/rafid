import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function Stats() {
  const [data, setData] = useState(null)

  useEffect(() => {
    async function load() {
      const [students, sessions, attendance, sanctions, support, surveys] = await Promise.all([
        supabase.from('students').select('id, degree_level, persons(nationality)'),
        supabase.from('sessions').select('id, status'),
        supabase.from('attendance').select('status'),
        supabase.from('sanctions').select('level, status'),
        supabase.from('support_records').select('kind'),
        supabase.from('survey_responses').select('id'),
      ])
      setData({
        students: students.data || [], sessions: sessions.data || [],
        attendance: attendance.data || [], sanctions: sanctions.data || [],
        support: support.data || [], responses: surveys.data || [],
      })
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

  return (
    <div>
      <div className="stats big">
        <Big num={data.students.length} label="الطلاب" icon="👥" />
        <Big num={data.sessions.length} label="الجلسات" icon="📚" />
        <Big num={attRate + '%'} label="نسبة الحضور" icon="✓" />
        <Big num={data.sanctions.length} label="الجزاءات" icon="⚠️" />
        <Big num={data.support.length} label="سجلات الدعم" icon="🎁" />
        <Big num={data.responses.length} label="ردود الاستبانات" icon="📋" />
      </div>

      {pendingEvict > 0 && (
        <div className="alert-box">⚠️ يوجد {pendingEvict} إخلاء معلّق يحتاج مراجعتك في وحدة السكن.</div>
      )}

      <div className="charts-row">
        <div className="panel">
          <h3>التوزيع حسب الجنسية</h3>
          <BarList data={nats} />
        </div>
        <div className="panel">
          <h3>التوزيع حسب المرحلة</h3>
          <BarList data={degs} />
        </div>
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
