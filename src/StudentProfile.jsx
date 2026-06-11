import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useToast } from './Toast'
import Companions from './modules/Companions'
import StudentSurveys from './modules/StudentSurveys'
import { PolicyAcceptance } from './modules/Policy'
import Notifications from './modules/Notifications'
import { LangProvider, useLang } from './i18n/LangContext'
import LangPicker from './i18n/LangPicker'
import StudentHome from './modules/StudentHome'
import StudentCalendar from './modules/StudentCalendar'
import StudentTickets from './modules/StudentTickets'
import StudentAttachments from './modules/StudentAttachments'
import StudentForms from './modules/StudentForms'
import SignaturePad from './modules/SignaturePad'
import { pushSupported, subscribePush, pushStatus } from './push'

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
  const [buildings, setBuildings] = useState([])
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
      // التحقق من رقم الإقامة: 10 أرقام تبدأ بـ 2
      const byKeyCheck = {}
      fields.forEach(f => { if (f.field_key) byKeyCheck[f.field_key] = values[f.id] || '' })
      if (byKeyCheck.residency_no && !/^2\d{9}$/.test(byKeyCheck.residency_no.trim())) {
        setSaving(false); setMsg({ type: 'error', text: 'رقم الإقامة يجب أن يكون ١٠ أرقام ويبدأ بالرقم ٢.' }); return
      }
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
      if ('housing_building' in byKey) studentUpd.housing_building_id = byKey.housing_building || null
      if ('university' in byKey) studentUpd.university = byKey.university
      if ('college' in byKey) studentUpd.college = byKey.college
      if ('major' in byKey) studentUpd.major = byKey.major
      await supabase.from('students').update(studentUpd).eq('id', student.id)

      setMsg({ type: 'ok', text: 'تم حفظ بياناتك بنجاح. شكراً لك.' })
    } catch (err) {
      setMsg({ type: 'error', text: 'تعذّر الحفظ: ' + (err.message || err) })
    } finally { setSaving(false) }
  }
  useEffect(() => { supabase.rpc('active_buildings').then(({ data }) => setBuildings(data || [])) }, [])
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

  // دورة حياة الحساب
  const state = student?.account_state || 'pending_data'
  const isFull = state === 'active'                         // حساب مكتمل (يرى كل شيء)
  const isApproved = state === 'approved' || state === 'active'  // معتمد كطالب
  // التبويبات المتاحة حسب الحالة
  let allTabs = [['home', 'الرئيسية']]
  if (isFull) allTabs.push(['calendar', 'التقويم'], ['surveys', t('surveys')])
  allTabs.push(['tickets', t('tickets')], ['data', t('myData')], ['companions', t('companions')], ['attachments', 'المرفقات'])
  if (isApproved) allTabs.push(['forms', 'النماذج'])
  // إن كان التبويب الحالي غير متاح، نعود للرئيسية
  const tabKeys = allTabs.map(x => x[0])
  const activeTab = tabKeys.includes(tab) ? tab : 'home'

  return (
    <div className="sp-app" dir={isRtl ? "rtl" : "ltr"}>
      <div className="sp-container">
        {/* ترويسة الترحيب */}
        <div className="sp-hero">
          <div className="sp-hero-actions">
            <PushToggle />
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

        {/* لافتة حالة الحساب */}
        <AccountStateBanner state={state} studentId={student?.id} profilePct={pct} onGoTab={setTab} />

        {/* تبويبات */}
        <div className="sp-tabs">
          {allTabs.map(([k, l]) => (
            <button key={k} className={activeTab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {activeTab === 'home' && <StudentHome studentId={student?.id} onGoTab={setTab} />}
        {activeTab === 'calendar' && <StudentCalendar studentId={student?.id} />}
        {activeTab === 'tickets' && <StudentTickets studentId={student?.id} personId={student?.person_id} />}
        {activeTab === 'attachments' && <StudentAttachments studentId={student?.id} />}
        {activeTab === 'forms' && <StudentForms studentId={student?.id} signaturePath={student?.signature_path} />}
        {activeTab === 'companions' && <Companions studentId={student?.id} personId={student?.person_id} />}
        {activeTab === 'surveys' && <StudentSurveys studentId={student?.id} />}
        {tab === 'policy' && <PolicyAcceptance studentId={student?.id} />}
        {activeTab === 'data' && (
          <form onSubmit={handleSave}>
            {sections.map(sec => (
              <div className="sp-card" key={sec}>
                <div className="sp-card-title">{sec}</div>
                {fields.filter(f => (f.section || 'بيانات') === sec).map(f => (
                  <div className="sp-field" key={f.id}>
                    <label>{f.label}{f.required && <span className="req"> *</span>}</label>
                    {f.field_type === 'building_select' ? (
                      <select value={values[f.id] || ''} required={f.required}
                        onChange={e => setValues({ ...values, [f.id]: e.target.value })}>
                        <option value="">اختر العمارة…</option>
                        {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : f.field_type === 'select' ? (
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

function AccountStateBanner({ state, studentId, profilePct, onGoTab }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function submitForApproval() {
    if (profilePct < 100) { toast('أكمل جميع بياناتك أولاً', 'error'); return }
    setBusy(true)
    const { data } = await supabase.rpc('request_approval', { p_student: studentId })
    setBusy(false)
    toast(data || 'تم رفع الطلب'); window.location.reload()
  }

  if (state === 'pending_data') return (
    <div className="acc-banner pending">
      <div className="acc-banner-icon">📝</div>
      <div className="acc-banner-body">
        <strong>أكمل بياناتك لتقديم طلب الاعتماد</strong>
        <p>يرجى إكمال بياناتك ومرفقاتك (وبيانات مرافقيك إن كنت متزوجاً)، ثم ارفع طلب اعتمادك كطالب.</p>
        <div className="acc-banner-actions">
          <button className="mini" onClick={() => onGoTab('data')}>إكمال البيانات</button>
          <button className="mini" onClick={() => onGoTab('attachments')}>رفع المرفقات</button>
          <button className="save-btn" style={{ width: 'auto', padding: '9px 18px' }} onClick={submitForApproval} disabled={busy}>
            {busy ? 'جارٍ…' : 'رفع طلب الاعتماد'}
          </button>
        </div>
      </div>
    </div>
  )
  if (state === 'pending_approval') return (
    <div className="acc-banner waiting">
      <div className="acc-banner-icon">⏳</div>
      <div className="acc-banner-body">
        <strong>طلبك قيد المراجعة</strong>
        <p>تم استلام طلب اعتمادك. سيراجعه المشرف قريباً، وستصلك إشعار عند الاعتماد.</p>
      </div>
    </div>
  )
  if (state === 'approved') return (
    <div className="acc-banner approved" onClick={() => onGoTab('forms')}>
      <div className="acc-banner-icon">✍️</div>
      <div className="acc-banner-body">
        <strong>وافِق على النماذج المطلوبة لإكمال حسابك</strong>
        <p>تم اعتمادك كطالب. يرجى التوقيع على النماذج المطلوبة لتفعيل كامل المنصة (الأنشطة، التقويم، الاستبانات).</p>
        <div className="acc-banner-actions"><button className="mini">الذهاب للنماذج</button></div>
      </div>
    </div>
  )
  return null
}

function PushToggle() {
  // إشعارات الجوال مؤجّلة حالياً (تحتاج إعداد إرسال). الكود جاهز للتفعيل لاحقاً.
  const PUSH_ENABLED = false
  const [status, setStatus] = useState('default')
  useEffect(() => { pushStatus().then(setStatus) }, [])
  if (!PUSH_ENABLED) return null
  if (!pushSupported()) return null
  if (status === 'granted') return null  // مُفعّل بالفعل
  async function enable() {
    const r = await subscribePush()
    if (r.ok) setStatus('granted')
    else if (r.reason === 'denied') setStatus('denied')
  }
  if (status === 'denied') return null
  return (
    <button className="push-toggle" onClick={enable} title="تفعيل إشعارات الجوال">🔔 تفعيل التنبيهات</button>
  )
}
