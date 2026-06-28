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
  const [form, setForm] = useState({ name: '', email: '', role: 'housing_supervisor' })
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)  // { email, password } بعد الإنشاء

  async function load() {
    const { data } = await supabase.from('users_with_roles').select('*')
    setUsers(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  // توليد كلمة مرور مؤقتة قوية وسهلة القراءة
  function genPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; const lower = 'abcdefghijkmnpqrstuvwxyz'
    const nums = '23456789'; const all = chars + lower + nums
    let p = chars[Math.floor(Math.random()*chars.length)] + lower[Math.floor(Math.random()*lower.length)] + nums[Math.floor(Math.random()*nums.length)]
    for (let i = 0; i < 6; i++) p += all[Math.floor(Math.random()*all.length)]
    return p
  }

  async function createAccount() {
    if (!form.name.trim()) { toast('اكتب اسم المشرف', 'error'); return }
    if (!form.email.trim()) { toast('اكتب البريد الإلكتروني', 'error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { toast('صيغة البريد غير صحيحة', 'error'); return }
    setBusy(true)
    const tempPw = genPassword()
    const { data, error } = await supabase.rpc('create_supervisor', {
      p_full_name: form.name.trim(), p_email: form.email.trim().toLowerCase(),
      p_role_code: form.role, p_temp_password: tempPw,
    })
    setBusy(false)
    if (error) { toast('تعذّر الإنشاء: ' + error.message, 'error'); return }
    if (data && data.startsWith('تم')) {
      setCreated({ email: form.email.trim().toLowerCase(), password: tempPw, name: form.name.trim() })
      setForm({ name: '', email: '', role: 'housing_supervisor' })
      load()
    } else {
      toast(data || 'تعذّر الإنشاء', 'error')
    }
  }

  async function removeRole(personId, code) {
    await supabase.rpc('remove_role_by_person', { p_person: personId, p_role_code: code }); load()
  }

  function copyCredentials() {
    const txt = `منصة رافد — بيانات الدخول\nالاسم: ${created.name}\nالبريد: ${created.email}\nكلمة المرور المؤقتة: ${created.password}\n\nملاحظة: يُطلب منك تغيير كلمة المرور عند أول دخول.`
    navigator.clipboard?.writeText(txt).then(() => toast('تم نسخ بيانات الدخول', 'success'), () => toast('تعذّر النسخ', 'error'))
  }

  if (loading) return <Spinner />
  return (
    <div>
      <SecurityCard />

      {/* إنشاء حساب مشرف */}
      <div className="panel">
        <div className="cs-head">
          <div className="cs-head-ic">👤</div>
          <div>
            <h3 className="cs-title">إنشاء حساب مشرف</h3>
            <p className="cs-sub">أنشئ حساباً جديداً بكلمة مرور مؤقتة، يُطلب من المشرف تغييرها عند أول دخول.</p>
          </div>
        </div>

        <div className="cs-form">
          <div className="cs-field">
            <label>اسم المشرف</label>
            <input placeholder="الاسم الكامل" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="cs-field">
            <label>الدور</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {ROLES.filter(([c]) => c !== 'sponsor').map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </select>
          </div>
          <div className="cs-field cs-field-wide">
            <label>البريد الإلكتروني</label>
            <input placeholder="supervisor@example.com" value={form.email} dir="ltr"
              onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <button className="cs-create-btn" onClick={createAccount} disabled={busy}>
          {busy ? 'جارٍ الإنشاء…' : '＋ إنشاء الحساب'}
        </button>
      </div>

      {/* بطاقة بيانات الدخول بعد الإنشاء */}
      {created && (
        <div className="panel cs-created">
          <div className="cs-created-head">
            <span className="cs-created-ic">✓</span>
            <h3>تم إنشاء الحساب بنجاح</h3>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
            سلّم هذه البيانات للمشرف. سيُطلب منه تغيير كلمة المرور عند أول دخول.
          </p>
          <div className="cs-cred">
            <div className="cs-cred-row"><span className="cs-cred-lbl">الاسم</span><span className="cs-cred-val">{created.name}</span></div>
            <div className="cs-cred-row"><span className="cs-cred-lbl">البريد</span><span className="cs-cred-val" dir="ltr">{created.email}</span></div>
            <div className="cs-cred-row"><span className="cs-cred-lbl">كلمة المرور المؤقتة</span><span className="cs-cred-val cs-cred-pw" dir="ltr">{created.password}</span></div>
          </div>
          <div className="cs-created-actions">
            <button className="cs-copy-btn" onClick={copyCredentials}>📋 نسخ البيانات</button>
            <button className="cs-dismiss-btn" onClick={() => setCreated(null)}>تم</button>
          </div>
        </div>
      )}

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
