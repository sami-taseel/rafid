import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { Spinner } from './Students'

const ROLES = [
  ['system_admin','مدير النظام'],['project_manager','مدير المشروع'],['care_supervisor','مشرف الرعاية'],
  ['housing_supervisor','مشرف السكن'],['edu_supervisor','المشرف التعليمي'],['follow_supervisor','مشرف المتابعة'],
  ['social_supervisor','المشرف الاجتماعي'],['interview_panel','لجنة المقابلة'],
  ['sponsor','جهة داعمة'],
]

export default function Users() {
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('housing_supervisor')

  async function load() {
    const { data } = await supabase.from('users_with_roles').select('*')
    setUsers(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function assign() {
    if (!email.trim()) { toast('اكتب البريد', 'error'); return }
    const { data } = await supabase.rpc('assign_role_by_email', { p_email: email.trim(), p_role_code: role })
    toast(data); setEmail(''); load()
  }
  async function removeRole(personId, code) {
    await supabase.rpc('remove_role_by_person', { p_person: personId, p_role_code: code }); load()
  }

  if (loading) return <Spinner />
  return (
    <div>
      <SecurityCard />
      <div className="panel">
        <h3>تعيين دور لمستخدم</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          المستخدم يجب أن يكون قد سجّل في الموقع ببريده أولاً، ثم تعيّن له الدور هنا.
        </p>
        <div className="form-row">
          <input placeholder="بريد المستخدم" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
          <select value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
          <button onClick={assign}>تعيين</button>
        </div>
      </div>

      <div className="panel">
        <h3>المستخدمون وأدوارهم ({users.length})</h3>
        {users.map(u => (
          <div key={u.person_id} className="user-row">
            <div className="user-info">
              <strong>{u.full_name || u.email}</strong>
              <span className="muted">{u.email}</span>
            </div>
            <div className="user-roles">
              {(u.roles || []).length === 0 && <span className="muted">طالب / بلا دور</span>}
              {(u.roles || []).map((r, i) => (
                <span key={i} className="role-chip">
                  {r}
                  <button onClick={() => removeRole(u.person_id, u.role_codes[i])}>✕</button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SecurityCard() {
  const [history, setHistory] = useState([])
  useEffect(() => {
    async function load() {
      const { data: au } = await supabase.auth.getUser()
      if (!au?.user) return
      const { data } = await supabase.from('login_history')
        .select('user_agent, created_at').eq('user_id', au.user.id)
        .order('created_at', { ascending: false }).limit(5)
      setHistory(data || [])
    }
    load()
  }, [])
  if (history.length === 0) return null
  const last = history[0]
  // كشف جهاز جديد: إن اختلف user_agent لآخر دخول عن سابقه
  const newDevice = history.length > 1 && history[0].user_agent !== history[1].user_agent
  const deviceName = (ua) => {
    if (!ua) return 'جهاز غير معروف'
    if (/iPhone|iPad/i.test(ua)) return 'جهاز Apple'
    if (/Android/i.test(ua)) return 'جهاز Android'
    if (/Windows/i.test(ua)) return 'حاسب Windows'
    if (/Mac/i.test(ua)) return 'حاسب Mac'
    return 'متصفح ويب'
  }
  return (
    <div className="panel security-card">
      <h3>🔒 أمان حسابك</h3>
      {newDevice && <div className="security-alert">⚠️ لاحظنا دخولاً من جهاز جديد. إن لم تكن أنت، غيّر كلمة مرورك.</div>}
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>آخر عمليات الدخول لحسابك:</div>
      {history.map((h, i) => (
        <div key={i} className="login-row-item">
          <span>{deviceName(h.user_agent)}</span>
          <span className="muted">{new Date(h.created_at).toLocaleString('ar')}</span>
        </div>
      ))}
    </div>
  )
}
