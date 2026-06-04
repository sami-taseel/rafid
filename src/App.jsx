import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import StudentProfile from './StudentProfile'
import FieldManager from './FieldManager'

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    // نتحقق من وجود جلسة دخول حالية
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    // نستمع لأي تغيّر في حالة الدخول/الخروج
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!authReady) {
    return (
      <div className="state">
        <div className="spinner"></div>
        جارٍ التحميل…
      </div>
    )
  }

  // غير مسجّل دخول → شاشة الدخول
  if (!session) return <Login />

  // مسجّل دخول → نوجّهه حسب دوره
  return <RoleRouter session={session} />
}

// يوجّه المستخدم: الموظف يرى اللوحة، والطالب يرى ملفه
function RoleRouter({ session }) {
  const [role, setRole] = useState(null)   // 'staff' | 'student'
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkRole() {
      try {
        const uid = session.user.id
        // نجلب أدوار هذا المستخدم
        const { data } = await supabase
          .from('persons')
          .select('id, user_roles(roles(code))')
          .eq('auth_user_id', uid)
          .maybeSingle()

        const codes = (data?.user_roles || []).map(ur => ur.roles?.code)
        const isStaff = codes.some(c => c && c !== 'student')
        setRole(isStaff ? 'staff' : 'student')
      } catch {
        setRole('student')   // الافتراضي: طالب
      } finally {
        setChecking(false)
      }
    }
    checkRole()
  }, [session])

  if (checking) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>
  if (role === 'staff') return <Dashboard />
  return <StudentProfile session={session} />
}

function Dashboard() {
  const [showFields, setShowFields] = useState(false)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, degree_level, persons(full_name, nationality, residency_no, phone)')
        if (error) throw error
        setStudents(data || [])
      } catch (err) {
        setError(err.message || String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const total = students.length
  const byDegree = students.reduce((acc, s) => {
    const d = s.degree_level || 'غير محدد'
    acc[d] = (acc[d] || 0) + 1
    return acc
  }, {})
  const nationalities = new Set(
    students.map(s => s.persons?.nationality).filter(Boolean)
  ).size

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src="/logo-white.png" alt="تأصيل" className="header-logo" />
          <div className="brand-text">
            <h1>منصة رافد</h1>
            <span>طلاب المنح الدوليين</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="logout-btn" onClick={() => setShowFields(true)}>أسئلة النموذج</button>
          <button className="logout-btn" onClick={handleLogout}>خروج</button>
        </div>
      </header>

      <div className="container">
        {loading && (
          <div className="state">
            <div className="spinner"></div>
            جارٍ تحميل البيانات…
          </div>
        )}

        {error && (
          <div className="error-box">
            <strong>تعذّر تحميل البيانات.</strong><br />
            <code>{error}</code>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="stats">
              <div className="stat-card">
                <div className="num">{total}</div>
                <div className="label">إجمالي الطلاب</div>
              </div>
              <div className="stat-card">
                <div className="num">{nationalities}</div>
                <div className="label">عدد الجنسيات</div>
              </div>
              {Object.entries(byDegree).map(([deg, n]) => (
                <div className="stat-card" key={deg}>
                  <div className="num">{n}</div>
                  <div className="label">{deg}</div>
                </div>
              ))}
            </div>

            <h2 className="section-title">قائمة الطلاب</h2>

            {/* عرض البطاقات — يظهر على الجوال فقط */}
            <div className="cards-view">
              {students.map((s, i) => {
                const name = s.persons?.full_name || '—'
                const initial = name.trim().charAt(0)
                return (
                  <div className="student-card" key={s.id}>
                    <div className="card-head">
                      <div className="avatar">{initial}</div>
                      <div className="card-name">
                        <div className="name">{name}</div>
                        <div className="degree">{s.degree_level || '—'}</div>
                      </div>
                      {s.persons?.nationality
                        ? <span className="pill">{s.persons.nationality}</span>
                        : <span className="muted">—</span>}
                    </div>
                    <div className="card-body">
                      <span className="muted">الجوال: {s.persons?.phone || '—'}</span>
                      <span className="muted">الإقامة: {s.persons?.residency_no || '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* عرض الجدول — يظهر على الكمبيوتر فقط */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>الاسم</th><th>الجنسية</th>
                    <th>المرحلة</th><th>رقم الإقامة</th><th>الجوال</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id}>
                      <td className="muted">{i + 1}</td>
                      <td>{s.persons?.full_name || '—'}</td>
                      <td>{s.persons?.nationality
                        ? <span className="pill">{s.persons.nationality}</span>
                        : <span className="muted">غير محدد</span>}</td>
                      <td>{s.degree_level || '—'}</td>
                      <td className="muted">{s.persons?.residency_no || '—'}</td>
                      <td className="muted">{s.persons?.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
