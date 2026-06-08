import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Companions from './modules/Companions'
import StudentSurveys from './modules/StudentSurveys'
import { PolicyAcceptance } from './modules/Policy'
import Notifications from './modules/Notifications'
import { LangProvider, useLang } from './i18n/LangContext'
import LangPicker from './i18n/LangPicker'
import StudentHome from './modules/StudentHome'
import StudentTickets from './modules/StudentTickets'

export default function StudentProfile(props) {
  return <LangProvider><StudentProfileInner {...props} /></LangProvider>
}

function StudentProfileInner({ session }) {
  const { t, lang, setLang, available, isRtl } = useLang()
  const [student, setStudent] = useState(null)
  const [fields, setFields] = useState([])
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [tab, setTab] = useState('home')

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
        setStudent({ ...s, _person: p })
        const { data: fs } = await supabase.from('profile_fields').select('*').eq('is_active', true).order('sort_order')
        setFields(fs || [])
        const { data: vals } = await supabase.from('student_field_values').select('field_id, value').eq('student_id', s.id)
        const vmap = {}; (vals || []).forEach(v => { vmap[v.field_id] = v.value }); setValues(vmap)
      } catch (err) {
        setMsg({ type: 'error', text: 'تعذّر التحميل: ' + (err.message || err) })
      } finally { setLoading(false) }
    }
    load()
  }, [session])

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setMsg(null)
    try {
      const rows = fields.map(f => ({ student_id: student.id, field_id: f.id, value: values[f.id] || '' }))
      const { error } = await supabase.from('student_field_values').upsert(rows, { onConflict: 'student_id,field_id' })
      if (error) throw error

      // توحيد البيانات: نكتب الحقول الأساسية في الأعمدة المباشرة أيضاً
      // حتى يظهر الطالب في الفلاتر والفئات مثل بقية الطلاب
      const byKey = {}
      fields.forEach(f => { if (f.field_key) byKey[f.field_key] = values[f.id] || null })
      const personUpd = {}
      if ('full_name' in byKey) personUpd.full_name = byKey.full_name
      if ('nationality' in byKey) personUpd.nationality = byKey.nationality
      if ('residency_no' in byKey) personUpd.residency_no = byKey.residency_no
      if ('phone' in byKey) personUpd.phone = byKey.phone
      if ('gender' in byKey) personUpd.gender = byKey.gender
      if (Object.keys(personUpd).length) {
        await supabase.from('persons').update(personUpd).eq('id', student.person_id)
      }
      const studentUpd = { profile_reviewed: true }
      if ('degree_level' in byKey) studentUpd.degree_level = byKey.degree_level
      if ('university' in byKey) studentUpd.university = byKey.university
      if ('college' in byKey) studentUpd.college = byKey.college
      if ('major' in byKey) studentUpd.major = byKey.major
      await supabase.from('students').update(studentUpd).eq('id', student.id)

      setMsg({ type: 'ok', text: 'تم حفظ بياناتك بنجاح. شكراً لك.' })
    } catch (err) {
      setMsg({ type: 'error', text: 'تعذّر الحفظ: ' + (err.message || err) })
    } finally { setSaving(false) }
  }
  async function handleLogout() { await supabase.auth.signOut() }

  async function downloadMyData() {
    const XLSX = await import('xlsx')
    const sid = student?.id
    // نجمع بيانات الطالب من الجداول
    const [att, tickets, surveys, support] = await Promise.all([
      supabase.from('attendance').select('status, sessions(planned_date, title)').eq('student_id', sid),
      supabase.from('tickets').select('title, status_code, created_at').eq('student_id', sid),
      supabase.from('survey_responses').select('survey_id, submitted_at').eq('student_id', sid),
      supabase.from('support_records').select('kind, description, received_at').eq('student_id', sid),
    ])
    const wb = XLSX.utils.book_new()
    // بياناتي
    const myData = fields.map(f => ({ 'الحقل': f.label, 'القيمة': values[f.id] || '' }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(myData), 'بياناتي')
    // الحضور
    const attRows = (att.data || []).map(a => ({ 'الجلسة': a.sessions?.title || '', 'التاريخ': a.sessions?.planned_date || '', 'الحالة': a.status }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attRows.length ? attRows : [{}]), 'الحضور')
    // البلاغات
    const tkRows = (tickets.data || []).map(t => ({ 'العنوان': t.title, 'الحالة': t.status_code, 'التاريخ': t.created_at?.slice(0,10) }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tkRows.length ? tkRows : [{}]), 'بلاغاتي')
    // الدعم
    const spRows = (support.data || []).map(s => ({ 'النوع': s.kind, 'الوصف': s.description, 'التاريخ': s.received_at }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spRows.length ? spRows : [{}]), 'الدعم')
    XLSX.writeFile(wb, 'بياناتي_رافد.xlsx')
  }

  if (loading) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>

  const name = values[fields.find(f => f.field_key === 'full_name')?.id] || student?._person?.full_name || 'طالب'
  const nat = values[fields.find(f => f.field_key === 'nationality')?.id] || ''
  const deg = values[fields.find(f => f.field_key === 'degree_level')?.id] || ''
  const filled = fields.filter(f => values[f.id]?.trim()).length
  const pct = fields.length ? Math.round(filled / fields.length * 100) : 0
  const sections = [...new Set(fields.map(f => f.section || 'بيانات'))]

  return (
    <div className="sp-app" dir={isRtl ? "rtl" : "ltr"}>
      <div className="sp-container">
        {/* ترويسة الترحيب */}
        <div className="sp-hero">
          <div className="sp-hero-actions">
            <Notifications studentId={student?.id} onOpenTicket={() => setTab('tickets')} />
            <LangPicker />
            <button className="sp-logout" onClick={handleLogout}>{t('logout')}</button>
          </div>
          <div className="sp-hero-top">
            <div className="sp-avatar">{name.trim().charAt(0) || '؟'}</div>
            <div>
              <div className="sp-greet">{t('welcome')}، {name.split(' ')[0]}</div>
              <div className="sp-sub">{[deg, nat].filter(Boolean).join(' · ') || 'أكمل بياناتك'}</div>
            </div>
          </div>
          <div className="sp-progress">
            <div className="sp-progress-head"><span>{t('profileComplete')}</span><span>{pct}%</span></div>
            <div className="sp-bar"><div className="sp-fill" style={{ width: pct + '%' }}></div></div>
          </div>
        </div>

        {/* تبويبات */}
        <div className="sp-tabs">
          {[['home','الرئيسية'],['data',t('myData')],['companions',t('companions')],['surveys',t('surveys')],['tickets','البلاغات'],['policy',t('policy')]].map(([k, l]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'home' && <StudentHome studentId={student?.id} onGoTab={setTab} />}
        {tab === 'tickets' && <StudentTickets studentId={student?.id} personId={student?.person_id} />}
        {tab === 'companions' && <Companions studentId={student?.id} personId={student?.person_id} />}
        {tab === 'surveys' && <StudentSurveys studentId={student?.id} />}
        {tab === 'policy' && <PolicyAcceptance studentId={student?.id} />}
        {tab === 'data' && (
          <form onSubmit={handleSave}>
            {sections.map(sec => (
              <div className="sp-card" key={sec}>
                <div className="sp-card-title">{sec}</div>
                {fields.filter(f => (f.section || 'بيانات') === sec).map(f => (
                  <div className="sp-field" key={f.id}>
                    <label>{f.label}{f.required && <span className="req"> *</span>}</label>
                    {f.field_type === 'select' ? (
                      <select value={values[f.id] || ''} required={f.required}
                        onChange={e => setValues({ ...values, [f.id]: e.target.value })}>
                        <option value="">اختر…</option>
                        {(Array.isArray(f.options) ? f.options : []).map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : f.field_type === 'yesno' ? (
                      <select value={values[f.id] || ''} required={f.required}
                        onChange={e => setValues({ ...values, [f.id]: e.target.value })}>
                        <option value="">اختر…</option><option value="نعم">نعم</option><option value="لا">لا</option>
                      </select>
                    ) : f.field_type === 'textarea' ? (
                      <textarea value={values[f.id] || ''} required={f.required} rows={3}
                        onChange={e => setValues({ ...values, [f.id]: e.target.value })} />
                    ) : (
                      <input type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                        value={values[f.id] || ''} required={f.required}
                        dir={f.field_key === 'phone' || f.field_key === 'residency_no' ? 'ltr' : 'rtl'}
                        onChange={e => setValues({ ...values, [f.id]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
            ))}
            {msg && <div className={msg.type === 'ok' ? 'save-ok' : 'login-error'}>{msg.text}</div>}
            <button type="submit" disabled={saving} className="sp-save">
              {saving ? t('saving') : t('save')}
            </button>
            <button type="button" className="download-data-btn" onClick={downloadMyData}>⬇ تنزيل نسخة من بياناتي</button>
          </form>
        )}
      </div>
    </div>
  )
}
