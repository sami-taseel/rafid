import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

const TARGETS = ['الجميع', 'الدراسات العليا فقط', 'البكالوريوس فقط', 'المرافقون']

export default function Surveys() {
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', target_audience: 'الجميع' })
  const [msg, setMsg] = useState(null)

  async function loadAll() {
    const { data } = await supabase.from('surveys').select('*, survey_questions(id)').order('created_at', { ascending: false })
    setSurveys(data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  async function create() {
    if (!form.title.trim()) { setMsg('اكتب عنوان الاستبانة'); return }
    const { data } = await supabase.from('surveys').insert(form).select().single()
    setCreating(false); setForm({ title: '', description: '', target_audience: 'الجميع' })
    setEditing(data); loadAll()
  }
  async function duplicate(s) {
    const { data: ns } = await supabase.from('surveys')
      .insert({ title: s.title + ' (نسخة)', description: s.description, target_audience: s.target_audience }).select().single()
    const { data: qs } = await supabase.from('survey_questions').select('*').eq('survey_id', s.id)
    if (qs?.length) await supabase.from('survey_questions').insert(qs.map(q => ({
      survey_id: ns.id, q_text: q.q_text, q_type: q.q_type, options: q.options, sort_order: q.sort_order
    })))
    loadAll()
  }
  async function del(id) { if (confirm('حذف الاستبانة؟')) { await supabase.from('surveys').delete().eq('id', id); loadAll() } }

  if (loading) return <Spinner />
  if (editing) return <SurveyEditor survey={editing} onBack={() => { setEditing(null); loadAll() }} />

  return (
    <div>
      {!creating ? (
        <button className="save-btn" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>+ إنشاء استبانة جديدة</button>
      ) : (
        <div className="panel create-survey">
          <h3>استبانة جديدة</h3>
          <div className="field"><label>عنوان الاستبانة</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="مثال: قياس الرضا عن رحلة العمرة" /></div>
          <div className="field"><label>وصف مختصر (اختياري)</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="field"><label>الفئة المستهدفة</label>
            <select value={form.target_audience} onChange={e => setForm({ ...form, target_audience: e.target.value })}>
              {TARGETS.map(t => <option key={t}>{t}</option>)}
            </select></div>
          {msg && <div className="login-error">{msg}</div>}
          <div className="form-row">
            <button onClick={create}>إنشاء ومتابعة</button>
            <button className="mini" onClick={() => setCreating(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {surveys.map(s => (
        <div key={s.id} className="survey-card">
          <div className="survey-info">
            <div className="survey-title">{s.title}</div>
            {s.description && <div className="muted">{s.description}</div>}
            <div className="survey-tags">
              <span className="pill">{s.target_audience || 'الجميع'}</span>
              <span className="muted">{s.survey_questions?.length || 0} سؤال</span>
            </div>
          </div>
          <div className="survey-actions">
            <button className="mini" onClick={() => setEditing(s)}>تحرير الأسئلة</button>
            <button className="mini" onClick={() => duplicate(s)}>نسخ</button>
            <button className="fr-del" onClick={() => del(s.id)}>حذف</button>
          </div>
        </div>
      ))}
    </div>
  )
}

const QTYPES = [
  { v: 'likert', l: 'مقياس رضا (راضٍ جداً … غير راضٍ)' },
  { v: 'stars', l: 'تقييم بالنجوم' },
  { v: 'text', l: 'إجابة نصية' },
  { v: 'single', l: 'اختيار واحد' },
  { v: 'multi', l: 'اختيار متعدد' },
]

function SurveyEditor({ survey, onBack }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  async function load() {
    const { data } = await supabase.from('survey_questions').select('*').eq('survey_id', survey.id).order('sort_order')
    setQuestions(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addQ() {
    const max = questions.reduce((m, q) => Math.max(m, q.sort_order), 0)
    const { data } = await supabase.from('survey_questions')
      .insert({ survey_id: survey.id, q_text: '', q_type: 'likert', sort_order: max + 1 }).select().single()
    setQuestions([...questions, data])
  }
  function patch(id, p) { setQuestions(questions.map(q => q.id === id ? { ...q, ...p } : q)) }
  async function saveAll() {
    for (const q of questions) {
      await supabase.from('survey_questions').update({
        q_text: q.q_text, q_type: q.q_type,
        options: (q.q_type === 'single' || q.q_type === 'multi')
          ? (typeof q.options === 'string' ? q.options.split(',').map(x => x.trim()).filter(Boolean) : q.options) : null
      }).eq('id', q.id)
    }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  async function delQ(id) { await supabase.from('survey_questions').delete().eq('id', id); load() }

  if (loading) return <Spinner />
  return (
    <div>
      <button className="mini" onClick={onBack}>→ رجوع للقائمة</button>
      <div className="survey-edit-head">
        <h3>{survey.title}</h3>
        <span className="pill">{survey.target_audience}</span>
      </div>
      {saved && <div className="save-ok">تم حفظ الأسئلة</div>}

      {questions.map((q, i) => (
        <div className="question-card" key={q.id}>
          <div className="q-num">سؤال {i + 1}</div>
          <input className="q-text" placeholder="اكتب نص السؤال هنا…" value={q.q_text}
            onChange={e => patch(q.id, { q_text: e.target.value })} />
          <div className="q-controls">
            <select value={q.q_type} onChange={e => patch(q.id, { q_type: e.target.value })}>
              {QTYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <button className="fr-del" onClick={() => delQ(q.id)}>حذف</button>
          </div>
          {(q.q_type === 'single' || q.q_type === 'multi') && (
            <input className="q-opts" placeholder="الخيارات مفصولة بفاصلة: ممتاز، جيد، ضعيف"
              value={Array.isArray(q.options) ? q.options.join('، ') : (q.options || '')}
              onChange={e => patch(q.id, { options: e.target.value })} />
          )}
          {q.q_type === 'likert' && <div className="q-preview">معاينة: راضٍ جداً · راضٍ · محايد · غير راضٍ · غير راضٍ إطلاقاً</div>}
          {q.q_type === 'stars' && <div className="q-preview">معاينة: ★ ★ ★ ★ ★</div>}
        </div>
      ))}
      <button className="add-field-btn" onClick={addQ}>+ إضافة سؤال</button>
      <button className="save-btn" style={{ marginTop: 12 }} onClick={saveAll}>حفظ كل الأسئلة</button>
    </div>
  )
}
