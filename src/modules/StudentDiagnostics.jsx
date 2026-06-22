import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Icon from '../Icon'
import { Spinner } from './Students'

// أداة تشخيص الطلاب — تمكّن المدير من معرفة سبب تعثّر أي طالب دون الدخول لحسابه
export default function StudentDiagnostics() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [diag, setDiag] = useState(null)
  const [diagLoading, setDiagLoading] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('students_needing_help')
    setList(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function openDiag(s) {
    setSel(s); setDiagLoading(true); setDiag(null)
    const { data } = await supabase.rpc('student_diagnostics', { p_student: s.student_id })
    setDiag(data?.[0] || null); setDiagLoading(false)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <h2 className="section-title">مساعدة الطلاب</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        تشخيص حالة كل طالب وسبب تعثّره، دون الحاجة للدخول إلى حسابه.
      </p>

      {list.length === 0 && <div className="panel" style={{ textAlign: 'center' }}>
        <Icon name="check" size={32} /> <div style={{ marginTop: 8 }}>كل الطلاب أكملوا حساباتهم</div>
      </div>}

      <div className="diag-list">
        {list.map(s => (
          <div key={s.student_id} className="diag-row" onClick={() => openDiag(s)}>
            <div className="diag-row-info">
              <div className="diag-av">{(s.full_name || '؟').charAt(0)}</div>
              <div>
                <div className="diag-name">{s.full_name || 'طالب'}</div>
                <div className="diag-email" dir="ltr">{s.email}</div>
              </div>
            </div>
            <span className={'diag-issue issue-' + s.account_state}>{s.issue}</span>
          </div>
        ))}
      </div>

      {sel && (
        <div className="confirm-overlay" onClick={() => setSel(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, textAlign: 'right', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="confirm-title">تشخيص: {sel.full_name}</div>
            {diagLoading ? <Spinner /> : diag ? (
              <div className="diag-detail">
                <DiagItem ok={diag.has_auth} label="تفعيل الحساب"
                  okText="مفعّل" badText="لم يفعّل حسابه عبر البريد بعد" />
                <DiagItem ok={diag.filled_fields >= diag.required_fields} label="إكمال البيانات"
                  okText={`اكتملت (${diag.filled_fields}/${diag.required_fields})`}
                  badText={`ناقصة (${diag.filled_fields}/${diag.required_fields})`} />
                {diag.missing_fields && (
                  <div className="diag-missing">
                    <strong>حقول ناقصة:</strong> {diag.missing_fields}
                  </div>
                )}
                <DiagItem ok={diag.has_companions !== null} label="سؤال المرافقين"
                  okText={diag.has_companions ? `نعم (${diag.companions_count} مرافق)` : 'لا مرافقين'}
                  badText="لم يُجب بعد" />
                <DiagItem ok={diag.uploaded_attachments >= diag.required_attachments} label="المرفقات المطلوبة"
                  okText={`اكتملت (${diag.uploaded_attachments}/${diag.required_attachments})`}
                  badText={`ناقصة (${diag.uploaded_attachments}/${diag.required_attachments})`} />
                <DiagItem ok={diag.pending_forms === 0} label="توقيع النماذج"
                  okText="كل النماذج موقّعة"
                  badText={`${diag.pending_forms} نموذج بانتظار التوقيع`} />

                <div className="diag-summary">
                  <div className="diag-sum-row"><span className="muted">حالة الحساب</span><strong>{{ pending_data: 'يكمل بياناته', pending_approval: 'بانتظار الاعتماد', approved: 'يوقّع النماذج', active: 'مكتمل' }[diag.account_state] || diag.account_state}</strong></div>
                  <div className="diag-sum-row"><span className="muted">حالة القبول</span><strong>{diag.admission_status || '—'}</strong></div>
                  <div className="diag-sum-row"><span className="muted">آخر دخول</span><strong>{diag.last_login ? new Date(diag.last_login).toLocaleDateString('ar') : 'لم يدخل بعد'}</strong></div>
                  <div className="diag-sum-row"><span className="muted">البريد</span><strong dir="ltr">{diag.email}</strong></div>
                </div>

                {/* إجراء مقترح */}
                <div className="diag-action">
                  <strong>الإجراء المقترح:</strong>
                  <p>{suggestAction(diag)}</p>
                </div>
              </div>
            ) : <div className="muted">تعذّر جلب التشخيص.</div>}
            <div className="confirm-actions"><button className="confirm-ok" onClick={() => setSel(null)}>إغلاق</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function DiagItem({ ok, label, okText, badText }) {
  return (
    <div className={'diag-item ' + (ok ? 'ok' : 'bad')}>
      <span className="diag-item-ic"><Icon name={ok ? 'check' : 'x'} size={14} /></span>
      <div className="diag-item-body">
        <div className="diag-item-label">{label}</div>
        <div className="diag-item-text">{ok ? okText : badText}</div>
      </div>
    </div>
  )
}

function suggestAction(d) {
  if (!d.has_auth) return 'الطالب أنشأ سجلاً لكنه لم يفعّل حسابه عبر البريد. تواصل معه للتأكد من فتح رابط التفعيل، أو أعد إرسال الدعوة.'
  if (d.filled_fields < d.required_fields) return `وجّه الطالب لإكمال الحقول الناقصة في صفحة «ملفي ← بياناتي»: ${d.missing_fields || ''}`
  if (d.has_companions === null) return 'وجّه الطالب للإجابة على سؤال المرافقين في صفحة «ملفي ← المرافقون».'
  if (d.has_companions && d.companions_count === 0) return 'الطالب أجاب بوجود مرافقين لكن لم يُضف أحداً. وجّهه لإضافة مرافق واحد على الأقل.'
  if (d.uploaded_attachments < d.required_attachments) return 'وجّه الطالب لرفع المرفقات الناقصة في «ملفي ← المرفقات». تأكّد أن الملف صورة أو PDF وحجمه أقل من ١٠ ميجابايت.'
  if (d.account_state === 'pending_approval') return 'الطالب أكمل كل شيء وينتظر اعتمادك. راجع ملفه واعتمده من «طلبات الاعتماد».'
  if (d.pending_forms > 0) return `وجّه الطالب لتوقيع ${d.pending_forms} نموذج في «ملفي ← النماذج».`
  return 'حساب الطالب مكتمل، لا إجراء مطلوب.'
}
