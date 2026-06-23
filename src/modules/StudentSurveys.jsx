import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'

// الاستبانات المتاحة للطالب لتعبئتها — تدعم الأنواع التسعة
export default function StudentSurveys({ studentId }) {
  const toast = useToast()
  const [surveys, setSurveys] = useState([])
  const [active, setActive] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: visIds } = await supabase.rpc('visible_survey_ids')
      const visible = (visIds || []).map(x => typeof x === 'object' ? x.visible_survey_ids : x)
      if (!visible.length) { setSurveys([]); return }
      const { data } = await supabase.from('surveys').select('*').in('id', visible)
      setSurveys(data || [])
    }
    load()
  }, [])

  async function open(s) {
    setActive(s); setDone(false); setAnswers({}); setErrors({})
    const { data } = await supabase.from('survey_questions').select('*').eq('survey_id', s.id).order('sort_order')
    setQuestions(data || [])
  }

  function setAns(qid, val) { setAnswers({ ...answers, [qid]: val }); setErrors({ ...errors, [qid]: false }) }

  // المنطق الشرطي: هل يظهر السؤال؟ (يعتمد على إجابة سؤال سابق)
  function isVisible(q) {
    if (!q.logic || !q.logic.questionId) return true   // لا منطق = ظاهر دائماً
    const dep = answers[q.logic.questionId]
    if (dep == null || dep === '') return false         // السؤال المعتمَد عليه لم يُجَب = مخفي
    if (q.logic.operator === 'not_equals') return String(dep) !== String(q.logic.value)
    return String(dep) === String(q.logic.value)        // equals (افتراضي)
  }
  const visibleQuestions = questions.filter(isVisible)

  function validate() {
    const errs = {}
    // نتحقق من الإجبارية للأسئلة الظاهرة فقط (المخفية لا تُحاسب)
    visibleQuestions.forEach(q => {
      if (q.required) {
        const v = answers[q.id]
        const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0)
        if (empty) errs[q.id] = true
      }
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function submit() {
    if (!validate()) { toast('يرجى الإجابة على الأسئلة الإجبارية', 'error'); return }
    setSubmitting(true)
    try {
      const { data: resp } = await supabase.from('survey_responses')
        .insert({ survey_id: active.id, student_id: studentId }).select().single()
      // نحفظ إجابات الأسئلة الظاهرة فقط (المخفية لا تُرسل)
      const rows = visibleQuestions.map(q => ({ response_id: resp.id, question_id: q.id, answer: { value: answers[q.id] ?? '' } }))
      await supabase.from('survey_answers').insert(rows)
      const { data: pts } = await supabase.from('app_settings').select('value').eq('key', 'points_survey').maybeSingle()
      await supabase.from('points_log').insert({ student_id: studentId, reason: 'survey', points: Number(pts?.value || 15), note: 'تعبئة استبانة' }).catch(() => {})
      setDone(true)
    } catch (e) { toast('تعذّر الإرسال، حاول مجدداً', 'error') }
    setSubmitting(false)
  }

  // ===== وضع التعبئة =====
  if (active) {
    const theme = active.theme || { primary: '#534AB7', accent: '#D4537E' }
    if (done) {
      return (
        <div className="srv-fill" style={{ '--srv-primary': theme.primary, '--srv-accent': theme.accent }}>
          <div className="srv-thanks">
            <div className="srv-thanks-ic">✓</div>
            <h3>{active.thank_you_message || 'شكراً لك!'}</h3>
            <p className="muted">تم إرسال إجابتك بنجاح.</p>
            <button className="srv-btn-primary" onClick={() => setActive(null)}>العودة للاستبانات</button>
          </div>
        </div>
      )
    }
    return (
      <div className="srv-fill" style={{ '--srv-primary': theme.primary, '--srv-accent': theme.accent }}>
        <div className="srv-fill-head">
          <button className="srv-back" onClick={() => setActive(null)}>→ رجوع</button>
          <h3>{active.title}</h3>
          {active.description && <p className="srv-desc">{active.description}</p>}
        </div>
        {visibleQuestions.map((q, i) => (
          <div className={'srv-q' + (errors[q.id] ? ' err' : '')} key={q.id}>
            <div className="srv-q-title">{i + 1}. {q.q_text}{q.required && <span className="srv-req"> *</span>}</div>
            {q.help_text && <div className="srv-q-help">{q.help_text}</div>}
            <QuestionInput q={q} value={answers[q.id]} onChange={v => setAns(q.id, v)} />
            {errors[q.id] && <div className="srv-q-err">هذا السؤال إجباري</div>}
          </div>
        ))}
        <button className="srv-btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? 'جارٍ الإرسال…' : 'إرسال الإجابة'}
        </button>
      </div>
    )
  }

  // ===== قائمة الاستبانات =====
  return (
    <div>
      <h2 className="section-title">الاستبانات المتاحة</h2>
      {surveys.length === 0 && <div className="muted">لا توجد استبانات حالياً.</div>}
      {surveys.map(s => {
        const theme = s.theme || { primary: '#534AB7', accent: '#D4537E' }
        return (
          <div key={s.id} className="srv-list-card" style={{ borderInlineStartColor: theme.primary }}>
            <div className="survey-info">
              <div className="survey-title">{s.title}</div>
              {s.description && <div className="muted">{s.description}</div>}
            </div>
            <button className="srv-fill-btn" style={{ background: theme.primary }} onClick={() => open(s)}>تعبئة</button>
          </div>
        )
      })}
    </div>
  )
}

// حقل الإدخال حسب نوع السؤال (التسعة)
function QuestionInput({ q, value, onChange }) {
  const t = q.q_type
  const opts = Array.isArray(q.options) ? q.options : []

  if (t === 'short_text') return <input className="srv-input" value={value || ''} onChange={e => onChange(e.target.value)} />
  if (t === 'long_text') return <textarea className="srv-input" rows={4} value={value || ''} onChange={e => onChange(e.target.value)} />
  if (t === 'number') return <input className="srv-input" type="number" dir="ltr" value={value || ''} onChange={e => onChange(e.target.value)} />
  if (t === 'date') return <input className="srv-input" type="date" value={value || ''} onChange={e => onChange(e.target.value)} />

  if (t === 'rating') return (
    <div className="srv-stars">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={(value || 0) >= n ? 'srv-star on' : 'srv-star'} onClick={() => onChange(n)}>★</span>
      ))}
    </div>
  )

  if (t === 'scale') return (
    <div className="srv-scale">
      {Array.from({ length: 10 }).map((_, idx) => {
        const n = idx + 1
        return <button key={n} type="button" className={value === n ? 'srv-scale-btn on' : 'srv-scale-btn'} onClick={() => onChange(n)}>{n}</button>
      })}
    </div>
  )

  if (t === 'likert') return (
    <div className="srv-options">
      {['راضٍ جداً', 'راضٍ', 'محايد', 'غير راضٍ', 'غير راضٍ إطلاقاً'].map(o => (
        <button key={o} type="button" className={value === o ? 'srv-opt on' : 'srv-opt'} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  )

  if (t === 'dropdown') return (
    <select className="srv-input" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">اختر…</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  if (t === 'multiple') {
    const arr = Array.isArray(value) ? value : []
    const toggle = o => onChange(arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o])
    return (
      <div className="srv-options">
        {opts.map(o => (
          <button key={o} type="button" className={arr.includes(o) ? 'srv-opt on' : 'srv-opt'} onClick={() => toggle(o)}>
            <span className="srv-check">{arr.includes(o) ? '☑' : '☐'}</span> {o}
          </button>
        ))}
      </div>
    )
  }

  // single (افتراضي)
  return (
    <div className="srv-options">
      {opts.map(o => (
        <button key={o} type="button" className={value === o ? 'srv-opt on' : 'srv-opt'} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  )
}
