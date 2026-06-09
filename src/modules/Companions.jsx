import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { useConfirm } from '../Confirm'

const EDU_LEVELS = ['ما قبل المدرسة', 'الروضة', 'الابتدائية', 'المتوسطة', 'الثانوية', 'الجامعية', 'دراسات عليا', 'غير ملتحق']

export default function Companions({ studentId, personId }) {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [companions, setCompanions] = useState([])
  const [nc, setNc] = useState({ full_name: '', relation: 'زوجة', residency_no: '', birth_date: '', education_level: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data: c } = await supabase.from('companions')
      .select('id, relation, education_level, persons(full_name, residency_no, birth_date)').eq('student_id', studentId)
    setCompanions(c || [])
  }
  useEffect(() => { if (studentId) load() }, [studentId])

  async function addCompanion() {
    if (!nc.full_name.trim()) { toast('اكتب اسم المرافق', 'error'); return }
    if (nc.residency_no && !/^2\d{9}$/.test(nc.residency_no.trim())) { toast('رقم الإقامة يجب أن يكون ١٠ أرقام ويبدأ بالرقم ٢', 'error'); return }
    setBusy(true)
    const { error } = await supabase.rpc('add_companion', {
      p_student: studentId, p_full_name: nc.full_name.trim(), p_relation: nc.relation,
      p_residency_no: nc.residency_no || null, p_birth_date: nc.birth_date || null,
      p_education_level: nc.education_level || null,
    })
    setBusy(false)
    if (error) { toast('تعذّرت الإضافة: ' + error.message, 'error'); return }
    setNc({ full_name: '', relation: 'زوجة', residency_no: '', birth_date: '', education_level: '' })
    toast('أُضيف المرافق'); load()
  }

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
                <strong>{c.persons?.full_name || '(بلا اسم)'}</strong>
                <span className="pill">{c.relation}</span>
              </div>
              <div className="comp-meta">
                {c.persons?.residency_no && <span>إقامة: {c.persons.residency_no}</span>}
                {c.persons?.birth_date && <span>الميلاد: {c.persons.birth_date}</span>}
                {c.education_level && <span>المستوى: {c.education_level}</span>}
              </div>
            </div>
          </div>
          <button className="mini-del" onClick={() => delCompanion(c.id)}>حذف</button>
        </div>
      ))}
      {companions.length === 0 && <div className="muted" style={{ marginBottom: 12 }}>لا يوجد مرافقون بعد.</div>}

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>إضافة مرافق</h3>
        <div className="field"><label>اسم المرافق</label>
          <input placeholder="الاسم الكامل" value={nc.full_name} onChange={e => setNc({ ...nc, full_name: e.target.value })} /></div>
        <div className="form-row">
          <div className="field" style={{ flex: 1 }}><label>صلة القرابة</label>
            <select value={nc.relation} onChange={e => setNc({ ...nc, relation: e.target.value })}>
              {['زوجة', 'زوج', 'ابن', 'ابنة', 'والد', 'والدة', 'أخ', 'أخت'].map(r => <option key={r}>{r}</option>)}
            </select></div>
          <div className="field" style={{ flex: 1 }}><label>تاريخ الميلاد</label>
            <input type="date" value={nc.birth_date} onChange={e => setNc({ ...nc, birth_date: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>رقم الإقامة</label>
            <input placeholder="رقم الإقامة" value={nc.residency_no} onChange={e => setNc({ ...nc, residency_no: e.target.value })} dir="ltr" /></div>
        </div>
        <div className="field"><label>المستوى الدراسي</label>
          <select value={nc.education_level} onChange={e => setNc({ ...nc, education_level: e.target.value })}>
            <option value="">— اختر (اختياري) —</option>
            {EDU_LEVELS.map(l => <option key={l}>{l}</option>)}
          </select></div>
        <button className="save-btn" style={{ width: 'auto', padding: '11px 22px' }} onClick={addCompanion} disabled={busy}>
          {busy ? 'جارٍ…' : 'إضافة مرافق'}
        </button>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>ملفات المرافق (الإقامة والجواز) تُرفع من تبويب «المرفقات».</p>
      </div>
    </div>
  )
}
