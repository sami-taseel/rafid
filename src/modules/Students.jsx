import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export function Spinner() { return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div> }
export function Stat({ num, label }) { return <div className="stat-card"><div className="num">{num}</div><div className="label">{label}</div></div> }

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase.from('students')
      .select('id, degree_level, persons(full_name, nationality, residency_no, phone)')
      .then(({ data }) => { setStudents(data || []); setLoading(false) })
  }, [])

  if (loading) return <Spinner />
  const filtered = students.filter(s =>
    (s.persons?.full_name || '').includes(q) || (s.persons?.nationality || '').includes(q))
  const byDeg = students.reduce((a, s) => { const d = s.degree_level || 'غير محدد'; a[d] = (a[d]||0)+1; return a }, {})
  const nats = new Set(students.map(s => s.persons?.nationality).filter(Boolean)).size

  return (
    <div>
      <div className="stats">
        <Stat num={students.length} label="إجمالي الطلاب" />
        <Stat num={nats} label="عدد الجنسيات" />
        {Object.entries(byDeg).map(([d, n]) => <Stat key={d} num={n} label={d} />)}
      </div>
      <input className="search" placeholder="بحث بالاسم أو الجنسية…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="cards-view">
        {filtered.map((s) => (
          <div className="student-card" key={s.id}>
            <div className="card-head">
              <div className="avatar">{(s.persons?.full_name || '؟').trim().charAt(0)}</div>
              <div className="card-name">
                <div className="name">{s.persons?.full_name || '—'}</div>
                <div className="degree">{s.degree_level || '—'}</div>
              </div>
              {s.persons?.nationality && <span className="pill">{s.persons.nationality}</span>}
            </div>
            <div className="card-body">
              <span className="muted">الجوال: {s.persons?.phone || '—'}</span>
              <span className="muted">الإقامة: {s.persons?.residency_no || '—'}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>الاسم</th><th>الجنسية</th><th>المرحلة</th><th>الإقامة</th><th>الجوال</th></tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id}>
                <td className="muted">{i+1}</td>
                <td>{s.persons?.full_name || '—'}</td>
                <td>{s.persons?.nationality ? <span className="pill">{s.persons.nationality}</span> : '—'}</td>
                <td>{s.degree_level || '—'}</td>
                <td className="muted">{s.persons?.residency_no || '—'}</td>
                <td className="muted">{s.persons?.phone || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
