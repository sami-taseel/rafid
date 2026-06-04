import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function StudentProfile({ session }) {
  const [student, setStudent] = useState(null)
  const [fields, setFields] = useState([])
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const uid = session.user.id
        let { data: p } = await supabase.from('persons').select('*').eq('auth_user_id', uid).maybeSingle()
        if (!p) {
          const { data: np } = await supabase.from('persons')
            .insert({ full_name: '', auth_user_id: uid, email: session.user.email }).select().single()
          p = np
          await supabase.from('students').insert({ person_id: p.id })
        }
        const { data: s } = await supabase.from('students').select('*').eq('person_id', p.id).maybeSingle()
        setStudent(s)

        const { data: fs } = await supabase.from('profile_fields')
          .select('*').eq('is_active', true).order('sort_order')
        setFields(fs || [])

        const { data: vals } = await supabase.from('student_field_values')
          .select('field_id, value').eq('student_id', s.id)
        const vmap = {}
        ;(vals || []).forEach(v => { vmap[v.field_id] = v.value })
        setValues(vmap)
      } catch (err) {
        setMsg({ type: 'error', text: 'تعذّر التحميل: ' + (err.message || err) })
      } finally { setLoading(false) }
    }
    load()
  }, [session])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      const rows = fields.map(f => ({
        student_id: student.id, field_id: f.id, value: values[f.id] || ''
      }))
      const { error } = await supabase.from('student_field_values')
        .upsert(rows, { onConflict: 'student_id,field_id' })
      if (error) throw error
      await supabase.from('students').update({ profile_reviewed: true }).eq('id', student.id)
      setMsg({ type: 'ok', text: 'تم حفظ بياناتك بنجاح. شكراً لك.' })
    } catch (err) {
      setMsg({ type: 'error', text: 'تعذّر الحفظ: ' + (err.message || err) })
    } finally { setSaving(false) }
  }

  async function handleLogout() { await supabase.auth.signOut() }

  if (loading) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>

  const sections = [...new Set(fields.map(f => f.section || 'بيانات'))]

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src="/logo-white.png" alt="تأصيل" className="header-logo" />
          <div className="brand-text"><h1>منصة رافد</h1><span>ملف الطالب</span></div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>خروج</button>
      </header>

      <div className="container narrow">
        <div className="welcome-box">
          مرحباً بك. يمكنك مراجعة بياناتك وتحديثها في أي وقت. الحقول غير إلزامية،
          واملأ ما تستطيع ثم احفظ.
        </div>
        <form onSubmit={handleSave} className="profile-form">
          {sections.map(sec => (
            <div key={sec}>
              <h2 className="section-title">{sec}</h2>
              {fields.filter(f => (f.section || 'بيانات') === sec).map(f => (
                <div className="field" key={f.id}>
                  <label>{f.label}{f.required && <span style={{color:'#c0392b'}}> *</span>}</label>
                  {f.field_type === 'select' ? (
                    <select value={values[f.id] || ''} required={f.required}
                      onChange={e => setValues({ ...values, [f.id]: e.target.value })}>
                      <option value="">اختر…</option>
                      {(Array.isArray(f.options) ? f.options : []).map(o =>
                        <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                      value={values[f.id] || ''} required={f.required}
                      onChange={e => setValues({ ...values, [f.id]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
          ))}
          {msg && <div className={msg.type === 'ok' ? 'save-ok' : 'login-error'}>{msg.text}</div>}
          <button type="submit" disabled={saving} className="save-btn">
            {saving ? 'جارٍ الحفظ…' : 'حفظ البيانات'}
          </button>
        </form>
      </div>
    </div>
  )
}
