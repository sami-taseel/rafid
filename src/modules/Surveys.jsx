import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useConfirm } from '../Confirm'
import { useToast } from '../Toast'
import { usePrompt } from '../Confirm'
import OptionsEditor from './OptionsEditor'

const TARGETS = ['الجميع', 'الدراسات العليا فقط', 'البكالوريوس فقط', 'المرافقون']

export default function Surveys() {
  const confirmDialog = useConfirm()
  const toast = useToast()
  const promptDialog = usePrompt()
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [results, setResults] = useState(null)
  const [editMeta, setEditMeta] = useState(null)
  const [categories, setCategories] = useState([])
  const [templates, setTemplates] = useState([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', target_category_id: null })
  const [msg, setMsg] = useState(null)

  async function loadAll() {
    const { data: cats } = await supabase.from('categories').select('id, name, member_type').order('name')
    setCategories(cats || [])
    const { data: tpls } = await supabase.from('templates').select('*').eq('type', 'survey').order('created_at', { ascending: false })
    setTemplates(tpls || [])
    const { data } = await supabase.from('surveys').select('*, survey_questions(id)').order('created_at', { ascending: false })
    setSurveys(data || []); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  async function saveAsTemplate(s) {
    const name = await promptDialog({ title: 'حفظ كقالب', message: 'اسم القالب:', defaultValue: s.title, confirmText: 'حفظ' })
    if (!name) return
    const { data: qs } = await supabase.from('survey_questions').select('q_text, q_type, options, sort_order, required').eq('survey_id', s.id)
    await supabase.from('templates').insert({ type: 'survey', name, payload: { title: s.title, description: s.description, questions: qs || [] } })
    toast('تم حفظ القالب'); loadAll()
  }
  async function createFromTemplate(tplId) {
    const tpl = templates.find(t => t.id === tplId); if (!tpl) return
    const p = tpl.payload
    const { data: sv } = await supabase.from('surveys').insert({ title: p.title, description: p.description }).select().single()
    if (p.questions?.length) await supabase.from('survey_questions').insert(p.questions.map(q => ({
      survey_id: sv.id, q_text: q.q_text, q_type: q.q_type, options: q.options, sort_order: q.sort_order, required: q.required,
    })))
    toast('أُنشئت استبانة من القالب'); setEditing(sv)
  }
  async function create() {
    if (!form.title.trim()) { setMsg('اكتب عنوان الاستبانة'); return }
    const { data } = await supabase.from('surveys').insert(form).select().single()
    setCreating(false); setForm({ title: '', description: '', target_category_id: null })
    setEditing(data); loadAll()
  }
  async function duplicate(s) {
    const { data: ns } = await supabase.from('surveys')
      .insert({ title: s.title + ' (نسخة)', description: s.description, target_category_id: s.target_category_id }).select().single()
    const { data: qs } = await supabase.from('survey_questions').select('*').eq('survey_id', s.id)
    if (qs?.length) await supabase.from('survey_questions').insert(qs.map(q => ({
      survey_id: ns.id, q_text: q.q_text, q_type: q.q_type, options: q.options, sort_order: q.sort_order
    })))
    loadAll()
  }
  async function del(id) {
    const ok = await confirmDialog({ title: 'حذف الاستبانة', message: 'سيتم حذف الاستبانة وكل أسئلتها وردودها نهائياً.', confirmText: 'نعم، احذف', danger: true })
    if (!ok) return
    await supabase.from('surveys').delete().eq('id', id); loadAll()
  }
  async function toggleActive(s) { await supabase.from('surveys').update({ is_active: !s.is_active }).eq('id', s.id); loadAll() }
  async function notifyStudents(s) {
    const { data } = await supabase.rpc('notify_survey', { p_survey: s.id, p_title: s.title })
    toast('تم إشعار ' + (data || 0) + ' طالب')
  }

  if (loading) return <Spinner />
  if (editing) return <SurveyEditor survey={editing} onBack={() => { setEditing(null); loadAll() }} />
  if (results) return <SurveyResults survey={results} onBack={() => setResults(null)} />

  return (
    <div>
      {!creating ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="save-btn" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => setCreating(true)}>+ إنشاء استبانة جديدة</button>
          {templates.length > 0 && (
            <select className="tpl-select" defaultValue="" onChange={e => { if (e.target.value) createFromTemplate(e.target.value) }}>
              <option value="">أو أنشئ من قالب…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
      ) : (
        <div className="panel create-survey">
          <h3>استبانة جديدة</h3>
          <div className="field"><label>عنوان الاستبانة</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="مثال: قياس الرضا عن رحلة العمرة" /></div>
          <div className="field"><label>وصف مختصر (اختياري)</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="field"><label>الفئة المستهدفة</label>
            <select value={form.target_category_id || ''} onChange={e => setForm({ ...form, target_category_id: e.target.value || null })}>
              <option value="">كل الطلاب</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>عند تحديد فئة، لا تظهر الاستبانة ولا يصل إشعارها إلا لطلاب تلك الفئة.</p></div>
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
              <span className="pill">{categories.find(c => c.id === s.target_category_id)?.name || 'كل الطلاب'}</span>
              <span className="muted">{s.survey_questions?.length || 0} سؤال</span>
              <span className={s.is_active ? 'pill-on' : 'pill-off'}>{s.is_active ? 'ظاهرة للطلاب' : 'مخفية'}</span>
            </div>
          </div>
          <div className="survey-actions">
            <button className="mini" onClick={() => setEditMeta({ ...s })}>تعديل البيانات</button>
            <button className="mini" onClick={() => setEditing(s)}>تحرير الأسئلة</button>
            <button className="mini" onClick={() => setResults(s)}>النتائج</button>
            <button className="mini" onClick={() => toggleActive(s)}>{s.is_active ? 'إخفاء' : 'إظهار'}</button>
            <button className="mini" onClick={() => notifyStudents(s)}>إشعار الطلاب</button>
            <button className="mini" onClick={() => duplicate(s)}>نسخ</button>
            <button className="mini" onClick={() => saveAsTemplate(s)}>حفظ كقالب</button>
            <button className="fr-del" onClick={() => del(s.id)}>حذف</button>
          </div>
        </div>
      ))}

      {editMeta && (
        <div className="modal-overlay" onClick={() => setEditMeta(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-head"><h2>تعديل بيانات الاستبانة</h2><button className="icon-btn" onClick={() => setEditMeta(null)}>✕</button></div>
            <div className="field"><label>العنوان</label>
              <input value={editMeta.title} onChange={e => setEditMeta({ ...editMeta, title: e.target.value })} /></div>
            <div className="field"><label>الوصف</label>
              <input value={editMeta.description || ''} onChange={e => setEditMeta({ ...editMeta, description: e.target.value })} /></div>
            <div className="field"><label>الفئة المستهدفة</label>
              <select value={editMeta.target_category_id || ''} onChange={e => setEditMeta({ ...editMeta, target_category_id: e.target.value || null })}>
                <option value="">كل الطلاب</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <button className="save-btn" onClick={async () => {
              await supabase.from('surveys').update({ title: editMeta.title, description: editMeta.description, target_category_id: editMeta.target_category_id }).eq('id', editMeta.id)
              setEditMeta(null); toast('تم حفظ التعديل'); loadAll()
            }}>حفظ التعديل</button>
          </div>
        </div>
      )}
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
          ? (Array.isArray(q.options) ? q.options : (typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : [])) : null
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
            <OptionsEditor
              value={Array.isArray(q.options) ? q.options : (typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : [])}
              onChange={(arr) => patch(q.id, { options: arr })} />
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

function SurveyResults({ survey, onBack }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    async function load() {
      const { data: qs } = await supabase.from('survey_questions').select('*').eq('survey_id', survey.id).order('sort_order')
      const { data: resp } = await supabase.from('survey_responses').select('id').eq('survey_id', survey.id)
      const ids = (resp || []).map(r => r.id)
      let answers = []
      if (ids.length) {
        const { data: a } = await supabase.from('survey_answers').select('question_id, answer').in('response_id', ids)
        answers = a || []
      }
      setData({ qs: qs || [], count: ids.length, answers })
    }
    load()
  }, [survey])
  if (!data) return <Spinner />
  return (
    <div>
      <button className="mini" onClick={onBack}>→ رجوع</button>
      <div className="survey-edit-head"><h3>نتائج: {survey.title}</h3><span className="pill">{data.count} رد</span></div>
      {data.count === 0 && <div className="panel muted">لا توجد ردود بعد.</div>}
      {data.qs.map((q, i) => {
        const qa = data.answers.filter(a => a.question_id === q.id).map(a => a.answer?.value)
        const counts = {}
        qa.forEach(v => { const k = String(v); counts[k] = (counts[k]||0)+1 })
        const max = Math.max(1, ...Object.values(counts))
        return (
          <div className="panel" key={q.id}>
            <strong>{i+1}. {q.q_text}</strong>
            {q.q_type === 'text' ? (
              <div className="text-answers">
                {qa.filter(Boolean).map((t, j) => <div key={j} className="list-line">"{t}"</div>)}
                {qa.filter(Boolean).length === 0 && <div className="muted">لا إجابات</div>}
              </div>
            ) : (
              <div className="bar-list" style={{ marginTop: 10 }}>
                {Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k, v]) => (
                  <div className="bar-item" key={k}>
                    <span className="bar-label">{k}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: (v/max*100)+'%' }}></div></div>
                    <span className="bar-val">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
