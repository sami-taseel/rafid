import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'

// إدارة المرافقين ورفع الملفات — تُستخدم داخل ملف الطالب
export default function Companions({ studentId, personId }) {
  const toast = useToast()
  const [companions, setCompanions] = useState([])
  const [docs, setDocs] = useState([])
  const [nc, setNc] = useState({ full_name: '', relation: 'زوجة', residency_no: '' })
  const [uploading, setUploading] = useState(false)

  async function load() {
    const { data: c } = await supabase.from('companions')
      .select('id, relation, persons(full_name, residency_no)').eq('student_id', studentId)
    setCompanions(c || [])
    const { data: d } = await supabase.from('documents').select('*').eq('student_id', studentId)
    setDocs(d || [])
  }
  useEffect(() => { if (studentId) load() }, [studentId])

  async function addCompanion() {
    if (!nc.full_name.trim()) { toast('اكتب اسم المرافق', 'error'); return }
    const { data: p } = await supabase.from('persons')
      .insert({ full_name: nc.full_name, residency_no: nc.residency_no }).select().single()
    await supabase.from('companions').insert({ person_id: p.id, student_id: studentId, relation: nc.relation })
    setNc({ full_name: '', relation: 'زوجة', residency_no: '' }); toast('أُضيف المرافق'); load()
  }

  async function uploadDoc(e, docType) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    const path = `${personId}/${docType}_${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('student-docs').upload(path, file)
    if (!error) {
      await supabase.from('documents').insert({ student_id: studentId, person_id: personId, doc_type: docType, file_path: path })
      toast('تم رفع الملف')
    } else setMsg('خطأ في الرفع: ' + error.message)
    setUploading(false); load()
  }

  return (
    <div>
      <h2 className="section-title">المرافقون</h2>
      {companions.map(c => (
        <div key={c.id} className="list-line">
          👤 {c.persons?.full_name} <span className="pill">{c.relation}</span>
          <span className="muted"> {c.persons?.residency_no}</span>
        </div>
      ))}
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="form-row">
          <input placeholder="اسم المرافق" value={nc.full_name} onChange={e => setNc({ ...nc, full_name: e.target.value })} />
          <select value={nc.relation} onChange={e => setNc({ ...nc, relation: e.target.value })}>
            {['زوجة','زوج','ابن','ابنة'].map(r => <option key={r}>{r}</option>)}
          </select>
          <input placeholder="رقم الإقامة" value={nc.residency_no} onChange={e => setNc({ ...nc, residency_no: e.target.value })} dir="ltr" />
          <button onClick={addCompanion}>إضافة مرافق</button>
        </div>
      </div>

      <h2 className="section-title">المستندات</h2>
      <div className="docs-upload">
        {['صورة الإقامة', 'السجل الأكاديمي', 'الشهادات'].map(dt => (
          <label key={dt} className="upload-card">
            <span>{dt}</span>
            <span className="upload-btn">{uploading ? 'جارٍ…' : '⬆ رفع'}</span>
            <input type="file" hidden onChange={e => uploadDoc(e, dt)} />
          </label>
        ))}
      </div>
      {docs.length > 0 && (
        <div className="panel" style={{ marginTop: 12 }}>
          {docs.map(d => <div key={d.id} className="list-line">📎 {d.doc_type} <span className="muted">{new Date(d.uploaded_at).toLocaleDateString('ar')}</span></div>)}
        </div>
      )}
    </div>
  )
}
