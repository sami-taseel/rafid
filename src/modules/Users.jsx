import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

const ROLES = [
  ['system_admin','مدير النظام'],['project_manager','مدير المشروع'],['care_supervisor','مشرف الرعاية'],
  ['housing_supervisor','مشرف السكن'],['edu_supervisor','المشرف التعليمي'],['follow_supervisor','مشرف المتابعة'],
  ['social_supervisor','المشرف الاجتماعي'],['interview_panel','لجنة المقابلة'],
]

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('housing_supervisor')
  const [msg, setMsg] = useState(null)

  async function load() {
    const { data } = await supabase.from('users_with_roles').select('*')
    setUsers(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function assign() {
    if (!email.trim()) { setMsg('اكتب البريد'); return }
    const { data } = await supabase.rpc('assign_role_by_email', { p_email: email.trim(), p_role_code: role })
    setMsg(data); setEmail(''); load()
  }
  async function removeRole(personId, code) {
    await supabase.rpc('remove_role_by_person', { p_person: personId, p_role_code: code }); load()
  }

  if (loading) return <Spinner />
  return (
    <div>
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
        {msg && <div className="save-ok">{msg}</div>}
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
