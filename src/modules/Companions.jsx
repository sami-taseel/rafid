import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { useConfirm } from '../Confirm'
import Icon from '../Icon'

const EDU_LEVELS = ['ما قبل المدرسة', 'الروضة', 'الابتدائية', 'المتوسطة', 'الثانوية', 'الجامعية', 'دراسات عليا', 'غير ملتحق']
const RELATIONS = ['زوجة', 'زوج', 'ابن', 'ابنة', 'والد', 'والدة', 'أخ', 'أخت']
const empty = { full_name: '', relation: 'زوجة', residency_no: '', birth_date: '', education_level: '' }

export default function Companions({ studentId, personId }) {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [companions, setCompanions] = useState([])
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)   // معرّف المرافق قيد التعديل
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase.rpc('my_companions', { p_student: studentId })
    setCompanions(data || [])
  }
  useEffect(() => { if (studentId) load() }, [studentId])

  function validate() {
    if (!form.full_name.trim()) { toast('اكتب اسم المرافق', 'error'); return false }
    if (form.residency_no && !/^[1-4]\d{9}$/.test(form.residency_no.trim())) { toast('رقم الإقامة/الهوية يجب أن يكون ١٠ أرقام', 'error'); return false }
    return true
  }

  async function submit() {
    if (!validate()) return
    setBusy(true)
    if (editId) {
      const { error } = await supabase.rpc('update_companion', {
        p_companion: editId, p_full_name: form.full_name.trim(), p_relation: form.relation,
        p_residency_no: form.residency_no || null, p_birth_date: form.birth_date || null, p_education_level: form.education_level || null,
      })
      setBusy(false)
      if (error) { toast('تعذّر التعديل: ' + error.message, 'error'); return }
      toast('تم تعديل بيانات المرافق')
    } else {
      const { error } = await supabase.rpc('add_companion', {
        p_student: studentId, p_full_name: form.full_name.trim(), p_relation: form.relation,
        p_residency_no: form.residency_no || null, p_birth_date: form.birth_date || null, p_education_level: form.education_level || null,
      })
      setBusy(false)
      if (error) { toast('تعذّرت الإضافة: ' + error.message, 'error'); return }
      toast('أُضيف المرافق')
    }
    setForm(empty); setEditId(null); load()
  }

  function startEdit(c) {
    setEditId(c.id)
    setForm({ full_name: c.full_name || '', relation: c.relation || 'زوجة', residency_no: c.residency_no || '', birth_date: c.birth_date || '', education_level: c.education_level || '' })
    window.scrollTo({ top: 9999, behavior: 'smooth' })
  }
  function cancelEdit() { setEditId(null); setForm(empty) }

  async function delCompanion(id) {
    const ok = await confirmDialog({ title: 'حذف المرافق', message: 'سيُحذف المرافق وبياناته.', confirmText: 'احذف', danger: true })
    if (!ok) return
    const { error } = await supabase.rpc('delete_companion', { p_companion: id })
    if (error) toast('تعذّر الحذف', 'error')
    else { toast('تم الحذف'); load() }
  }

  return (
    <div>
      <h2 className="section-title">المرافقون</h2>
      {companions.map(c => (
        <div key={c.id} className="comp-card">
          <div className="comp-card-main">
            <div className="comp-avatar">👤</div>
            <div className="comp-details">
              <div className="comp-name-line">
                <strong>{c.full_name || 'مرافق'}</strong>
                <span className="pill">{c.relation}</span>
              </div>
              <div className="comp-meta">
                {c.age != null && <span>العمر: {c.age} سنة</span>}
                {c.residency_no && <span>إقامة: {c.residency_no}</span>}
                {c.education_level && <span>المستوى: {c.education_level}</span>}
              </div>
            </div>
          </div>
          <div className="comp-actions">
            <button className="comp-edit-btn" onClick={() => startEdit(c)}><Icon name="edit" size={14} /> تعديل</button>
            <button className="mini-del" onClick={() => delCompanion(c.id)}>حذف</button>
          </div>
        </div>
      ))}
      {companions.length === 0 && <div className="muted" style={{ marginBottom: 12 }}>لا يوجد مرافقون بعد.</div>}

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>{editId ? 'تعديل بيانات المرافق' : 'إضافة مرافق'}</h3>
        <div className="field"><label>اسم المرافق</label>
          <input placeholder="الاسم الكامل" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="form-row">
          <div className="field" style={{ flex: 1 }}><label>صلة القرابة</label>
            <select value={form.relation} onChange={e => setForm({ ...form, relation: e.target.value })}>
              {RELATIONS.map(r => <option key={r}>{r}</option>)}
            </select></div>
          <div className="field" style={{ flex: 1 }}><label>تاريخ الميلاد</label>
            <input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="field" style={{ flex: 1 }}><label>رقم الإقامة</label>
            <input placeholder="رقم الإقامة" value={form.residency_no} onChange={e => setForm({ ...form, residency_no: e.target.value })} dir="ltr" /></div>
          <div className="field" style={{ flex: 1 }}><label>المستوى الدراسي</label>
            <select value={form.education_level} onChange={e => setForm({ ...form, education_level: e.target.value })}>
              <option value="">— اختر (اختياري) —</option>
              {EDU_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="save-btn" style={{ width: 'auto', padding: '11px 22px' }} onClick={submit} disabled={busy}>
            {busy ? 'جارٍ…' : editId ? 'حفظ التعديل' : 'إضافة مرافق'}
          </button>
          {editId && <button className="mini" onClick={cancelEdit}>إلغاء</button>}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>ملفات المرافق (الإقامة والجواز) تُرفع من تبويب «المرفقات».</p>
      </div>
    </div>
  )
}
