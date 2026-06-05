import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useConfirm } from '../Confirm'
import { useToast } from '../Toast'

// المعايير المتاحة للفئات التلقائية (طلاب)
const STUDENT_FIELDS = [
  { key: 'nationality', label: 'الجنسية' },
  { key: 'degree_level', label: 'المرحلة الدراسية' },
  { key: 'gender', label: 'الجنس' },
  { key: 'building', label: 'مكان السكن (العمارة)' },
]
const COMPANION_RELATIONS = ['زوجة', 'زوج', 'ابن', 'ابنة']

export default function Categories() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState(null)   // الفئة قيد الإنشاء/التعديل
  const [fieldValues, setFieldValues] = useState({})  // القيم المتاحة لكل معيار
  const confirmDialog = useConfirm()
  const toast = useToast()

  const [counts, setCounts] = useState({})
  const [viewMembers, setViewMembers] = useState(null)
  async function load() {
    const { data } = await supabase.from('categories').select('*').order('created_at', { ascending: false })
    setCats(data || [])
    const { data: cnts } = await supabase.rpc('category_counts')
    const map = {}; (cnts || []).forEach(c => { map[c.category_id] = c.cnt }); setCounts(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // نقرأ القيم الحية للمعايير من بيانات الطلاب
  useEffect(() => {
    async function loadValues() {
      const { data: persons } = await supabase.from('persons').select('nationality, gender')
      const { data: students } = await supabase.from('students').select('degree_level')
      const { data: buildings } = await supabase.from('buildings').select('name')
      setFieldValues({
        nationality: [...new Set((persons||[]).map(p => p.nationality).filter(Boolean))],
        gender: [...new Set((persons||[]).map(p => p.gender).filter(Boolean))],
        degree_level: [...new Set((students||[]).map(s => s.degree_level).filter(Boolean))],
        building: (buildings||[]).map(b => b.name).filter(n => !n.startsWith('[مخفي]')),
      })
    }
    loadValues()
  }, [])

  function newCategory() {
    setEditor({ name: '', member_type: 'student', companion_relation: '', mode: 'manual', rules: [], description: '' })
  }

  async function saveCategory() {
    if (!editor.name.trim()) { toast('اكتب اسم الفئة', 'error'); return }
    let rules = editor.rules
    // المرافقون: نحوّل صلة القرابة إلى معيار
    if (editor.member_type === 'companion' && editor.companion_relation) {
      rules = [{ field: 'relation', values: [editor.companion_relation] }]
    }
    const payload = {
      name: editor.name, member_type: editor.member_type,
      mode: editor.mode, rules, description: editor.description,
    }
    if (editor.id) await supabase.from('categories').update(payload).eq('id', editor.id)
    else await supabase.from('categories').insert(payload)
    setEditor(null); toast('تم حفظ الفئة'); load()
  }

  async function delCategory(c) {
    const ok = await confirmDialog({ title: 'حذف الفئة', message: 'سيتم حذف الفئة «' + c.name + '» وكل ارتباطاتها.', confirmText: 'نعم، احذف', danger: true })
    if (!ok) return
    await supabase.from('categories').delete().eq('id', c.id); toast('تم حذف الفئة'); load()
  }

  // إدارة معايير الفئة التلقائية
  function addRule() { setEditor({ ...editor, rules: [...editor.rules, { field: 'nationality', values: [] }] }) }
  function updateRule(i, patch) { setEditor({ ...editor, rules: editor.rules.map((r, idx) => idx === i ? { ...r, ...patch } : r) }) }
  function removeRule(i) { setEditor({ ...editor, rules: editor.rules.filter((_, idx) => idx !== i) }) }
  function toggleValue(i, val) {
    const r = editor.rules[i]
    const vals = r.values.includes(val) ? r.values.filter(v => v !== val) : [...r.values, val]
    updateRule(i, { values: vals })
  }

  if (loading) return <Spinner />

  return (
    <div>
      <button className="save-btn" style={{ marginBottom: 16, width: 'auto', padding: '12px 22px' }} onClick={newCategory}>+ فئة جديدة</button>

      {cats.length === 0 && <div className="panel muted">لا توجد فئات بعد. أنشئ فئة لتصنيف الطلاب والمرافقين.</div>}
      <div className="cat-grid">
        {cats.map(c => (
          <div key={c.id} className="cat-card">
            <div className="cat-card-head">
              <span className="cat-name">{c.name}</span>
              <span className={'cat-type ' + c.member_type}>{c.member_type === 'student' ? 'طلاب' : 'مرافقون'}</span>
            </div>
            <div className="cat-mode">{c.mode === 'auto' ? '⚙️ تلقائية' : '✋ يدوية'}</div>
            {c.member_type === 'student' && (
              <button className="cat-count" onClick={() => setViewMembers(c)}>
                👥 {counts[c.id] ?? 0} عضو — استعراض
              </button>
            )}
            {c.description && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{c.description}</div>}
            <div className="cat-actions">
              <button className="mini" onClick={() => setEditor({ ...c, companion_relation: c.rules?.[0]?.field === 'relation' ? c.rules[0].values[0] : '', rules: c.rules || [] })}>تعديل</button>
              <button className="fr-del" onClick={() => delCategory(c)}>حذف</button>
            </div>
          </div>
        ))}
      </div>

      {viewMembers && <MembersModal category={viewMembers} onClose={() => setViewMembers(null)} />}

      {editor && (
        <div className="modal-overlay" onClick={() => setEditor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-head">
              <h2>{editor.id ? 'تعديل فئة' : 'فئة جديدة'}</h2>
              <button className="icon-btn" onClick={() => setEditor(null)}>✕</button>
            </div>

            {/* نوع العضو */}
            <div className="field">
              <label>نوع الفئة</label>
              <div className="seg">
                <button type="button" className={editor.member_type === 'student' ? 'seg-on' : ''} onClick={() => setEditor({ ...editor, member_type: 'student', companion_relation: '', rules: [] })}>طلاب</button>
                <button type="button" className={editor.member_type === 'companion' ? 'seg-on' : ''} onClick={() => setEditor({ ...editor, member_type: 'companion', rules: [] })}>مرافقون</button>
              </div>
            </div>

            {/* صلة القرابة للمرافقين */}
            {editor.member_type === 'companion' && (
              <div className="field">
                <label>صلة القرابة المستهدفة</label>
                <select value={editor.companion_relation} onChange={e => setEditor({ ...editor, companion_relation: e.target.value })}>
                  <option value="">الكل</option>
                  {COMPANION_RELATIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>اسم الفئة</label>
              <input value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} placeholder="مثال: طلاب الدكتوراه الإندونيسيون" />
            </div>

            <div className="field">
              <label>وصف مختصر (اختياري)</label>
              <input value={editor.description || ''} onChange={e => setEditor({ ...editor, description: e.target.value })} />
            </div>

            {/* طريقة التحديد (للطلاب) */}
            {editor.member_type === 'student' && (
              <>
                <div className="field">
                  <label>طريقة تحديد الأعضاء</label>
                  <div className="seg">
                    <button type="button" className={editor.mode === 'manual' ? 'seg-on' : ''} onClick={() => setEditor({ ...editor, mode: 'manual' })}>يدوي</button>
                    <button type="button" className={editor.mode === 'auto' ? 'seg-on' : ''} onClick={() => setEditor({ ...editor, mode: 'auto' })}>تلقائي حسب المعايير</button>
                  </div>
                </div>

                {editor.mode === 'auto' && (
                  <div className="rules-box">
                    <div className="rules-head">
                      <span>المعايير</span>
                      <button type="button" className="mini" onClick={addRule}>+ معيار</button>
                    </div>
                    <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                      أي طالب حالي أو قادم تنطبق عليه المعايير يُضاف للفئة تلقائياً.
                    </p>
                    {editor.rules.length === 0 && <div className="muted" style={{ fontSize: 13 }}>أضِف معياراً واحداً أو أكثر.</div>}
                    {editor.rules.map((r, i) => (
                      <div key={i} className="rule-item">
                        <div className="rule-top">
                          <select value={r.field} onChange={e => updateRule(i, { field: e.target.value, values: [] })}>
                            {STUDENT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </select>
                          <button type="button" className="fr-del" onClick={() => removeRule(i)}>حذف</button>
                        </div>
                        <div className="rule-values">
                          {(fieldValues[r.field] || []).map(v => (
                            <button key={v} type="button"
                              className={'val-chip' + (r.values.includes(v) ? ' on' : '')}
                              onClick={() => toggleValue(i, v)}>{v}</button>
                          ))}
                          {(fieldValues[r.field] || []).length === 0 && <span className="muted" style={{ fontSize: 12 }}>لا قيم متاحة بعد</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {editor.mode === 'manual' && editor.id && <ManualPicker category={editor} />}
                {editor.mode === 'manual' && !editor.id && <p className="muted" style={{ fontSize: 13 }}>بعد الحفظ، يمكنك إضافة الأعضاء يدوياً.</p>}
              </>
            )}

            <button className="save-btn" onClick={saveCategory}>{editor.id ? 'حفظ التعديل' : 'إنشاء الفئة'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// منتقي الأعضاء اليدوي
function ManualPicker({ category }) {
  const [students, setStudents] = useState([])
  const [members, setMembers] = useState([])
  const [q, setQ] = useState('')
  const toast = useToast()

  async function load() {
    const { data: st } = await supabase.from('students').select('id, persons(full_name)')
    setStudents(st || [])
    const { data: mem } = await supabase.from('category_members').select('student_id').eq('category_id', category.id)
    setMembers((mem || []).map(m => m.student_id))
  }
  useEffect(() => { load() }, [category.id])

  async function toggle(sid) {
    if (members.includes(sid)) {
      await supabase.from('category_members').delete().eq('category_id', category.id).eq('student_id', sid)
      setMembers(members.filter(m => m !== sid))
    } else {
      await supabase.from('category_members').insert({ category_id: category.id, student_id: sid })
      setMembers([...members, sid])
    }
  }

  const filtered = students.filter(s => (s.persons?.full_name || '').includes(q))
  return (
    <div className="manual-picker">
      <label>الأعضاء ({members.length})</label>
      <input className="search" placeholder="بحث…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <div className="picker-list">
        {filtered.map(s => (
          <label key={s.id} className="picker-row">
            <input type="checkbox" checked={members.includes(s.id)} onChange={() => toggle(s.id)} />
            {s.persons?.full_name}
          </label>
        ))}
      </div>
    </div>
  )
}

function MembersModal({ category, onClose }) {
  const [members, setMembers] = useState(null)
  useEffect(() => {
    supabase.rpc('category_students', { p_category: category.id })
      .then(({ data }) => setMembers(data || []))
  }, [category.id])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <h2>أعضاء فئة: {category.name}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {members === null ? <div className="state"><div className="spinner"></div>…</div> : (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>{members.length} عضو</p>
            <div className="picker-list">
              {members.map(m => (
                <div key={m.student_id} className="list-line">
                  {m.full_name} <span className="muted">{m.nationality} · {m.degree_level}</span>
                </div>
              ))}
              {members.length === 0 && <div className="muted">لا أعضاء مطابقون حالياً.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
