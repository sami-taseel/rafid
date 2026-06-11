import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import SignaturePad from './SignaturePad'

// نماذج الطالب: الموافقات، الطلبات، والإشعارات الموجّهة له
export default function StudentForms({ studentId, signaturePath }) {
  const toast = useToast()
  const [templates, setTemplates] = useState([])
  const [records, setRecords] = useState([])
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)   // النموذج المفتوح
  const [formData, setFormData] = useState({})

  async function load() {
    const [tpl, rec, st] = await Promise.all([
      supabase.from('form_templates').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('form_records').select('*, form_templates(title, category)').eq('student_id', studentId).order('created_at', { ascending: false }),
      supabase.from('students').select('*, persons(full_name, nationality, phone), buildings(name)').eq('id', studentId).maybeSingle(),
    ])
    setTemplates(tpl.data || []); setRecords(rec.data || []); setStudent(st.data)
    setLoading(false)
  }
  useEffect(() => { if (studentId) load() }, [studentId])

  // استبدال المتغيّرات في نص الموافقة ببيانات الطالب
  function fillBody(body) {
    if (!body) return ''
    const p = student?.persons
    return body
      .replace(/{اسم_الطالب}/g, p?.full_name || '')
      .replace(/{الجنسية}/g, p?.nationality || '')
      .replace(/{اسم_المبنى}/g, student?.buildings?.name || '')
      .replace(/{رقم_الشقة}/g, student?.unit_no || '')
  }

  async function approve(tpl) {
    if (!signaturePath) { toast('يرجى حفظ توقيعك أولاً (في أعلى هذه الصفحة)', 'error'); return }
    const existing = recordFor(tpl.id)
    const payload = { status: 'approved', signed_version: tpl.version || 1, signed_at: new Date().toISOString(), signature_path: signaturePath }
    if (existing) {
      await supabase.from('form_records').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('form_records').insert({ template_id: tpl.id, student_id: studentId, ...payload })
    }
    await supabase.rpc('refresh_account_completion', { p_student: studentId }).catch(() => {})
    toast('تم التوقيع على «' + tpl.title + '»'); setActive(null); load()
  }
  async function submitRequest(tpl) {
    await supabase.from('form_records').insert({ template_id: tpl.id, student_id: studentId, status: 'submitted', data: formData })
    // إشعار للمشرف/المدير
    toast('تم إرسال «' + tpl.title + '»'); setActive(null); setFormData({}); load()
  }

  if (loading) return <div className="state"><div className="spinner"></div>…</div>

  const approvals = templates.filter(t => t.category === 'approval')
  const requests = templates.filter(t => t.category === 'request')
  const notices = records.filter(r => r.form_templates?.category === 'notice')
  const recordFor = (tplId) => records.find(r => r.template_id === tplId)
  const isApproved = (tplId) => records.find(r => r.template_id === tplId && r.status === 'approved')
  const isPending = (tplId) => records.find(r => r.template_id === tplId && r.status === 'pending')

  // عرض نموذج مفتوح
  if (active) {
    const tpl = active
    if (tpl.category === 'approval') {
      return (
        <div className="sp-card">
          <button className="mini" onClick={() => setActive(null)}>→ رجوع</button>
          <h3 style={{ marginTop: 12 }}>{tpl.title}</h3>
          {isPending(tpl.id) && tpl.change_note && (
            <div className="update-note">🔔 حُدّث هذا النموذج. ملخّص التغيير: {tpl.change_note}</div>
          )}
          <div className="form-body-text">{fillBody(tpl.body)}</div>
          {isApproved(tpl.id) && !isPending(tpl.id) ? (
            <div className="approved-note">
              ✓ وقّعت على هذا النموذج بتاريخ {new Date(isApproved(tpl.id).signed_at || isApproved(tpl.id).created_at).toLocaleDateString('ar')}
              <SignatureView path={isApproved(tpl.id).signature_path} />
            </div>
          ) : (
            <>
              {!signaturePath && <div className="update-note">✍ لتوقيع هذا النموذج، احفظ توقيعك أولاً (في أعلى الصفحة).</div>}
              <button className="sp-save" onClick={() => approve(tpl)}>{isPending(tpl.id) ? 'أوافق على التحديث' : 'أوافق وأوقّع'}</button>
            </>
          )}
        </div>
      )
    }
    // طلب
    return (
      <div className="sp-card">
        <button className="mini" onClick={() => setActive(null)}>→ رجوع</button>
        <h3 style={{ marginTop: 12 }}>{tpl.title}</h3>
        {(tpl.fields || []).map(fld => (
          <div className="field" key={fld.key}>
            <label>{fld.label}</label>
            {fld.type === 'textarea'
              ? <textarea rows={3} value={formData[fld.key] || ''} onChange={e => setFormData({ ...formData, [fld.key]: e.target.value })} />
              : <input type={fld.type === 'date' ? 'date' : fld.type === 'number' ? 'number' : 'text'} value={formData[fld.key] || ''} onChange={e => setFormData({ ...formData, [fld.key]: e.target.value })} />}
          </div>
        ))}
        <button className="sp-save" onClick={() => submitRequest(tpl)}>إرسال</button>
      </div>
    )
  }

  return (
    <div className="st-forms">
      {/* التوقيع الإلكتروني */}
      <div className="sp-card">
        <div className="sp-card-title">توقيعي الإلكتروني</div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>يُستخدم توقيعك في النماذج التي توافق عليها. احفظه أولاً.</p>
        <SignaturePad studentId={studentId} currentPath={signaturePath} onSaved={() => window.location.reload()} />
      </div>

      {/* الموافقات */}
      <div className="sp-card">
        <div className="sp-card-title">الموافقات المطلوبة</div>
        {approvals.map(t => {
          const done = isApproved(t.id)
          const pending = isPending(t.id)
          return (
            <div key={t.id} className={'form-list-row' + (pending ? ' pending-row' : '')}>
              <span>{t.title}{t.required && <span className="req-star">*</span>}
                {pending && <span className="pending-tag">يحتاج إعادة موافقة</span>}
              </span>
              {done ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="attach-ok">✓ موقّعة</span><button className="mini" onClick={() => setActive(t)}>اطّلاع</button></span>
                : <button className={pending ? 'save-btn' : 'mini'} style={pending ? { width: 'auto', padding: '7px 16px' } : {}} onClick={() => setActive(t)}>{pending ? 'مراجعة والموافقة' : 'عرض وتوقيع'}</button>}
            </div>
          )
        })}
        {approvals.length === 0 && <div className="muted" style={{ fontSize: 13 }}>لا موافقات.</div>}
      </div>

      {/* الطلبات */}
      {requests.length > 0 && (
        <div className="sp-card">
          <div className="sp-card-title">تقديم طلب</div>
          {requests.map(t => (
            <div key={t.id} className="form-list-row">
              <span>{t.title}</span>
              <button className="mini" onClick={() => { setFormData({}); setActive(t) }}>تقديم</button>
            </div>
          ))}
        </div>
      )}

      {/* طلباتي المرسلة */}
      {records.filter(r => r.form_templates?.category === 'request').length > 0 && (
        <div className="sp-card">
          <div className="sp-card-title">طلباتي</div>
          {records.filter(r => r.form_templates?.category === 'request').map(r => (
            <div key={r.id} className="form-list-row">
              <span>{r.form_templates?.title}</span>
              <span className="muted" style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('ar')}</span>
            </div>
          ))}
        </div>
      )}

      {/* الإشعارات الإدارية الموجّهة للطالب */}
      {notices.length > 0 && (
        <div className="sp-card">
          <div className="sp-card-title">إشعارات إدارية</div>
          {notices.map(r => (
            <div key={r.id} className="notice-card">
              <strong>{r.form_templates?.title}</strong>
              {r.note && <p style={{ fontSize: 14, marginTop: 6, lineHeight: 1.8 }}>{r.note}</p>}
              <span className="muted" style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('ar')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SignatureView({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (path) supabase.storage.from('student-docs').createSignedUrl(path, 3600).then(({ data }) => { if (data) setUrl(data.signedUrl) })
  }, [path])
  if (!path) return null
  return (
    <div className="sig-on-form">
      <span className="muted" style={{ fontSize: 12 }}>التوقيع:</span>
      {url && <img src={url} alt="التوقيع" className="sig-form-img" />}
    </div>
  )
}
