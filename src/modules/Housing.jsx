import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function Housing() {
  const [buildings, setBuildings] = useState([])
  const [violations, setViolations] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [nv, setNv] = useState({ student_id: '', description: '', occurred_at: '' })
  const [msg, setMsg] = useState(null)

  async function loadAll() {
    const [b, v, s] = await Promise.all([
      supabase.from('buildings').select('*'),
      supabase.from('violations').select('*, students(persons(full_name))').order('created_at', { ascending: false }),
      supabase.from('students').select('id, persons(full_name)'),
    ])
    setBuildings(b.data || []); setViolations(v.data || []); setStudents(s.data || []); setLoading(false)
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
