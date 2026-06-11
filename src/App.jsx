import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import ResetPassword from './ResetPassword'
import CheckIn from './CheckIn'
import StudentProfile from './StudentProfile'
import SponsorPortal from './SponsorPortal'
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
import Calendar from './modules/Calendar'
import Sponsor from './modules/Sponsor'
import AuditLog from './modules/AuditLog'
import Languages from './modules/Languages'
import Categories from './modules/Categories'
import TicketsAdmin from './modules/TicketsAdmin'
import TicketsStaff from './modules/TicketsStaff'
import TicketRatings from './modules/TicketRatings'
import SystemStatus from './modules/SystemStatus'
import SupervisorMetrics from './modules/SupervisorMetrics'
import SponsorsAdmin from './modules/SponsorsAdmin'
import Help from './modules/Help'
import Fields from './modules/Fields'
import TabGroup from './modules/TabGroup'
import MyAccount from './modules/MyAccount'
import AttachmentTypes from './modules/AttachmentTypes'
import EvalCriteria from './modules/EvalCriteria'
import FormsAdmin from './modules/FormsAdmin'
import FormRecords from './modules/FormRecords'
import { registerSW } from './push'

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [checkin, setCheckin] = useState(null)
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    // كشف رابط استعادة كلمة المرور
    if (window.location.hash.includes('type=recovery')) setRecovery(true)
    const ci = window.location.hash.match(/checkin=([\w-]+)/)
    if (ci) setCheckin(ci[1])
    registerSW()  // تفعيل وضع عدم الاتصال والإشعارات
    const goOnline = () => setOffline(false), goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: l } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_IN' && s?.user) {
        // نسجّل الدخول في سجل الدخول (لأمان الحساب)
        supabase.from('login_history').insert({ user_id: s.user.id, user_agent: navigator.userAgent }).then(() => {})
      }
    })
    return () => { l.subscription.unsubscribe(); window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  if (!ready) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>
  const offlineBar = offline ? <div className="offline-bar">📡 أنت غير متصل بالإنترنت — تُعرض آخر البيانات المحفوظة</div> : null
  if (recovery) return <ResetPassword onDone={() => { setRecovery(false); window.location.hash = '' }} />
  if (checkin && session) return <CheckIn sessionId={checkin} onDone={() => { setCheckin(null); window.location.hash = '' }} />
  if (!session) return <Login />
  return <>{offlineBar}<RoleRouter session={session} /></>
}

function RoleRouter({ session }) {
  const [role, setRole] = useState(null)
  const [frozen, setFrozen] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      try {
        const { data } = await supabase.from('persons')
          .select('id, user_roles(roles(code))').eq('auth_user_id', session.user.id).maybeSingle()
        const codes = (data?.user_roles || []).map(ur => ur.roles?.code)
        if (codes.includes('sponsor')) setRole('sponsor')
        else if (codes.some(c => c && c !== 'student')) setRole('staff')
        else {
          setRole('student')
          // فحص حالة قبول الطالب: المجمّد/المرفوض يُمنع
          if (data?.id) {
            const { data: st } = await supabase.from('students').select('admission_status').eq('person_id', data.id).maybeSingle()
            if (st && (st.admission_status === 'frozen' || st.admission_status === 'rejected')) setFrozen(st.admission_status)
          }
        }
      } catch { setRole('student') }
      finally { setChecking(false) }
    }
    check()
  }, [session])

  async function logout() { await supabase.auth.signOut() }

  if (checking) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>
  if (role === 'student' && frozen) return (
    <div className="state" style={{ flexDirection: 'column', gap: 16, padding: 40, textAlign: 'center', minHeight: '100vh' }}>
      <div style={{ fontSize: 48 }}>{frozen === 'rejected' ? '🚫' : '⏸️'}</div>
      <h2 style={{ color: '#1f3864' }}>{frozen === 'rejected' ? 'لم يتم قبول طلبك' : 'حسابك مجمّد حالياً'}</h2>
      <p className="muted" style={{ maxWidth: 360 }}>
        {frozen === 'rejected'
          ? 'نعتذر، لم يتم قبول طلب التسجيل. يمكنك التواصل مع إدارة السكن لمزيد من المعلومات.'
          : 'تم تجميد حسابك مؤقتاً. يرجى مراجعة إدارة السكن لإعادة التفعيل.'}
      </p>
      <button className="save-btn" style={{ width: 'auto', padding: '11px 28px' }} onClick={logout}>تسجيل الخروج</button>
    </div>
  )
  if (role === 'sponsor') return <SponsorPortal session={session} />
  if (role === 'staff') return <StaffApp />
  return <StudentProfile session={session} />
}

function StaffApp() {
  const [active, setActive] = useState('stats')
  const views = {
    stats: <Stats onNavigate={setActive} />, students: <Students />, tracks: <Tracks />, attendance: <Attendance />,
    // مجموعات مدموجة بتبويبات داخلية
    tickets: <TabGroup tabs={[
      { key: 'process', label: 'البلاغات', el: <TicketsStaff /> },
      { key: 'setup', label: 'الإعداد', el: <TicketsAdmin /> },
      { key: 'ratings', label: 'التقييمات', el: <TicketRatings /> },
      { key: 'metrics', label: 'أداء المشرفين', el: <SupervisorMetrics /> },
    ]} />,
    students: <TabGroup tabs={[
      { key: 'list', label: 'قائمة الطلاب', el: <Students /> },
      { key: 'fields', label: 'حقول النموذج', el: <Fields /> },
      { key: 'attachments', label: 'المرفقات المطلوبة', el: <AttachmentTypes /> },
      { key: 'eval_criteria', label: 'معايير التقييم', el: <EvalCriteria /> },
      { key: 'support', label: 'سجل الدعم', el: <Support /> },
    ]} />,
    activities: <TabGroup tabs={[
      { key: 'acts', label: 'الأنشطة', el: <Tracks /> },
      { key: 'att', label: 'الحضور', el: <Attendance /> },
      { key: 'cal', label: 'التقويم', el: <Calendar /> },
    ]} />,
    housing: <TabGroup tabs={[
      { key: 'buildings', label: 'العمارات والوحدات', el: <Buildings /> },
      { key: 'violations', label: 'المخالفات', el: <Housing /> },
      { key: 'forms', label: 'النماذج والموافقات', el: <FormsAdmin /> },
      { key: 'form_records', label: 'سجلات النماذج', el: <FormRecords /> },
    ]} />,
    reports: <Reports />,
    sponsors: <TabGroup tabs={[
      { key: 'dashboard', label: 'اللوحة التنفيذية', el: <Sponsor /> },
      { key: 'manage', label: 'إدارة الجهات', el: <SponsorsAdmin /> },
    ]} />,
    system: <TabGroup tabs={[
      { key: 'users', label: 'المستخدمون والأدوار', el: <Users /> },
      { key: 'languages', label: 'اللغات', el: <Languages /> },
      { key: 'audit', label: 'سجل العمليات', el: <AuditLog /> },
      { key: 'status', label: 'حالة النظام', el: <SystemStatus /> },
    ]} />,
    surveys: <Surveys />, categories: <Categories />, help: <Help />, account: <MyAccount />,
  }
  return <Layout active={active} onNavigate={setActive}>{views[active]}</Layout>
}
