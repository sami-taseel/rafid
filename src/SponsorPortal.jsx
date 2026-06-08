import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// بوابة الجهة الداعمة: مؤشرات مجمّعة للطلاب الذين تكفلهم (بلا بيانات حسّاسة)
export default function SponsorPortal({ session }) {
  const [summary, setSummary] = useState(null)
  const [students, setStudents] = useState([])
  const [sponsorName, setSponsorName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [sum, st, me] = await Promise.all([
        supabase.rpc('sponsor_summary'),
        supabase.rpc('sponsor_students'),
        supabase.from('persons').select('full_name, sponsors(name)').eq('auth_user_id', session.user.id).maybeSingle(),
      ])
      setSummary(sum.data?.[0] || null)
      setStudents(st.data || [])
      setSponsorName(me.data?.sponsors?.name || me.data?.full_name || 'الجهة الداعمة')
      setLoading(false)
    }
    load()
  }, [session])

  async function logout() { await supabase.auth.signOut() }

  if (loading) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>

  return (
    <div className="sponsor-portal">
      <header className="sp-portal-head">
        <div>
          <img src="/logo.png" alt="رافد" className="sp-portal-logo" />
          <span className="sp-portal-title">بوابة الجهة الداعمة</span>
        </div>
        <button className="sp-logout" onClick={logout}>خروج</button>
      </header>

      <div className="sp-portal-body">
        <h2 className="sp-greeting">مرحباً، {sponsorName}</h2>
        <p className="muted" style={{ marginBottom: 20 }}>ملخّص مؤشرات الطلاب الذين تكفلهم في منصة رافد.</p>

        {summary && (
          <div className="sp-kpis">
            <div className="sp-kpi"><div className="sp-kpi-num">{summary.total}</div><div className="sp-kpi-lbl">عدد الطلاب المكفولين</div></div>
            <div className="sp-kpi"><div className="sp-kpi-num">{summary.avg_attendance}%</div><div className="sp-kpi-lbl">متوسط الحضور</div></div>
            <div className="sp-kpi"><div className="sp-kpi-num">{summary.total_support}</div><div className="sp-kpi-lbl">مساعدات مقدّمة</div></div>
          </div>
        )}

        <h3 className="section-title">الطلاب المكفولون</h3>
        {students.length === 0 && <div className="panel muted">لا يوجد طلاب مرتبطون بجهتكم بعد.</div>}
        <div className="sp-students">
          {students.map(s => (
            <div key={s.student_id} className="sp-student-card">
              <div className="sp-student-name">{s.full_name}</div>
              <div className="sp-student-meta">{s.nationality} · {s.degree_level}</div>
              <div className="sp-student-bar">
                <div className="sp-bar-track"><div className="sp-bar-fill" style={{ width: s.attendance_rate + '%' }}></div></div>
                <span className="sp-bar-val">{s.attendance_rate}% حضور</span>
              </div>
              <div className="sp-student-stats">
                <span>✓ {s.present} حضور</span>
                <span>✗ {s.absent} غياب</span>
                {s.sanctions > 0 && <span className="sp-warn">⚠ {s.sanctions} جزاء</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
