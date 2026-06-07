import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// الاستبانات المتاحة للطالب لتعبئتها
export default function StudentSurveys({ studentId }) {
  const [surveys, setSurveys] = useState([])
  const [active, setActive] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    async function load() {
      // الاستبانات المرئية للطالب حسب فئته
      const { data: visIds } = await supabase.rpc('visible_survey_ids')
      const visible = (visIds || []).map(x => typeof x === 'object' ? x.visible_survey_ids : x)
      if (!visible.length) { setSurveys([]); return }
      const { data } = await supabase.from('surveys').select('*').in('id', visible)
      setSurveys(data || [])
    }
    load()
  }, [])

  async function open(s) {
    setActive(s); setMsg(null); setAnswers({})
    const { data } = await supabase.from('survey_questions').select('*').eq('survey_id', s.id).order('sort_order')
    setQuestions(data || [])
  }
  async function submit() {
    const { data: resp } = await supabase.from('survey_responses')
      .insert({ survey_id: active.id, student_id: studentId }).select().single()
    const rows = questions.map(q => ({ response_id: resp.id, question_id: q.id, answer: { value: answers[q.id] ?? '' } }))
    await supabase.from('survey_answers').insert(rows)
    setMsg('شكراً، تم إرسال إجابتك.'); setActive(null)
  }

  if (active) {
    return (
      <div className="panel">
        <button className="mini" onClick={() => setActive(null)}>→ رجوع</button>
        <h3 style={{ margin: '12px 0' }}>{active.title}</h3>
        {questions.map((q, i) => (
          <div className="field" key={q.id}>
            <label>{i + 1}. {q.q_text}</label>
            {q.q_type === 'text' ? (
              <input value={answers[q.id] || ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} />
            ) : q.q_type === 'likert' ? (
              <div className="likert">
                {['راضٍ جداً','راضٍ','محايد','غير راضٍ','غير راضٍ إطلاقاً'].map(o => (
                  <button key={o} type="button" className={answers[q.id] === o ? 'lk sel' : 'lk'}
                    onClick={() => setAnswers({ ...answers, [q.id]: o })}>{o}</button>
                ))}
              </div>
            ) : q.q_type === 'stars' ? (
              <div className="stars">
                {[1,2,3,4,5].map(n => (
                  <span key={n} className={(answers[q.id] || 0) >= n ? 'star on' : 'star'}
                    onClick={() => setAnswers({ ...answers, [q.id]: n })}>★</span>
                ))}
              </div>
            ) : (
              <div className="likert">
                {(Array.isArray(q.options) ? q.options : []).map(o => (
                  <button key={o} type="button" className={answers[q.id] === o ? 'lk sel' : 'lk'}
                    onClick={() => setAnswers({ ...answers, [q.id]: o })}>{o}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        <button className="save-btn" onClick={submit}>إرسال الإجابة</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="section-title">الاستبانات المتاحة</h2>
      {surveys.length === 0 && <div className="muted">لا توجد استبانات حالياً.</div>}
      {surveys.map(s => (
        <div key={s.id} className="survey-card">
          <div className="survey-info">
            <div className="survey-title">{s.title}</div>
            {s.description && <div className="muted">{s.description}</div>}
          </div>
          <button className="mini" onClick={() => open(s)}>تعبئة</button>
        </div>
      ))}
      {msg && <div className="save-ok">{msg}</div>}
    </div>
  )
}
