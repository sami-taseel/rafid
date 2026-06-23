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
  const [step, setStep] = useState(0)        // الخطوة الحالية في نمط Typeform
  const [mode, setMode] = useState('step')   // step = سؤال واحد، all = كل الأسئلة

  useEffect(() => {
    async function load() {
      const { data: visIds } = await supabase.rpc('visible_survey_ids')
      const visible = (visIds || []).map(x => typeof x === 'object' ? x.visible_survey_ids : x)
      if (!visible.length) { setSurveys([]); return }
      const { data } = await supabase.from('surveys').select('*').in('id', visible)
      // عدد الردود لكل استبانة (لفحص الحد الأقصى)
      const withCounts = await Promise.all((data || []).map(async s => {
        const { count } = await supabase.from('survey_responses').select('id', { count: 'exact', head: true }).eq('survey_id', s.id)
        return { ...s, _responseCount: count || 0 }
      }))
      setSurveys(withCounts)
    }
    load()
  }, [])

  // هل الاستبانة مغلقة؟ (انتهت أو بلغت الحد)
  function surveyClosed(s) {
    if (s.expires_at && new Date(s.expires_at) < new Date(new Date().toDateString())) return 'انتهت'
    if (s.max_responses && s._responseCount >= s.max_responses) return 'اكتمل العدد'
    return null
  }

  async function open(s) {
    setActive(s); setDone(false); setAnswers({}); setErrors({}); setStep(0); setMode('step')
    const { data } = await supabase.from('survey_questions').select('*').eq('survey_id', s.id).order('sort_order')
    setQuestions(data || [])
  }

  function setAns(qid, val) { setAnswers({ ...answers, [qid]: val }); setErrors({ ...errors, [qid]: false }) }

  // المنطق الشرطي: هل يظهر السؤال؟ (يدعم شروطاً متعددة AND/OR)
  function evalCond(c) {
    const dep = answers[c.questionId]
    if (dep == null || dep === '') return false
    if (c.operator === 'not_equals') return String(dep) !== String(c.value)
    return String(dep) === String(c.value)
  }
  function isVisible(q) {
    const lg = q.logic
    if (!lg) return true
    // صيغة متعددة الشروط
    if (lg.conditions) {
      if (!lg.conditions.length) return true
      const results = lg.conditions.filter(c => c.questionId).map(evalCond)
      if (!results.length) return true
      return lg.match === 'any' ? results.some(Boolean) : results.every(Boolean)
    }
    // صيغة قديمة (شرط واحد)
    if (!lg.questionId) return true
    return evalCond(lg)
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
        .insert({ survey_id: active.id, student_id: active.is_anonymous ? null : studentId }).select().single()
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
    // الصفحات الظاهرة: نجمّع الأسئلة الظاهرة حسب رقم الصفحة
    const pageNums = [...new Set(visibleQuestions.map(q => q.page || 1))].sort((a, b) => a - b)
    const totalPages = pageNums.length
    const curPageNum = pageNums[Math.min(step, totalPages - 1)]
    const curPageQs = visibleQuestions.filter(q => (q.page || 1) === curPageNum)
    const isLast = step >= totalPages - 1
    const progress = totalPages ? Math.round(((step + 1) / totalPages) * 100) : 0

    // التحقق من أسئلة الصفحة الحالية قبل الانتقال
    function validatePage(qs) {
      const errs = {}
      qs.forEach(q => {
        if (q.required) {
          const v = answers[q.id]
          const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0)
          if (empty) errs[q.id] = true
        }
      })
      if (Object.keys(errs).length) { setErrors({ ...errors, ...errs }); toast('يرجى الإجابة على الأسئلة الإجبارية', 'error'); return false }
      return true
    }

    // ===== نمط عرض كل الأسئلة (قائمة) =====
    if (mode === 'all') {
      return (
        <div className="srv-fill" style={{ '--srv-primary': theme.primary, '--srv-accent': theme.accent }}>
          <div className="srv-fill-head">
            <div className="srv-head-top">
              <button className="srv-back" onClick={() => setActive(null)}>→ رجوع</button>
              {totalPages > 1 && <button className="srv-mode-btn" onClick={() => { setMode('step'); setStep(0) }}>عرض صفحة بصفحة</button>}
            </div>
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

    // ===== نمط الصفحات: صفحة واحدة بأسئلتها + شريط تقدّم =====
    return (
      <div className="srv-stage" style={{ '--srv-primary': theme.primary, '--srv-accent': theme.accent }}>
        <div className="srv-progress-wrap">
          <button className="srv-stage-back" onClick={() => setActive(null)} aria-label="رجوع">→</button>
          <div className="srv-progress"><div className="srv-progress-fill" style={{ width: progress + '%' }}></div></div>
          <button className="srv-mode-btn ghost" onClick={() => setMode('all')}>عرض الكل</button>
        </div>

        {totalPages === 0 ? (
          <div className="srv-stage-card"><p className="muted">لا أسئلة في هذه الاستبانة.</p></div>
        ) : (
          <div className="srv-stage-card" key={curPageNum}>
            <div className="srv-stage-count">{totalPages > 1 ? `الصفحة ${step + 1} من ${totalPages}` : 'الأسئلة'}</div>
            {curPageQs.map(q => {
              const num = visibleQuestions.indexOf(q) + 1
              return (
                <div className={'srv-page-q' + (errors[q.id] ? ' err' : '')} key={q.id}>
                  <div className="srv-stage-q">{num}. {q.q_text}{q.required && <span className="srv-req"> *</span>}</div>
                  {q.help_text && <div className="srv-stage-help">{q.help_text}</div>}
                  <div className="srv-stage-input">
                    <QuestionInput q={q} value={answers[q.id]} onChange={v => setAns(q.id, v)} />
                  </div>
                  {errors[q.id] && <div className="srv-q-err">هذا السؤال إجباري</div>}
                </div>
              )
            })}

            <div className="srv-stage-nav">
              <button className="srv-nav-prev" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>السابق</button>
              {isLast ? (
                <button className="srv-nav-next" onClick={() => { if (validatePage(curPageQs)) submit() }} disabled={submitting}>
                  {submitting ? 'جارٍ الإرسال…' : 'إرسال ✓'}
                </button>
              ) : (
                <button className="srv-nav-next" onClick={() => { if (validatePage(curPageQs)) setStep(step + 1) }}>التالي</button>
              )}
            </div>
          </div>
        )}
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
        const closed = surveyClosed(s)
        return (
          <div key={s.id} className="srv-list-card" style={{ borderInlineStartColor: theme.primary }}>
            <div className="survey-info">
              <div className="survey-title">{s.title}{closed && <span className="srv-closed-badge">{closed}</span>}</div>
              {s.description && <div className="muted">{s.description}</div>}
            </div>
            {closed
              ? <button className="srv-fill-btn" style={{ background: '#9aa3b2', cursor: 'default' }} disabled>مغلقة</button>
              : <button className="srv-fill-btn" style={{ background: theme.primary }} onClick={() => open(s)}>تعبئة</button>}
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
