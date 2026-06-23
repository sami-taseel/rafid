import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useConfirm } from '../Confirm'
import { useToast } from '../Toast'
import { usePrompt } from '../Confirm'
import OptionsEditor from './OptionsEditor'
import Icon from '../Icon'

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
  const [shareSurvey, setShareSurvey] = useState(null)
  const [categories, setCategories] = useState([])
  const [templates, setTemplates] = useState([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', target_category_id: null, theme: { primary: '#534AB7', accent: '#D4537E' } })
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
    setCreating(false); setForm({ title: '', description: '', target_category_id: null, theme: { primary: '#534AB7', accent: '#D4537E' } })
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
          <div className="field"><label>سمة الألوان</label>
            <ThemePicker value={form.theme} onChange={th => setForm({ ...form, theme: th })} /></div>
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
            <button className="mini" onClick={() => setShareSurvey(s)}>مشاركة (QR)</button>
            <button className="mini" onClick={() => saveAsTemplate(s)}>حفظ كقالب</button>
            <button className="fr-del" onClick={() => del(s.id)}>حذف</button>
          </div>
        </div>
      ))}

      {shareSurvey && <ShareModal survey={shareSurvey} onClose={() => setShareSurvey(null)} />}
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
            <div className="field"><label>سمة الألوان</label>
              <ThemePicker value={editMeta.theme || { primary: '#534AB7', accent: '#D4537E' }} onChange={th => setEditMeta({ ...editMeta, theme: th })} /></div>
            <div className="srv-publish-opts">
              <div className="srv-pub-title">خيارات النشر</div>
              <label className="srv-pub-row">
                <input type="checkbox" checked={!!editMeta.is_anonymous} onChange={e => setEditMeta({ ...editMeta, is_anonymous: e.target.checked })} />
                <span>استبانة مجهولة (لا تُربط الإجابة بالطالب)</span>
              </label>
              <div className="srv-pub-grid">
                <div className="field"><label>حد أقصى للردود (اختياري)</label>
                  <input type="number" min="1" value={editMeta.max_responses || ''} placeholder="بلا حد"
                    onChange={e => setEditMeta({ ...editMeta, max_responses: e.target.value ? Number(e.target.value) : null })} /></div>
                <div className="field"><label>تاريخ الإغلاق (اختياري)</label>
                  <input type="date" value={editMeta.expires_at || ''}
                    onChange={e => setEditMeta({ ...editMeta, expires_at: e.target.value || null })} /></div>
              </div>
              <div className="field"><label>رسالة الشكر بعد الإرسال (اختياري)</label>
                <input value={editMeta.thank_you_message || ''} placeholder="شكراً لك!"
                  onChange={e => setEditMeta({ ...editMeta, thank_you_message: e.target.value })} /></div>
            </div>
            <button className="save-btn" onClick={async () => {
              await supabase.from('surveys').update({ title: editMeta.title, description: editMeta.description, target_category_id: editMeta.target_category_id, theme: editMeta.theme || { primary: '#534AB7', accent: '#D4537E' }, is_anonymous: !!editMeta.is_anonymous, max_responses: editMeta.max_responses || null, expires_at: editMeta.expires_at || null, thank_you_message: editMeta.thank_you_message || null }).eq('id', editMeta.id)
              setEditMeta(null); toast('تم حفظ التعديل'); loadAll()
            }}>حفظ التعديل</button>
          </div>
        </div>
      )}
    </div>
  )
}

// نافذة المشاركة: رابط الاستبانة + رمز QR
function ShareModal({ survey, onClose }) {
  const toast = useToast()
  const link = `${window.location.origin}/?survey=${survey.id}`
  // رمز QR عبر خدمة توليد صور (بلا تبعية برمجية)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`
  function copy() { navigator.clipboard?.writeText(link).then(() => toast('نُسخ الرابط')) }
  function downloadQR() {
    const a = document.createElement('a'); a.href = qrUrl + '&download=1'; a.download = `qr-${survey.title}.png`; a.target = '_blank'; a.click()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
        <div className="modal-head"><h2>مشاركة الاستبانة</h2><button className="icon-btn" onClick={onClose}>✕</button></div>
        <p className="muted" style={{ fontSize: 13 }}>{survey.title}</p>
        <div className="share-qr"><img src={qrUrl} alt="رمز QR" width={220} height={220} /></div>
        <div className="share-link" dir="ltr">{link}</div>
        <div className="share-actions">
          <button className="save-btn" style={{ flex: 1 }} onClick={copy}>نسخ الرابط</button>
          <button className="mini" onClick={downloadQR}>تنزيل الرمز</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>ملاحظة: الاستبانة تظهر للطلاب المستهدفين عند دخولهم المنصة. الرابط والرمز للمشاركة المباشرة.</p>
      </div>
    </div>
  )
}

// نافذة بنك الأسئلة — اختيار سؤال جاهز لإضافته
function QuestionBankModal({ onPick, onClose }) {
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('')
  useEffect(() => {
    supabase.from('question_bank').select('*').order('created_at', { ascending: false }).then(({ data }) => setItems(data || []))
  }, [])
  const cats = items ? [...new Set(items.map(i => i.category).filter(Boolean))] : []
  const shown = (items || []).filter(i => !filter || i.category === filter)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-head"><h2>بنك الأسئلة</h2><button className="icon-btn" onClick={onClose}>✕</button></div>
        {items === null ? <Spinner /> : items.length === 0 ? (
          <p className="muted">البنك فارغ. احفظ أسئلة من المحرّر لتظهر هنا.</p>
        ) : (
          <>
            {cats.length > 0 && (
              <div className="bank-cats">
                <button className={'bank-cat' + (filter === '' ? ' on' : '')} onClick={() => setFilter('')}>الكل</button>
                {cats.map(c => <button key={c} className={'bank-cat' + (filter === c ? ' on' : '')} onClick={() => setFilter(c)}>{c}</button>)}
              </div>
            )}
            <div className="bank-list">
              {shown.map(bq => (
                <div key={bq.id} className="bank-item" onClick={() => { onPick(bq); onClose() }}>
                  <div className="bank-item-text">{bq.q_text}</div>
                  <div className="bank-item-meta">
                    <span className="bank-type">{qtypeLabel(bq.q_type)}</span>
                    {bq.category && <span className="bank-cat-tag">{bq.category}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// منتقي سمة الألوان — لوحات جاهزة
const THEME_PRESETS = [
  { name: 'بنفسجي وردي', primary: '#534AB7', accent: '#D4537E' },
  { name: 'أزرق سماوي', primary: '#185FA5', accent: '#1D9E75' },
  { name: 'أخضر زمردي', primary: '#0F6E56', accent: '#639922' },
  { name: 'برتقالي دافئ', primary: '#D85A30', accent: '#BA7517' },
  { name: 'وردي توتي', primary: '#993556', accent: '#D4537E' },
  { name: 'كحلي رافد', primary: '#1f3864', accent: '#2e5496' },
]
function ThemePicker({ value, onChange }) {
  const v = value || THEME_PRESETS[0]
  return (
    <div className="theme-picker">
      <div className="theme-presets">
        {THEME_PRESETS.map(p => {
          const active = v.primary === p.primary && v.accent === p.accent
          return (
            <button key={p.name} type="button" title={p.name}
              className={'theme-swatch' + (active ? ' on' : '')}
              style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
              onClick={() => onChange({ primary: p.primary, accent: p.accent })}>
              {active && <span className="theme-check">✓</span>}
            </button>
          )
        })}
      </div>
      <div className="theme-custom">
        <label>أساسي <input type="color" value={v.primary} onChange={e => onChange({ ...v, primary: e.target.value })} /></label>
        <label>تمييز <input type="color" value={v.accent} onChange={e => onChange({ ...v, accent: e.target.value })} /></label>
        <div className="theme-preview" style={{ background: `linear-gradient(135deg, ${v.primary}, ${v.accent})` }}>معاينة</div>
      </div>
    </div>
  )
}

// محرّر المنطق الشرطي: يظهر السؤال فقط إذا تحقّق شرط على سؤال سابق
function LogicEditor({ q, priorQuestions, onChange }) {
  // الأسئلة المؤهّلة للربط: السابقة من نوع اختيار واحد أو قائمة منسدلة
  const eligible = priorQuestions.filter(p => p.q_type === 'single' || p.q_type === 'dropdown')
  // نطبّع المنطق لصيغة موحّدة: { match, conditions[] }
  const norm = normalizeLogic(q.logic)
  const [open, setOpen] = useState(!!q.logic)

  if (eligible.length === 0) return null

  function update(next) {
    // إن لم تبقَ شروط، نلغي المنطق
    if (!next.conditions.length) { onChange(null); return }
    onChange(next)
  }
  function addCond() { update({ ...norm, conditions: [...norm.conditions, { questionId: '', operator: 'equals', value: '' }] }) }
  function setCond(i, c) { update({ ...norm, conditions: norm.conditions.map((x, idx) => idx === i ? c : x) }) }
  function delCond(i) { update({ ...norm, conditions: norm.conditions.filter((_, idx) => idx !== i) }) }

  return (
    <div className="logic-box">
      <label className="logic-toggle">
        <input type="checkbox" checked={open} onChange={e => {
          setOpen(e.target.checked)
          if (!e.target.checked) onChange(null)
          else if (!norm.conditions.length) onChange({ match: 'all', conditions: [{ questionId: '', operator: 'equals', value: '' }] })
        }} />
        إظهار هذا السؤال بشرط (منطق شرطي)
      </label>
      {open && (
        <div className="logic-multi">
          {norm.conditions.length > 1 && (
            <div className="logic-match">
              <span className="logic-lbl">يظهر إذا تحقّق</span>
              <select value={norm.match} onChange={e => update({ ...norm, match: e.target.value })}>
                <option value="all">كل الشروط (و)</option>
                <option value="any">أيّ شرط (أو)</option>
              </select>
            </div>
          )}
          {norm.conditions.map((c, i) => {
            const depQ = eligible.find(p => p.id === c.questionId)
            const depOptions = depQ && Array.isArray(depQ.options) ? depQ.options : []
            return (
              <div className="logic-row" key={i}>
                {i === 0 ? <span className="logic-lbl">إجابة</span> : <span className="logic-conj">{norm.match === 'all' ? 'و' : 'أو'}</span>}
                <select value={c.questionId || ''} onChange={e => setCond(i, { ...c, questionId: e.target.value, value: '' })}>
                  <option value="">اختر سؤالاً…</option>
                  {eligible.map(p => <option key={p.id} value={p.id}>{(priorQuestions.indexOf(p) + 1)}. {p.q_text || 'سؤال'}</option>)}
                </select>
                <select value={c.operator || 'equals'} onChange={e => setCond(i, { ...c, operator: e.target.value })} disabled={!c.questionId}>
                  <option value="equals">تساوي</option>
                  <option value="not_equals">لا تساوي</option>
                </select>
                <select value={c.value || ''} onChange={e => setCond(i, { ...c, value: e.target.value })} disabled={!c.questionId}>
                  <option value="">اختر القيمة…</option>
                  {depOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {norm.conditions.length > 1 && <button type="button" className="logic-del" onClick={() => delCond(i)}>×</button>}
              </div>
            )
          })}
          <button type="button" className="logic-add" onClick={addCond}>+ إضافة شرط</button>
        </div>
      )}
    </div>
  )
}

// تطبيع المنطق لصيغة موحّدة (متوافق مع الصيغة القديمة ذات الشرط الواحد)
function normalizeLogic(lg) {
  if (!lg) return { match: 'all', conditions: [] }
  if (lg.conditions) return { match: lg.match || 'all', conditions: lg.conditions }
  // صيغة قديمة: { questionId, operator, value }
  if (lg.questionId) return { match: 'all', conditions: [{ questionId: lg.questionId, operator: lg.operator || 'equals', value: lg.value }] }
  return { match: 'all', conditions: [] }
}

// معاينة شكل كل نوع سؤال في المنشئ
function QTypePreview({ type }) {
  const box = { fontSize: 13, color: 'var(--text-soft)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 8, marginTop: 8 }
  if (type === 'short_text') return <div style={box}>معاينة: __________</div>
  if (type === 'long_text') return <div style={box}>معاينة: مربع نص متعدد الأسطر</div>
  if (type === 'rating') return <div style={box}>معاينة: ★ ★ ★ ★ ★</div>
  if (type === 'number') return <div style={box}>معاينة: حقل رقمي</div>
  if (type === 'date') return <div style={box}>معاينة: منتقي تاريخ</div>
  if (type === 'scale') return <div style={box}>معاينة: ١ · ٢ · ٣ … ١٠</div>
  if (type === 'likert') return <div style={box}>معاينة: راضٍ جداً · راضٍ · محايد · غير راضٍ · غير راضٍ إطلاقاً</div>
  if (type === 'dropdown') return <div style={box}>معاينة: قائمة منسدلة بالخيارات أعلاه</div>
  return null
}

// الأنواع التسعة (مدموجة من منصة مِرصاد)
const QTYPES = [
  { v: 'short_text', l: 'نص قصير', icon: 'edit', needsOptions: false },
  { v: 'long_text', l: 'نص طويل', icon: 'file', needsOptions: false },
  { v: 'single', l: 'اختيار واحد', icon: 'check', needsOptions: true },
  { v: 'multiple', l: 'اختيار متعدد', icon: 'check', needsOptions: true },
  { v: 'dropdown', l: 'قائمة منسدلة', icon: 'chevronLeft', needsOptions: true },
  { v: 'rating', l: 'تقييم بالنجوم', icon: 'star', needsOptions: false },
  { v: 'number', l: 'رقم', icon: 'tag', needsOptions: false },
  { v: 'date', l: 'تاريخ', icon: 'calendar', needsOptions: false },
  { v: 'scale', l: 'مقياس ١٠-١', icon: 'chart', needsOptions: false },
  { v: 'likert', l: 'مقياس رضا', icon: 'chart', needsOptions: false },
]
function qtypeNeedsOptions(t) { return t === 'single' || t === 'multiple' || t === 'dropdown' }
function qtypeLabel(t) { return (QTYPES.find(x => x.v === t) || {}).l || t }

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
    const lastPage = questions.length ? (questions[questions.length - 1].page || 1) : 1
    const { data } = await supabase.from('survey_questions')
      .insert({ survey_id: survey.id, q_text: '', q_type: 'single', sort_order: max + 1, required: false, page: lastPage }).select().single()
    setQuestions([...questions, data])
  }
  // إضافة فاصل صفحة: السؤال التالي يبدأ صفحة جديدة
  async function addPageBreak() {
    const max = questions.reduce((m, q) => Math.max(m, q.sort_order), 0)
    const maxPage = questions.reduce((m, q) => Math.max(m, q.page || 1), 1)
    const { data } = await supabase.from('survey_questions')
      .insert({ survey_id: survey.id, q_text: '', q_type: 'single', sort_order: max + 1, required: false, page: maxPage + 1 }).select().single()
    setQuestions([...questions, data])
  }
  function patch(id, p) { setQuestions(questions.map(q => q.id === id ? { ...q, ...p } : q)) }
  async function saveAll() {
    for (const q of questions) {
      await supabase.from('survey_questions').update({
        q_text: q.q_text, q_type: q.q_type, required: !!q.required,
        help_text: q.help_text || null,
        logic: q.logic || null,
        page: q.page || 1,
        options: qtypeNeedsOptions(q.q_type)
          ? (Array.isArray(q.options) ? q.options : (typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : [])) : null
      }).eq('id', q.id)
    }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  async function delQ(id) { await supabase.from('survey_questions').delete().eq('id', id); load() }

  // بنك الأسئلة
  const [bankOpen, setBankOpen] = useState(false)
  async function saveToBank(q) {
    if (!q.q_text?.trim()) { toast('اكتب نص السؤال أولاً', 'error'); return }
    await supabase.from('question_bank').insert({
      q_text: q.q_text, q_type: q.q_type,
      options: qtypeNeedsOptions(q.q_type) ? (Array.isArray(q.options) ? q.options : []) : null,
    })
    toast('حُفظ السؤال في البنك')
  }
  async function importFromBank(bq) {
    const max = questions.reduce((m, q) => Math.max(m, q.sort_order), 0)
    const lastPage = questions.length ? (questions[questions.length - 1].page || 1) : 1
    const { data } = await supabase.from('survey_questions').insert({
      survey_id: survey.id, q_text: bq.q_text, q_type: bq.q_type, options: bq.options,
      sort_order: max + 1, required: false, page: lastPage,
    }).select().single()
    setQuestions(prev => [...prev, data]); toast('أُضيف السؤال')
  }

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
        <div key={q.id}>
          {(i === 0 || (questions[i - 1].page || 1) !== (q.page || 1)) && (
            <div className="page-divider"><span>صفحة {q.page || 1}</span></div>
          )}
          <div className="question-card">
          <div className="q-num">سؤال {i + 1}{q.required && <span className="q-req-mark"> *</span>}</div>
          <input className="q-text" placeholder="اكتب نص السؤال هنا…" value={q.q_text}
            onChange={e => patch(q.id, { q_text: e.target.value })} />
          <input className="q-help" placeholder="نص توضيحي (اختياري)…" value={q.help_text || ''}
            onChange={e => patch(q.id, { help_text: e.target.value })} />
          <div className="q-controls">
            <select value={q.q_type} onChange={e => patch(q.id, { q_type: e.target.value })}>
              {QTYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <label className="q-req-toggle">
              <input type="checkbox" checked={!!q.required} onChange={e => patch(q.id, { required: e.target.checked })} /> إجباري
            </label>
            <button className="fr-del" onClick={() => delQ(q.id)}>حذف</button>
            <button className="q-bank-save" onClick={() => saveToBank(q)} title="حفظ في بنك الأسئلة"><Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} /> للبنك</button>
          </div>
          {qtypeNeedsOptions(q.q_type) && (
            <OptionsEditor
              value={Array.isArray(q.options) ? q.options : (typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : [])}
              onChange={(arr) => patch(q.id, { options: arr })} />
          )}
          <QTypePreview type={q.q_type} />
          <LogicEditor q={q} priorQuestions={questions.slice(0, i)} onChange={(lg) => patch(q.id, { logic: lg })} />
          </div>
        </div>
      ))}
      <div className="survey-add-row">
        <button className="add-field-btn" onClick={addQ}>+ إضافة سؤال</button>
        <button className="add-page-btn" onClick={addPageBreak}>⎘ صفحة جديدة</button>
        <button className="add-bank-btn" onClick={() => setBankOpen(true)}>⊞ من البنك</button>
      </div>
      <button className="save-btn" style={{ marginTop: 12 }} onClick={saveAll}>حفظ كل الأسئلة</button>
      {bankOpen && <QuestionBankModal onPick={importFromBank} onClose={() => setBankOpen(false)} />}
    </div>
  )
}

function SurveyResults({ survey, onBack }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    async function load() {
      const { data: qs } = await supabase.from('survey_questions').select('*').eq('survey_id', survey.id).order('sort_order')
      const { data: resp } = await supabase.from('survey_responses').select('id, created_at, student_id').eq('survey_id', survey.id)
      const ids = (resp || []).map(r => r.id)
      let answers = []
      if (ids.length) {
        const { data: a } = await supabase.from('survey_answers').select('response_id, question_id, answer').in('response_id', ids)
        answers = a || []
      }
      setData({ qs: qs || [], count: ids.length, answers, responses: resp || [] })
    }
    load()
  }, [survey])
  if (!data) return <Spinner />

  // تصدير CSV (مع BOM للعربية) — مدموج من منصة مِرصاد
  function exportCSV() {
    const headers = ['رقم الرد', 'التاريخ', ...data.qs.map(q => `"${(q.q_text || 'سؤال').replace(/"/g, '""')}"`)]
    const rows = data.responses.map((r, idx) => {
      const cells = [idx + 1, new Date(r.created_at).toLocaleDateString('ar')]
      data.qs.forEach(q => {
        const a = data.answers.find(x => x.response_id === r.id && x.question_id === q.id)
        let v = a?.answer?.value
        if (Array.isArray(v)) v = v.join(' / ')
        cells.push(`"${String(v ?? '').replace(/"/g, '""')}"`)
      })
      return cells.join(',')
    })
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${survey.title}-نتائج.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // إحصاءات عامة
  const requiredCount = data.qs.filter(q => q.required).length
  const logicCount = data.qs.filter(q => q.logic && q.logic.questionId).length

  return (
    <div>
      <button className="mini" onClick={onBack}>→ رجوع</button>
      <div className="survey-edit-head">
        <h3>نتائج: {survey.title}</h3>
        {data.count > 0 && <button className="srv-csv-btn" onClick={exportCSV}><Icon name="download" size={15} /> تصدير CSV</button>}
      </div>

      {/* بطاقات إحصائية */}
      <div className="srv-stat-cards">
        <div className="srv-stat"><div className="srv-stat-n">{data.count}</div><div className="srv-stat-l">إجمالي الردود</div></div>
        <div className="srv-stat"><div className="srv-stat-n">{data.qs.length}</div><div className="srv-stat-l">عدد الأسئلة</div></div>
        <div className="srv-stat"><div className="srv-stat-n">{requiredCount}</div><div className="srv-stat-l">أسئلة إجبارية</div></div>
        <div className="srv-stat"><div className="srv-stat-n">{logicCount}</div><div className="srv-stat-l">أسئلة شرطية</div></div>
      </div>

      {data.count === 0 && <div className="panel muted">لا توجد ردود بعد.</div>}
      {data.qs.map((q, i) => {
        const raw = data.answers.filter(a => a.question_id === q.id).map(a => a.answer?.value)
        const isText = ['text', 'short_text', 'long_text'].includes(q.q_type)
        const isNum = ['rating', 'scale', 'number'].includes(q.q_type)
        // الاختيار المتعدد: نفرد المصفوفات
        const flat = []
        raw.forEach(v => { if (Array.isArray(v)) v.forEach(x => flat.push(x)); else if (v != null && v !== '') flat.push(v) })
        const counts = {}
        flat.forEach(v => { const k = String(v); counts[k] = (counts[k] || 0) + 1 })
        const max = Math.max(1, ...Object.values(counts))
        // متوسط للأرقام
        const nums = flat.map(Number).filter(n => !isNaN(n))
        const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : null
        return (
          <div className="panel" key={q.id}>
            <strong>{i + 1}. {q.q_text}</strong>
            {isText ? (
              <div className="text-answers">
                {flat.filter(Boolean).slice(0, 50).map((t, j) => <div key={j} className="list-line">"{t}"</div>)}
                {flat.filter(Boolean).length === 0 && <div className="muted">لا إجابات</div>}
              </div>
            ) : (
              <>
                {isNum && avg != null && <div className="srv-avg">المتوسط: <strong>{avg}</strong>{q.q_type === 'rating' ? ' / ٥' : q.q_type === 'scale' ? ' / ١٠' : ''} <span className="muted">({nums.length} إجابة)</span></div>}
                <div className="bar-list" style={{ marginTop: 10 }}>
                  {Object.entries(counts).sort((a, b) => isNum ? Number(a[0]) - Number(b[0]) : b[1] - a[1]).map(([k, v]) => (
                    <div className="bar-item" key={k}>
                      <span className="bar-label">{k}</span>
                      <div className="bar-track"><div className="bar-fill" style={{ width: (v / max * 100) + '%' }}></div></div>
                      <span className="bar-val">{v}</span>
                    </div>
                  ))}
                  {Object.keys(counts).length === 0 && <div className="muted">لا إجابات</div>}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
