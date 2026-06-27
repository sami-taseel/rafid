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
import ProfileTab from './modules/ProfileTab'
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
  const [profileSub, setProfileSub] = useState(null)   // لتوجيه الطالب لتبويب فرعي محدّد في «ملفي»
  // فحص حيّ: عدد النماذج الإلزامية الظاهرة غير الموقّعة (يحدّد اكتمال الحساب فعلياً)
  const [unsignedVisible, setUnsignedVisible] = useState(null)
  useEffect(() => {
    async function checkVisibleForms() {
      const st = student?.account_state
      if (!student?.id || (st !== 'approved' && st !== 'active')) { setUnsignedVisible(null); return }
      const [tpls, recs] = await Promise.all([
        supabase.from('form_templates').select('id').eq('category', 'approval').eq('required', true).eq('is_active', true),
        supabase.from('form_records').select('template_id, status').eq('student_id', student.id),
      ])
      const approvedIds = new Set((recs.data || []).filter(r => r.status === 'approved').map(r => r.template_id))
      const unsigned = (tpls.data || []).filter(t => !approvedIds.has(t.id))
      setUnsignedVisible(unsigned.length)
      // نزامن حالة الحساب في الخلفية
      supabase.rpc('refresh_account_completion', { p_student: student.id }).then(() => {}, () => {})
    }
    checkVisibleForms()
  }, [student?.id, student?.account_state, tab])

  useEffect(() => {
    async function load() {
      try {
        const uid = session.user.id
        // نجلب كل صفوف الشخص (قد يوجد تكرار) ونختار الأقدم — يتفادى خطأ maybeSingle
        const { data: persons } = await supabase.from('persons').select('*').eq('auth_user_id', uid).order('created_at')
        let p = (persons && persons.length) ? persons[0] : null

        if (!p) {
          // لا يوجد شخص: ننشئه مع صف طالب
          const { data: np, error: npErr } = await supabase.from('persons')
            .insert({ full_name: '', auth_user_id: uid, email: session.user.email }).select().single()
          if (npErr || !np) throw new Error('PERSON_CREATE: ' + (npErr?.message || 'تعذّر إنشاء الحساب'))
          p = np
          await supabase.from('students').insert({ person_id: p.id })
        }

        // نجلب صف الطالب (قد يوجد تكرار) ونختار الأقدم
        let { data: studentRows } = await supabase.from('students').select('*').eq('person_id', p.id).order('created_at')
        let s = (studentRows && studentRows.length) ? studentRows[0] : null

        // إن لم يوجد صف طالب، ننشئه الآن (إصلاح ذاتي)
        if (!s) {
          const { data: ns, error: nsErr } = await supabase.from('students')
            .insert({ person_id: p.id }).select().single()
          if (nsErr || !ns) throw new Error('STUDENT_CREATE: ' + (nsErr?.message || 'تعذّر إنشاء سجل الطالب'))
          s = ns
        }

        setStudent({ ...s, _person: p })

        const { data: fs } = await supabase.from('profile_fields').select('*').eq('is_active', true).order('sort_order')
        setFields(fs || [])

        // s مضمون الآن (غير null) فلا يحدث خطأ reading 'id'
        const { data: vals } = await supabase.from('student_field_values').select('field_id, value').eq('student_id', s.id)
        const vmap = {}; (vals || []).forEach(v => { vmap[v.field_id] = v.value }); setValues(vmap)
      } catch (err) {
        const raw = err.message || String(err)
        let friendly = 'تعذّر تحميل بياناتك. حدّث الصفحة وأعد المحاولة، وإن استمرت المشكلة تواصل مع إدارة السكن.'
        const m = raw.toLowerCase()
        if (m.includes('network') || m.includes('fetch') || m.includes('failed to')) {
          friendly = 'تعذّر الاتصال بالخادم. تأكد من اتصالك بالإنترنت وأعد فتح الصفحة.'
        } else if (m.includes('row-level') || m.includes('policy') || m.includes('permission')) {
          friendly = 'تعذّر التحميل بسبب الصلاحيات. حدّث الصفحة، وإن استمرت المشكلة تواصل مع إدارة السكن.'
        }
        const code = raw.split(':')[0]
        setMsg({ type: 'error', text: friendly, detail: code && code.length < 30 ? code : null })
        console.error('تحميل بيانات الطالب — الخطأ الفعلي:', raw)
      } finally { setLoading(false) }
    }
    load()
  }, [session])

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setMsg(null)
    // حارس: إن لم يُحمّل سجل الطالب بعد، نمنع الحفظ برسالة واضحة
    if (!student?.id) {
      setSaving(false)
      setMsg({ type: 'error', text: 'لم يكتمل تحميل بياناتك بعد. يرجى تحديث الصفحة والمحاولة مجدداً.' })
      return
    }
    try {
      // ===== (1) تحقق إجباري دقيق: نُحدّد الحقل الناقص بالاسم =====
      const missing = []
      for (const f of fields) {
        if (!f.required) continue
        const v = (values[f.id] ?? '').toString().trim()
        if (!v) missing.push(f.label)
      }
      if (missing.length) {
        setSaving(false)
        setMsg({ type: 'error', text: missing.length === 1
          ? `يرجى تعبئة الحقل الإلزامي: «${missing[0]}».`
          : `يرجى تعبئة الحقول الإلزامية: ${missing.map(m => `«${m}»`).join('، ')}.` })
        return
      }

      // ===== (2) تحقق رقم الإقامة بالاسم الدقيق =====
      const byKeyCheck = {}
      fields.forEach(f => { if (f.field_key) byKeyCheck[f.field_key] = values[f.id] || '' })
      if (byKeyCheck.residency_no && !/^[1-4]\d{9}$/.test(byKeyCheck.residency_no.trim())) {
        const resField = fields.find(f => f.field_key === 'residency_no')
        setSaving(false)
        setMsg({ type: 'error', text: `«${resField?.label || 'رقم الإقامة'}» غير صحيح: يجب أن يكون ١٠ أرقام بالضبط (يبدأ بـ ١ أو ٢ أو ٣ أو ٤)، دون مسافات أو رموز.` })
        return
      }

      // ===== (3) حفظ قيم الحقول =====
      const rows = fields.map(f => ({ student_id: student.id, field_id: f.id, value: values[f.id] || '' }))
      const { error: vErr } = await supabase.from('student_field_values').upsert(rows, { onConflict: 'student_id,field_id' })
      if (vErr) throw new Error('FIELD_VALUES: ' + vErr.message)

      // ===== (4) تحديث جدول persons (كل عمود على حدة لعزل الخطأ) =====
      const byKey = {}
      fields.forEach(f => { if (f.field_key) byKey[f.field_key] = values[f.id] || null })
      const personUpd = {}
      if ('full_name' in byKey) personUpd.full_name = byKey.full_name
      if ('nationality' in byKey) personUpd.nationality = byKey.nationality
      if ('residency_no' in byKey) personUpd.residency_no = byKey.residency_no
      if ('phone' in byKey) personUpd.phone = byKey.phone
      if ('gender' in byKey) personUpd.gender = byKey.gender
      if (Object.keys(personUpd).length) {
        const { error: pErr } = await supabase.from('persons').update(personUpd).eq('id', student.person_id)
        if (pErr) throw new Error('PERSON: ' + pErr.message)
      }

      // ===== (5) تحديث جدول students =====
      const studentUpd = { profile_reviewed: true }
      if ('degree_level' in byKey) studentUpd.degree_level = byKey.degree_level
      if ('housing_building' in byKey) studentUpd.housing_building_id = byKey.housing_building || null
      if ('university' in byKey) studentUpd.university = byKey.university
      if ('college' in byKey) studentUpd.college = byKey.college
      if ('major' in byKey) studentUpd.major = byKey.major
      const { error: sErr } = await supabase.from('students').update(studentUpd).eq('id', student.id)
      if (sErr) throw new Error('STUDENT: ' + sErr.message)

      setMsg({ type: 'ok', text: 'تم حفظ بياناتك بنجاح. شكراً لك.' })
      if ((student?.account_state || 'pending_data') === 'pending_data') {
        setTimeout(() => window.location.reload(), 800)
      }
    } catch (err) {
      const raw = err.message || String(err)
      const m = raw.toLowerCase()
      let friendly = 'تعذّر حفظ بياناتك. يرجى المحاولة مرة أخرى.'
      // تحديد السبب بدقة
      if (m.includes('row-level security') || m.includes('policy') || m.includes('permission')) {
        friendly = 'تعذّر الحفظ بسبب الصلاحيات. حدّث الصفحة وأعد المحاولة، وإن استمرت المشكلة تواصل مع إدارة السكن.'
      } else if (m.includes('network') || m.includes('fetch') || m.includes('failed to')) {
        friendly = 'تعذّر الاتصال بالخادم. تأكد من اتصالك بالإنترنت وأعد المحاولة.'
      } else if (m.includes('duplicate') || m.includes('unique')) {
        if (m.includes('residency')) friendly = 'رقم الإقامة/الهوية مسجّل لطالب آخر. تأكد من صحته.'
        else friendly = 'بعض البيانات مسجّلة مسبقاً لحساب آخر.'
      } else if (m.includes('invalid input') || m.includes('numeric') || m.includes('integer') || m.includes('type')) {
        friendly = 'إحدى القيم بصيغة غير صحيحة. تأكد من الحقول الرقمية (مثل رقم الإقامة والجوال).'
      } else if (m.includes('null value') || m.includes('not-null') || m.includes('violates not')) {
        friendly = 'هناك حقل إلزامي فارغ في النظام. يرجى تعبئة جميع الحقول المطلوبة.'
      } else if (m.includes('student:') || m.includes('person:') || m.includes('field_values:')) {
        // خطأ في جزء محدّد — نعرض تلميحاً للمكان
        const part = m.includes('student:') ? 'بيانات الملف الأكاديمي' : m.includes('person:') ? 'البيانات الشخصية' : 'حقول النموذج'
        friendly = `تعذّر حفظ ${part}. تأكد من صحة القيم، وإن استمرت المشكلة تواصل مع إدارة السكن.`
      }
      // نُلحق رمز السبب التقني (مختصراً) ليسهل على الإدارة التشخيص
      const code = raw.split(':')[0]
      setMsg({ type: 'error', text: friendly, detail: code && code.length < 30 ? code : null })
      console.error('حفظ بيانات الطالب — الخطأ الفعلي:', raw)
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
  const isApproved = state === 'approved' || state === 'active'  // معتمد كطالب
  // الحساب مكتمل = معتمد + لا نماذج ظاهرة إلزامية غير موقّعة
  // (unsignedVisible = null يعني لم يُفحص بعد؛ نعتبره غير مكتمل احتياطاً حتى يُفحص)
  const isFull = isApproved && unsignedVisible === 0
  // التبويبات المتاحة حسب الحالة
  let allTabs = [['home', 'الرئيسية']]
  if (isFull) allTabs.push(['calendar', 'التقويم'], ['surveys', t('surveys')])
  allTabs.push(['tickets', t('tickets')], ['profile', 'ملفي'])
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
        <AccountStateBanner state={state} studentId={student?.id} profilePct={pct} onGoTab={setTab} goProfile={(s) => { setProfileSub(s); setTab('profile') }} currentTab={activeTab} unsignedVisible={unsignedVisible} />

        {/* تبويبات */}
        <div className="sp-tabs">
          {allTabs.map(([k, l]) => (
            <button key={k} className={activeTab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {l}
              {k === 'profile' && unsignedVisible > 0 && <span className="sp-tab-badge">{unsignedVisible}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'home' && <StudentHome studentId={student?.id} onGoTab={setTab} isFull={isFull} />}
        {activeTab === 'calendar' && <StudentCalendar studentId={student?.id} />}
        {activeTab === 'tickets' && <StudentTickets studentId={student?.id} personId={student?.person_id} />}
        {activeTab === 'surveys' && <StudentSurveys studentId={student?.id} />}
        {tab === 'policy' && <PolicyAcceptance studentId={student?.id} />}
        {activeTab === 'profile' && (
          <ProfileTab studentId={student?.id} personId={student?.person_id}
            isApproved={isApproved} signaturePath={student?.signature_path} unsignedVisible={unsignedVisible}
            initialSub={profileSub} dataForm={
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
            {msg && <div className={msg.type === 'ok' ? 'save-ok' : 'login-error'}>{msg.text}{msg.detail && <span className="err-code"> (رمز: {msg.detail})</span>}</div>}
            <button type="submit" disabled={saving} className="sp-save">
              {saving ? t('saving') : t('save')}
            </button>
            <button type="button" className="download-data-btn" onClick={downloadMyData}>⬇ تنزيل نسخة من بياناتي</button>
          </form>
          } />
        )}
      </div>
    </div>
  )
}

function AccountStateBanner({ state, studentId, profilePct, onGoTab, goProfile, currentTab, unsignedVisible }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState(null)
  const [savingComp, setSavingComp] = useState(false)

  async function loadSteps() {
    if (state !== 'pending_data' || !studentId) return
    const { data } = await supabase.rpc('onboarding_status', { p_student: studentId })
    setSteps(data?.[0] || null)
  }
  // تحديث تلقائي: عند تحميل المكوّن، وكلما عاد الطالب لتبويب الرئيسية
  useEffect(() => { loadSteps() }, [studentId, state, currentTab])

  async function answerCompanions(has) {
    setSavingComp(true)
    await supabase.from('students').update({ has_companions: has }).eq('id', studentId)
    setSavingComp(false)
    await loadSteps()
    if (!has) goProfile('attachments')   // لا مرافقين → المرفقات مباشرة
    else goProfile('companions')          // نعم → المرافقون
  }

  async function submitForApproval() {
    setBusy(true)
    const { data } = await supabase.rpc('request_approval', { p_student: studentId })
    setBusy(false)
    toast(data || 'تم رفع الطلب'); window.location.reload()
  }

  if (state === 'pending_data') {
    const s = steps || {}
    const ready = s.ready
    // الخطوات بالترتيب
    return (
      <div className="onboard-card">
        <div className="onboard-title">📋 خطوات تفعيل حسابك</div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>أكمل الخطوات التالية بالترتيب لرفع طلب اعتمادك كطالب.</p>

        {/* الخطوة 1: البيانات */}
        <div className={'onboard-step' + (s.fields_done ? ' done' : ' active')}>
          <div className="onboard-step-ic">{s.fields_done ? '✓' : '1'}</div>
          <div className="onboard-step-body">
            <strong>إكمال بياناتي</strong>
            <p>أجب على جميع الأسئلة الإلزامية في صفحة بياناتي.</p>
            {!s.fields_done && <button className="mini" onClick={() => goProfile('data')}>إكمال البيانات</button>}
          </div>
        </div>

        {/* الخطوة 2: سؤال المرافقين (يظهر بعد إكمال البيانات) */}
        <div className={'onboard-step' + (!s.fields_done ? ' locked' : s.companions_answered ? ' done' : ' active')}>
          <div className="onboard-step-ic">{s.companions_answered ? '✓' : '2'}</div>
          <div className="onboard-step-body">
            <strong>المرافقون</strong>
            {!s.fields_done ? <p>تظهر بعد إكمال بياناتك.</p> : !s.companions_answered ? (
              <>
                <p>هل لديك مرافقون (زوجة/أبناء…)؟</p>
                <div className="onboard-yesno">
                  <button className="save-btn" style={{ width: 'auto', padding: '8px 22px' }} onClick={() => answerCompanions(true)} disabled={savingComp}>نعم</button>
                  <button className="mini" onClick={() => answerCompanions(false)} disabled={savingComp}>لا</button>
                </div>
              </>
            ) : s.has_companions ? (
              <>
                <p>{s.companions_done ? 'تمت إضافة مرافقيك.' : 'أضف مرافقاً واحداً على الأقل.'}</p>
                {!s.companions_done && <button className="mini" onClick={() => goProfile('companions')}>إضافة مرافق</button>}
                {s.companions_done && <button className="mini" onClick={() => goProfile('companions')}>تعديل المرافقين</button>}
              </>
            ) : <p>لا يوجد مرافقون.</p>}
          </div>
        </div>

        {/* الخطوة 3: المرفقات */}
        <div className={'onboard-step' + (!s.companions_answered || !s.companions_done ? ' locked' : s.attachments_done ? ' done' : ' active')}>
          <div className="onboard-step-ic">{s.attachments_done ? '✓' : '3'}</div>
          <div className="onboard-step-body">
            <strong>رفع المرفقات</strong>
            {(!s.companions_answered || !s.companions_done) ? <p>تظهر بعد إكمال الخطوات السابقة.</p> : (
              <>
                <p>ارفع جميع المرفقات الإلزامية{s.has_companions ? ' (لك ولمرافقيك)' : ''}.</p>
                {!s.attachments_done && <button className="mini" onClick={() => goProfile('attachments')}>رفع المرفقات</button>}
              </>
            )}
          </div>
        </div>

        {/* رفع الطلب */}
        <button className="onboard-submit" onClick={submitForApproval} disabled={!ready || busy}>
          {busy ? 'جارٍ…' : ready ? '✓ رفع طلب الاعتماد' : '🔒 أكمل الخطوات أولاً'}
        </button>
      </div>
    )
  }
  if (state === 'pending_approval') return (
    <div className="acc-banner waiting">
      <div className="acc-banner-icon">⏳</div>
      <div className="acc-banner-body">
        <strong>طلبك قيد المراجعة</strong>
        <p>تم استلام طلب اعتمادك. سيراجعه المشرف قريباً، وستصلك إشعار عند الاعتماد.</p>
      </div>
    </div>
  )
  const isApproved = state === 'approved' || state === 'active'
  if (isApproved && unsignedVisible > 0) return (
    <div className="acc-banner approved" onClick={() => goProfile('forms')}>
      <div className="acc-banner-icon">✍️</div>
      <div className="acc-banner-body">
        <strong>وافِق على النماذج المطلوبة لإكمال حسابك</strong>
        <p>لديك {unsignedVisible} نموذج بحاجة للتوقيع. يرجى التوقيع عليها لتفعيل كامل المنصة.</p>
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
