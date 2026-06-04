import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function Stats({ onNavigate }) {
  const [data, setData] = useState(null)
  const [risk, setRisk] = useState([])
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: au } = await supabase.auth.getUser()
      if (au?.user) {
        const { data: p } = await supabase.from('persons').select('full_name').eq('auth_user_id', au.user.id).maybeSingle()
        setUserName(p?.full_name || '')
      }
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
  const today = new Date().toISOString().slice(0,10)
  const todaySessions = data.sessions.filter(s => s.planned_date === today)
  const highRisk = risk.filter(r => r.risk_level === 'مرتفع').length

  const tasks = []
  if (pendingEvict > 0) tasks.push({ icon: '🚨', text: `${pendingEvict} إخلاء معلّق يحتاج مراجعتك`, type: 'urgent', go: 'housing' })
  if (highRisk > 0) tasks.push({ icon: '⚠️', text: `${highRisk} طالب معرّض للخطر`, type: 'urgent', go: null })
  if (incomplete > 0) tasks.push({ icon: '📝', text: `${incomplete} طالب لم يكمل بياناته`, type: 'warn', go: 'students' })
  if (todaySessions.length > 0) tasks.push({ icon: '📅', text: `${todaySessions.length} جلسة مجدولة اليوم`, type: 'info', go: 'calendar' })

  const gregDate = new Date().toLocaleDateString('ar-SA-u-ca-gregory', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  let hijri = ''
  try { hijri = new Date().toLocaleDateString('ar-SA-u-ca-islamic', { year:'numeric', month:'long', day:'numeric' }) } catch {}

  const actions = [
    { label: 'إضافة نشاط', icon: '➕', go: 'tracks' },
    { label: 'رصد الحضور', icon: '✓', go: 'attendance' },
    { label: 'إنشاء استبانة', icon: '📋', go: 'surveys' },
    { label: 'تسجيل دعم', icon: '🎁', go: 'support' },
  ]

  return (
    <div className="dash">
      {/* ترويسة الترحيب */}
      <div className="dash-hero">
        <div>
          <div className="dash-greet">أهلاً{userName ? '، ' + userName.split(' ')[0] : ''} 👋</div>
          <div className="dash-date">{gregDate}{hijri && ' · ' + hijri}</div>
        </div>
        <img src="/logo-white.png" alt="تأصيل" className="dash-logo" />
      </div>

      {/* إجراءات سريعة */}
      <div className="dash-actions">
        {actions.map(a => (
          <button key={a.go} className="dash-action" onClick={() => onNavigate && onNavigate(a.go)}>
            <span className="da-icon">{a.icon}</span>{a.label}
          </button>
        ))}
      </div>

      {/* يحتاج انتباهك */}
      {tasks.length > 0 && (
        <div className="tasks-panel">
          <h3>يحتاج انتباهك</h3>
          {tasks.map((t, i) => (
            <div key={i} className={'task-item ' + t.type + (t.go ? ' clickable' : '')} onClick={() => t.go && onNavigate && onNavigate(t.go)}>
              {t.icon} {t.text}{t.go && <span className="task-arrow">←</span>}
            </div>
          ))}
        </div>
      )}

      {/* المؤشرات الرئيسية */}
      <div className="kpi-row">
        <Kpi num={data.students.length} label="الطلاب" icon="👥" color="blue" />
        <Kpi num={data.sessions.length} label="الجلسات" icon="📚" color="purple" />
        <Kpi num={attRate + '%'} label="نسبة الحضور" icon="✓" color="green" />
        <Kpi num={data.sanctions.length} label="الجزاءات" icon="⚠️" color="red" />
        <Kpi num={data.support.length} label="الدعم" icon="🎁" color="amber" />
        <Kpi num={data.responses.length} label="ردود الاستبانات" icon="📋" color="teal" />
      </div>

      {/* مؤشر الخطر */}
      {risk.length > 0 && (
        <div className="panel">
          <h3>الطلاب المعرّضون للخطر ({risk.length})</h3>
          {risk.slice(0, 6).map(r => (
            <div key={r.student_id} className="risk-row">
              <span className={'risk-badge ' + (r.risk_level === 'مرتفع' ? 'high' : r.risk_level === 'متوسط' ? 'mid' : 'low')}>{r.risk_level}</span>
              <span style={{ flex: 1 }}>{r.full_name}</span>
              <span className="muted">حضور {r.attendance_rate ?? '—'}% · جزاءات {r.sanctions_count}</span>
            </div>
          ))}
        </div>
      )}

      {/* الرسوم */}
      <div className="charts-row">
        <div className="panel"><h3>التوزيع حسب الجنسية</h3><BarList data={nats} /></div>
        <div className="panel"><h3>التوزيع حسب المرحلة</h3><BarList data={degs} /></div>
      </div>
    </div>
  )
}

function Kpi({ num, label, icon, color }) {
  return (
    <div className={'kpi-tile ' + color}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-data"><div className="kpi-n">{num}</div><div className="kpi-l">{label}</div></div>
    </div>
  )
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
