import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function Surveys() {
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState(null)

  async function loadAll() {
    const { data } = await supabase.from('surveys').select('*, survey_questions(id)').order('created_at', { ascending: false })
    setSurveys(data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  async function createSurvey() {
    const title = prompt('عنوان الاستبانة:')
    if (!title) return
    const { data } = await supabase.from('surveys').insert({ title }).select().single()
    setEditing(data); loadAll()
  }
  async function duplicate(s) {
    const { data: ns } = await supabase.from('surveys').insert({ title: s.title + ' (نسخة)' }).select().single()
    const { data: qs } = await supabase.from('survey_questions').select('*').eq('survey_id', s.id)
    if (qs?.length) {
      await supabase.from('survey_questions').insert(qs.map(q => ({
        survey_id: ns.id, q_text: q.q_text, q_type: q.q_type, options: q.options, sort_order: q.sort_order
      })))
    }
    setMsg('تم إنشاء نسخة'); loadAll()
  }
  async function del(id) {
    if (!confirm('حذف الاستبانة؟')) return
    await supabase.from('surveys').delete().eq('id', id); loadAll()
  }

  if (loading) return <Spinner />
  if (editing) return <SurveyEditor survey={editing} onBack={() => { setEditing(null); loadAll() }} />

  return (
    <div>
      <div className="panel">
        <button className="save-btn" onClick={createSurvey}>+ استبانة جديدة</button>
        {msg && <div className="save-ok" style={{ marginTop: 12 }}>{msg}</div>}
      </div>
      {surveys.map(s => (
        <div key={s.id} className="panel">
          <div className="act-head">
            <div><strong>{s.title}</strong> <span className="muted">{s.survey_questions?.length || 0} سؤال</span></div>
            <div className="sess-actions">
              <button className="mini" onClick={() => setEditing(s)}>تعديل</button>
              <button className="mini" onClick={() => duplicate(s)}>نسخ</button>
              <button className="fr-del" onClick={() => del(s.id)}>حذف</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SurveyEditor({ survey, onBack }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('survey_questions').select('*').eq('survey_id', survey.id).order('sort_order')
    setQuestions(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addQ() {
    const max = questions.reduce((m, q) => Math.max(m, q.sort_order), 0)
    await supabase.from('survey_questions').insert({ survey_id: survey.id, q_text: 'سؤال جديد', q_type: 'likert', sort_order: max + 1 })
    load()
  }
  async function saveQ(q) {
    await supabase.from('survey_questions').update({
      q_text: q.q_text, q_type: q.q_type,
      options: q.q_type === 'single' || q.q_type === 'multi'
        ? (typeof q.options === 'string' ? JSON.parse(q.options || '[]') : q.options) : null
    }).eq('id', q.id)
  }
  async function delQ(id) { await supabase.from('survey_questions').delete().eq('id', id); load() }

  if (loading) return <Spinner />
  return (
    <div>
      <button className="mini" onClick={onBack}>→ رجوع</button>
      <h3 className="section-title">تعديل: {survey.title}</h3>
      {questions.map((q, i) => (
        <div className="panel" key={q.id}>
          <input style={{ width: '100%', marginBottom: 8 }} value={q.q_text}
            onChange={e => setQuestions(questions.map(x => x.id === q.id ? { ...x, q_text: e.target.value } : x))} />
          <div className="form-row">
            <select value={q.q_type} onChange={e => setQuestions(questions.map(x => x.id === q.id ? { ...x, q_type: e.target.value } : x))}>
              <option value="likert">مقياس رضا</option>
              <option value="stars">نجوم</option>
              <option value="text">نص</option>
              <option value="single">اختيار واحد</option>
              <option value="multi">اختيار متعدد</option>
            </select>
            <button className="mini" onClick={() => saveQ(q)}>حفظ</button>
            <button className="fr-del" onClick={() => delQ(q.id)}>حذف</button>
          </div>
        </div>
      ))}
      <button className="add-field-btn" onClick={addQ}>+ إضافة سؤال</button>
    </div>
  )
}
