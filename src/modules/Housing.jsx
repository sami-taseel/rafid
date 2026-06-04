import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import UnitInspection from './UnitInspection'

export default function Housing() {
  const [buildings, setBuildings] = useState([])
  const [violations, setViolations] = useState([])
  const [sanctions, setSanctions] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [nv, setNv] = useState({ student_id: '', description: '', occurred_at: '' })
  const [msg, setMsg] = useState(null)

  async function loadAll() {
    const [b, v, s, sn] = await Promise.all([
      supabase.from('buildings').select('*'),
      supabase.from('violations').select('*, students(persons(full_name))').order('created_at', { ascending: false }),
      supabase.from('students').select('id, persons(full_name)'),
      supabase.from('sanctions').select('*, students(persons(full_name))').order('created_at', { ascending: false }),
    ])
    setBuildings(b.data || []); setViolations(v.data || []); setStudents(s.data || []); setSanctions(sn.data || []); setLoading(false)
  }

  async function confirmEviction(id) {
    if (!confirm('تأكيد إخلاء السكن لهذا الطالب؟ هذا قرار مهم.')) return
    await supabase.from('sanctions').update({ status: 'confirmed' }).eq('id', id); loadAll()
  }
  async function cancelSanction(id) {
    await supabase.from('sanctions').update({ status: 'cancelled' }).eq('id', id); loadAll()
  }
  useEffect(() => { loadAll() }, [])

  async function addViolation() {
    if (!nv.student_id || !nv.description) { setMsg('اختر الطالب واكتب الوصف'); return }
    await supabase.from('violations').insert(nv)
    setNv({ student_id: '', description: '', occurred_at: '' }); setMsg('سُجّلت المخالفة'); loadAll()
  }

    if (loading) return <Spinner />
  return (
    <div>
      <div className="stats">
        <div className="stat-card"><div className="num">{buildings.length}</div><div className="label">العمارات</div></div>
        <div className="stat-card"><div className="num">{violations.length}</div><div className="label">المخالفات</div></div>
      </div>
      <div className="panel">
        <h3>العمارات</h3>
        {buildings.map(b => <div key={b.id} className="list-line">🏢 {b.name}</div>)}
      </div>
      <div className="panel">
        <h3>تسجيل مخالفة</h3>
        <div className="form-row">
          <select value={nv.student_id} onChange={e => setNv({ ...nv, student_id: e.target.value })}>
            <option value="">اختر الطالب…</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.persons?.full_name}</option>)}
          </select>
          <input placeholder="وصف المخالفة" value={nv.description} onChange={e => setNv({ ...nv, description: e.target.value })} />
          <input type="date" value={nv.occurred_at} onChange={e => setNv({ ...nv, occurred_at: e.target.value })} />
          <button onClick={addViolation}>تسجيل</button>
        </div>
        {msg && <div className="save-ok">{msg}</div>}
      </div>
      <UnitInspection units={[]} students={students} />
      <div className="panel">
        <h3>الجزاءات الآلية</h3>
        {sanctions.length === 0 && <div className="muted">لا توجد جزاءات.</div>}
        {sanctions.map(sn => (
          <div key={sn.id} className="sanction-row">
            <span className={'sanc-level ' + sn.level}>{sanctionLabel(sn.level)}</span>
            <span style={{ flex: 1 }}>{sn.students?.persons?.full_name}</span>
            <span className="muted">{sn.cited_article}</span>
            {sn.status === 'pending_review' && (
              <span className="sanc-actions">
                <span className="pill" style={{ background: '#fbe4d5', color: '#ba7517' }}>معلّق</span>
                <button className="mini" onClick={() => confirmEviction(sn.id)}>تأكيد الإخلاء</button>
                <button className="fr-del" onClick={() => cancelSanction(sn.id)}>إلغاء</button>
              </span>
            )}
            {sn.status === 'confirmed' && <span className="pill" style={{ background:'#fcecec', color:'#a32d2d' }}>مؤكّد</span>}
            {sn.status === 'active' && <span className="pill">نافذ</span>}
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>سجل المخالفات</h3>
        {violations.map(v => (
          <div key={v.id} className="list-line">
            ⚠️ {v.students?.persons?.full_name} — {v.description} <span className="muted">{v.occurred_at}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function sanctionLabel(l) { return { notice: 'لفت نظر', warning: 'إنذار كتابي', eviction: 'إخلاء سكن' }[l] || l }
