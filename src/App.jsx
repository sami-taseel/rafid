import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import ResetPassword from './ResetPassword'
import StudentProfile from './StudentProfile'
import Layout from './Layout'
import Students from './modules/Students'
import Tracks from './modules/Tracks'
import Attendance from './modules/Attendance'
import Housing from './modules/Housing'
import Surveys from './modules/Surveys'
import Support from './modules/Support'
import Buildings from './modules/Buildings'
import Stats from './modules/Stats'
import Users from './modules/Users'
import Reports from './modules/Reports'
import Policy from './modules/Policy'
import Fields from './modules/Fields'

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    // كشف رابط استعادة كلمة المرور
    if (window.location.hash.includes('type=recovery')) setRecovery(true)
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: l } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => l.subscription.unsubscribe()
  }, [])

  if (!ready) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>
  if (recovery) return <ResetPassword onDone={() => { setRecovery(false); window.location.hash = '' }} />
  if (!session) return <Login />
  return <RoleRouter session={session} />
}

function RoleRouter({ session }) {
  const [role, setRole] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      try {
        const { data } = await supabase.from('persons')
          .select('id, user_roles(roles(code))').eq('auth_user_id', session.user.id).maybeSingle()
        const codes = (data?.user_roles || []).map(ur => ur.roles?.code)
        setRole(codes.some(c => c && c !== 'student') ? 'staff' : 'student')
      } catch { setRole('student') }
      finally { setChecking(false) }
    }
    check()
  }, [session])

  if (checking) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>
  if (role === 'staff') return <StaffApp />
  return <StudentProfile session={session} />
}

function StaffApp() {
  const [active, setActive] = useState('stats')
  const views = {
    stats: <Stats />, students: <Students />, tracks: <Tracks />, attendance: <Attendance />,
    buildings: <Buildings />, housing: <Housing />, surveys: <Surveys />, support: <Support />, fields: <Fields />, users: <Users />, reports: <Reports />, policy: <Policy />,
  }
  return <Layout active={active} onNavigate={setActive}>{views[active]}</Layout>
}
