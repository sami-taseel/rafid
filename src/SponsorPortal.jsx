import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function SponsorPortal({ session }) {
  const [analytics, setAnalytics] = useState(null)
  const [students, setStudents] = useState([])
  const [trend, setTrend] = useState([])
  const [sponsorName, setSponsorName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [an, det, tr, me] = await Promise.all([
        supabase.rpc('sponsor_analytics'),
        supabase.rpc('sponsor_student_details'),
        supabase.rpc('sponsor_attendance_trend'),
        supabase.from('persons').select('full_name, sponsors(name)').eq('auth_user_id', session.user.id).maybeSingle(),
      ])
      setAnalytics(an.data?.[0] || null)
      setStudents(det.data || [])
      setTrend(tr.data || [])
      setSponsorName(me.data?.sponsors?.name || me.data?.full_name || 'الجهة الداعمة')
      setLoading(false)
    }
    load()
  }, [session])

  async function logout() { await supabase.auth.signOut() }

  if (loading) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>

  // توزيع حالات القبول
  const admMap = {}
  students.forEach(s => { const k = s.admission_status || 'active'; admMap[k] = (admMap[k] || 0) + 1 })
  // توزيع المراحل
  const degMap = {}
  students.forEach(s => { const k = s.degree_level || 'غير محدّد'; degMap[k] = (degMap[k] || 0) + 1 })
  const byDeg = Object.entries(degMap).map(([label, value]) => ({ label, value }))
  const statusLabels = { active: 'نشط', pending: 'قيد المراجعة', interview: 'مقابلة', accepted: 'مقبول', rejected: 'مرفوض', frozen: 'مجمّد' }

  return (
    <div className="sponsor-portal">
      <header className="sp-portal-head">
        <div><img src="/logo.png" alt="رافد" className="sp-portal-logo" /><span className="sp-portal-title">بوابة الجهة الداعمة</span></div>
        <button className="sp-logout" onClick={logout}>خروج</button>
      </header>

      <div className="sp-portal-body">
        <h2 className="sp-greeting">مرحباً، {sponsorName}</h2>
        <p className="muted" style={{ marginBottom: 20 }}>لوحة متابعة الطلاب الذين تكفلهم في منصة رافد.</p>

        {/* مؤشرات رئيسية */}
        {analytics && (
          <div className="sp-kpis">
            <div className="sp-kpi"><div className="sp-kpi-num">{analytics.total}</div><div className="sp-kpi-lbl">الطلاب المكفولون</div></div>
            <div className="sp-kpi"><div className="sp-kpi-num">{analytics.avg_attendance}%</div><div className="sp-kpi-lbl">متوسط الحضور</div></div>
            <div className="sp-kpi"><div className="sp-kpi-num">{analytics.avg_eval}%</div><div className="sp-kpi-lbl">متوسط التقييم</div></div>
            <div className="sp-kpi"><div className="sp-kpi-num">{analytics.total_points}</div><div className="sp-kpi-lbl">مجموع النقاط</div></div>
            <div className="sp-kpi"><div className="sp-kpi-num">{analytics.housed}</div><div className="sp-kpi-lbl">مسكّنون</div></div>
            <div className="sp-kpi"><div className="sp-kpi-num">{analytics.total_support}</div><div className="sp-kpi-lbl">مساعدات مقدّمة</div></div>
          </div>
        )}

        {/* الرسوم */}
        <div className="sp-charts">
          {trend.length > 1 && (
            <div className="sp-chart-card">
              <h3 className="dash-sec">اتجاه الحضور (آخر ٦ أشهر)</h3>
              <SpBars data={trend.map(t => ({ label: t.month.slice(5) + '/' + t.month.slice(2, 4), value: t.rate }))} suffix="%" max={100} color="#2e5496" />
            </div>
          )}
          <div className="sp-chart-card">
            <h3 className="dash-sec">حالات الطلاب</h3>
            <SpDonut segments={Object.entries(admMap).map(([k, v], i) => ({ label: statusLabels[k] || k, value: v, color: ['#1d9e75', '#f5a623', '#2e5496', '#1d7a52', '#c0392b', '#9aa3b2'][i % 6] }))} />
          </div>
          {byDeg.length > 0 && (
            <div className="sp-chart-card">
              <h3 className="dash-sec">المراحل الدراسية</h3>
              <SpBars data={byDeg} color="#6b3fc0" />
            </div>
          )}
        </div>

        {/* بطاقات الطلاب التفصيلية */}
        <h3 className="section-title" style={{ marginTop: 28 }}>تفاصيل الطلاب المكفولين</h3>
        {students.length === 0 && <div className="panel muted">لا يوجد طلاب مرتبطون بجهتكم بعد.</div>}
        <div className="sp-students">
          {students.map(s => (
            <div key={s.student_id} className="sp-student-card">
              <div className="sp-student-top">
                <div className="sp-student-name">{s.full_name}</div>
                <span className={'adm-badge adm-' + (s.admission_status || 'active')}>{statusLabels[s.admission_status] || 'نشط'}</span>
              </div>
              <div className="sp-student-meta">{s.nationality} · {s.degree_level}{s.building_name && ' · ' + s.building_name}</div>
              <div className="sp-student-bar">
                <div className="sp-bar-track"><div className="sp-bar-fill" style={{ width: s.attendance_rate + '%' }}></div></div>
                <span className="sp-bar-val">{s.attendance_rate}% حضور</span>
              </div>
              <div className="sp-student-chips">
                <span className="sp-chip">✓ {s.present} حضور</span>
                <span className="sp-chip">✗ {s.absent} غياب</span>
                <span className="sp-chip gold">⭐ {s.points} نقطة</span>
                {s.last_eval > 0 && <span className="sp-chip blue">📊 تقييم {s.last_eval}%</span>}
                {s.sanctions > 0 && <span className="sp-chip warn">⚠ {s.sanctions} جزاء</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SpBars({ data, color = '#2e5496', suffix = '', max = null }) {
  const mx = max || Math.max(...data.map(d => d.value), 1)
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div key={i} className="bar-row">
          <span className="bar-label">{d.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: (d.value / mx * 100) + '%', background: color }}></div></div>
          <span className="bar-val">{d.value}{suffix}</span>
        </div>
      ))}
    </div>
  )
}

function SpDonut({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <div className="muted" style={{ textAlign: 'center', padding: 20 }}>لا بيانات</div>
  let acc = 0
  const stops = segments.filter(s => s.value > 0).map(s => {
    const start = acc / total * 360; acc += s.value; const end = acc / total * 360
    return `${s.color} ${start}deg ${end}deg`
  }).join(', ')
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
        <div className="donut-hole"><span className="donut-total">{total}</span><span className="donut-lbl">طالب</span></div>
      </div>
      <div className="donut-legend">
        {segments.filter(s => s.value > 0).map((s, i) => (
          <div key={i} className="dl-item"><span className="dl-dot" style={{ background: s.color }}></span>{s.label} ({s.value})</div>
        ))}
      </div>
    </div>
  )
}
