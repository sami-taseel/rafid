import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { uploadTicketFile } from '../ticketUtils'
import { useToast } from '../Toast'
import Attachment from './Attachment'
import Icon from '../Icon'

// مرفقات الطالب: المطلوب منه ومن مرافقيه، مع دعم "مرفق لكل شخص"
export default function StudentAttachments({ studentId }) {
  const [types, setTypes] = useState([])
  const [mine, setMine] = useState([])
  const [companions, setCompanions] = useState([])
  const [building, setBuilding] = useState(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  // فحص نوع الملف: صور أو PDF (مع التحقق بالامتداد احتياطاً لو كان MIME فارغاً)
  function isAllowedFile(file) {
    if (!file) return false
    const t = (file.type || '').toLowerCase()
    const n = (file.name || '').toLowerCase()
    if (t.startsWith('image/') || t === 'application/pdf') return true
    if (/\.(jpg|jpeg|png|webp|gif|heic|pdf)$/.test(n)) return true   // احتياط: بعض الأجهزة لا ترسل النوع
    return false
  }

  const [myName, setMyName] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    const [ty, at, comp, st] = await Promise.all([
      supabase.from('attachment_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('student_attachments').select('*, attachment_types(name)').eq('student_id', studentId),
      supabase.rpc('my_companions', { p_student: studentId }),
      supabase.from('students').select('housing_building_id, buildings(building_type), persons(full_name)').eq('id', studentId).maybeSingle(),
    ])
    setTypes(ty.data || []); setMine(at.data || []); setCompanions(comp.data || [])
    setBuilding(st.data?.buildings?.building_type || null)
    setMyName(st.data?.persons?.full_name || 'أنا')
    setLoading(false)
  }
  useEffect(() => { if (studentId) load() }, [studentId])


  // ترجمة أخطاء الرفع لرسائل واضحة
  function friendlyUploadError(e) {
    const m = (e?.message || '').toLowerCase()
    if (m.includes('row-level security') || m.includes('policy') || m.includes('403') || m.includes('unauthorized'))
      return 'تعذّر الرفع بسبب الصلاحيات. يرجى تحديث الصفحة وإعادة المحاولة، وإن استمرت المشكلة تواصل مع إدارة السكن.'
    if (m.includes('413') || m.includes('large') || m.includes('كبير'))
      return 'حجم الملف كبير. الحد الأقصى ١٠ ميجابايت. جرّب صورة أصغر.'
    if (m.includes('network') || m.includes('fetch') || m.includes('load failed'))
      return 'تعذّر الاتصال. تأكد من الإنترنت وأعد المحاولة.'
    if (m.includes('mime') || m.includes('type'))
      return 'نوع الملف غير مدعوم. ارفع صورة (JPG/PNG) أو PDF.'
    return 'تعذّر رفع الملف. تأكد أنه صورة أو PDF وحجمه أقل من ١٠ ميجابايت، ثم أعد المحاولة.'
  }

  async function uploadTermly(typeId, file, termLabel) {
    if (!file || !termLabel) return
    setErr('')
    if (!isAllowedFile(file)) { const msg = 'يُقبل رفع الصور أو ملفات PDF فقط.'; setErr(msg); toast(msg, 'error'); return }
    setBusy('term_' + typeId)
    try {
      const path = await uploadTicketFile('attach_' + studentId, file)
      const { error } = await supabase.from('student_attachments').insert({ student_id: studentId, type_id: typeId, file_path: path, term_label: termLabel })
      if (error) throw new Error(error.message)
      await load()
    } catch (e) { console.error('upload termly error:', e); const msg = friendlyUploadError(e); setErr(msg); toast(msg, 'error') }
    setBusy(null)
  }
  async function upload(typeId, file, companionId, renewMonths) {
    if (!file) return
    setErr('')
    if (!isAllowedFile(file)) { const msg = 'يُقبل رفع الصور أو ملفات PDF فقط.'; setErr(msg); toast(msg, 'error'); return }
    setBusy(typeId + (companionId || 'self'))
    try {
      const path = await uploadTicketFile('attach_' + studentId, file)
      let expires = null
      if (renewMonths) { const d = new Date(); d.setMonth(d.getMonth() + Number(renewMonths)); expires = d.toISOString().slice(0, 10) }
      const { error } = await supabase.from('student_attachments').insert({
        student_id: studentId, type_id: typeId, companion_id: companionId || null, file_path: path, expires_at: expires,
      })
      if (error) throw new Error(error.message)
      await load()
    } catch (e) { console.error('upload error:', e); const msg = friendlyUploadError(e); setErr(msg); toast(msg, 'error') }
    setBusy(null)
  }
  async function remove(id) {
    await supabase.from('student_attachments').delete().eq('id', id); load()
  }

  const firstName = (n) => (n || '').trim().split(' ')[0] || n
  const personLabel = (c) => firstName(c.full_name) || c.relation || 'مرافق'
  if (loading) return <div className="state"><div className="spinner"></div>…</div>

  const visibleTypes = types.filter(t => {
    if (t.condition === 'families_only') return building === 'families'
    return true
  })
  // المرفقات الفصلية (سجل أكاديمي لكل فصل)
  const termlyTypes = visibleTypes.filter(t => t.is_termly)
  // مرفقات لكل شخص (الطالب + المرافقون)
  const perPersonTypes = visibleTypes.filter(t => t.per_person && !t.is_termly)
  // مرفقات الطالب وحده
  const studentTypes = visibleTypes.filter(t => !t.per_person && !t.is_termly && t.owner_type === 'student')
  // مرفقات المرافق (النوع القديم — يبقى للتوافق)
  const companionTypes = visibleTypes.filter(t => !t.per_person && t.owner_type === 'companion')

  const findUpload = (typeId, companionId) => mine.find(m => m.type_id === typeId && (companionId ? m.companion_id === companionId : !m.companion_id))
  const isExpired = (a) => a?.expires_at && new Date(a.expires_at) < new Date()

  // بطاقة أيقونة رفع لشخص محدّد (ضمن شبكة)
  function UploadTile({ type, label, sublabel, companionId }) {
    const up = findUpload(type.id, companionId)
    const expired = isExpired(up)
    const key = type.id + (companionId || 'self')
    const loading = busy === key
    return (
      <div className={'upload-tile' + (up && !expired ? ' done' : '') + (expired ? ' expired' : '')}>
        <label className="upload-tile-main">
          <div className="upload-tile-icon">
            {loading ? <Icon name="clock" size={18} /> : up && !expired ? <Icon name="check" size={18} /> : expired ? <Icon name="alert" size={18} /> : <Icon name="plus" size={18} />}
          </div>
          <div className="upload-tile-name">{label}</div>
          {sublabel && <div className="upload-tile-sub">{sublabel}</div>}
          <div className="upload-tile-status">{loading ? 'جارٍ…' : up && !expired ? 'مرفوع' : expired ? 'منتهٍ' : 'رفع'}</div>
          <input type="file" accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png" hidden onChange={e => upload(type.id, e.target.files[0], companionId, type.renew_months)} />
        </label>
        {up && (
          <div className="upload-tile-actions">
            <Attachment path={up.file_path} label="عرض" />
            <button className="tile-del-btn" onClick={() => remove(up.id)} title="حذف"><Icon name="trash" size={13} /> حذف</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="st-attach">
      {err && <div className="attach-error">⚠ {err}</div>}
      {/* مرفقات لكل شخص: بطاقة لكل نوع، بداخلها الطالب وكل مرافق */}
      {perPersonTypes.map(t => (
        <div className="sp-card" key={t.id}>
          <div className="sp-card-title">{t.name}{t.required && <span className="req-star">*</span>}</div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>ارفع نسخة لك ولكل مرافق.</p>
          <div className="upload-grid">
            <UploadTile type={t} label={firstName(myName)} sublabel="أنا" companionId={null} />
            {companions.map(c => (
              <UploadTile key={c.id} type={t} label={personLabel(c)} sublabel={c.relation} companionId={c.id} />
            ))}
          </div>
          {companions.length === 0 && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>أضف مرافقيك من تبويب «المرافقون» لرفع مرفقاتهم.</p>}
        </div>
      ))}

      {/* المرفقات الفصلية (السجل الأكاديمي) */}
      {termlyTypes.map(t => <TermlyCard key={t.id} type={t} />)}

      {/* مرفقات الطالب وحده */}
      {studentTypes.length > 0 && (
        <div className="sp-card">
          <div className="sp-card-title">مرفقاتي</div>
          {studentTypes.map(t => (
            <div key={t.id} className="attach-row">
              <div className="attach-info">
                <span className="attach-name">{t.name}{t.required && <span className="req-star">*</span>}</span>
                {t.renew_months && <span className="muted" style={{ fontSize: 12 }}> · يتجدّد كل {t.renew_months} أشهر</span>}
              </div>
              <UploadRowInline type={t} />
            </div>
          ))}
        </div>
      )}

      {/* مرفقات المرافق (النوع القديم) */}
      {companionTypes.length > 0 && companions.length > 0 && (
        <div className="sp-card">
          <div className="sp-card-title">مرفقات المرافقين</div>
          {companions.map(c => (
            <div key={c.id} className="companion-attach">
              <div className="companion-name">{firstName(c.full_name) || c.relation}</div>
              <div className="upload-grid">
                {companionTypes.map(t => <UploadTile key={t.id} type={t} label={t.name} companionId={c.id} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  function TermlyCard({ type }) {
    const records = mine.filter(m => m.type_id === type.id).sort((a, b) => (b.term_label || '').localeCompare(a.term_label || ''))
    const [term, setTerm] = useState('الأول')
    const [year, setYear] = useState(String(new Date().getFullYear()))  // السنة الحالية افتراضياً
    const yearValid = /^\d{4}$/.test(year)

    function doUpload(file) {
      if (!file) return
      if (!yearValid) {
        const msg = 'اكتب السنة بأربعة أرقام (مثل 2026) قبل رفع السجل.'
        setErr(msg); toast(msg, 'error'); return
      }
      uploadTermly(type.id, file, `الفصل ${term} ${year}`)
    }
    return (
      <div className="sp-card">
        <div className="sp-card-title">{type.name}{type.required && <span className="req-star">*</span>}</div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>ارفع سجلك لكل فصل دراسي، مع الاحتفاظ بسجلات الفصول السابقة.</p>

        {records.length > 0 ? (
          <div className="termly-list">
            {records.map(r => (
              <div key={r.id} className="termly-row">
                <span className="termly-term">📄 {r.term_label || 'سجل'}</span>
                <div className="attach-actions">
                  <Attachment path={r.file_path} label="عرض" />
                  <button className="tile-del-btn" onClick={() => remove(r.id)}><Icon name="trash" size={13} /> حذف</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>لا سجلات بعد.</p>}

        <div className="termly-fields">
          <div className="termly-field">
            <label>الفصل الدراسي</label>
            <select value={term} onChange={e => setTerm(e.target.value)}>
              <option value="الأول">الفصل الأول</option>
              <option value="الثاني">الفصل الثاني</option>
              <option value="الصيفي">الفصل الصيفي</option>
            </select>
          </div>
          <div className="termly-field">
            <label>السنة <span className="req-star">*</span></label>
            <input type="number" placeholder="2026" value={year} onChange={e => setYear(e.target.value)}
              className={!yearValid ? 'termly-year-input invalid' : 'termly-year-input'} />
          </div>
        </div>
        {!yearValid && <p className="termly-hint">اكتب السنة أولاً لتفعيل زر الرفع.</p>}
        <label className={'termly-upload-btn' + (yearValid ? '' : ' disabled')}>
          {busy === 'term_' + type.id ? 'جارٍ الرفع…' : <><Icon name="upload" size={16} /> رفع السجل</>}
          {yearValid && <input type="file" accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png" hidden onChange={e => doUpload(e.target.files[0])} />}
        </label>
      </div>
    )
  }

  function UploadRowInline({ type }) {
    const up = findUpload(type.id, null)
    const expired = isExpired(up)
    return (
      <div className="attach-actions">
        {up && !expired && <span className="attach-ok"><Icon name="check" size={13} /> مرفوع</span>}
        {expired && <span className="attach-expired"><Icon name="alert" size={13} /> منتهٍ — حدّثه</span>}
        {up && <Attachment path={up.file_path} label="عرض" />}
        {up && <button className="mini-del" onClick={() => remove(up.id)}>حذف</button>}
        <label className="file-btn">{busy === type.id + 'self' ? 'جارٍ…' : up ? 'استبدال' : 'رفع'}
          <input type="file" accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png" hidden onChange={e => upload(type.id, e.target.files[0], null, type.renew_months)} /></label>
      </div>
    )
  }
}
