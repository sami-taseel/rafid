import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import StudentDetail from './StudentDetail'

export function Spinner() { return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div> }
export function Stat({ num, label }) { return <div className="stat-card"><div className="num">{num}</div><div className="label">{label}</div></div> }

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fNat, setFNat] = useState('')
  const [fDeg, setFDeg] = useState('')
  const [fFile, setFFile] = useState('')
  const [sel, setSel] = useState(null)

  useEffect(() => {
    supabase.from('students')
      .select('id, degree_level, profile_reviewed, persons(full_name, nationality, residency_no, phone)')
      .then(({ data }) => { setStudents(data || []); setLoading(false) })
  }, [])

  if (loading) return <Spinner />
  if (sel) return <StudentDetail studentId={sel} onBack={() => setSel(null)} />

  const nats = [...new Set(students.map(s => s.persons?.nationality).filter(Boolean))]
  const degs = [...new Set(students.map(s => s.degree_level).filter(Boolean))]

  const filtered = students.filter(s => {
    const matchQ = !q || (s.persons?.full_name || '').includes(q) || (s.persons?.residency_no || '').includes(q)
    const matchN = !fNat || s.persons?.nationality === fNat
    const matchD = !fDeg || s.degree_level === fDeg
    const matchF = !fFile || (fFile === 'done' ? s.profile_reviewed : !s.profile_reviewed)
    return matchQ && matchN && matchD && matchF
  })

  const byDeg = students.reduce((a, s) => { const d = s.degree_level || 'غير محدد'; a[d] = (a[d]||0)+1; return a }, {})

  return (
    <div>
      <div className="stats">
        <Stat num={students.length} label="إجمالي الطلاب" />
        <Stat num={nats.length} label="عدد الجنسيات" />
        {Object.entries(byDeg).map(([d, n]) => <Stat key={d} num={n} label={d} />)}
      </div>

      <div className="filter-bar">
        <input className="search" placeholder="🔍 بحث بالاسم أو رقم الإقامة…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="filter-row">
          <select value={fNat} onChange={e => setFNat(e.target.value)}>
            <option value="">كل الجنسيات</option>
            {nats.map(n => <option key={n}>{n}</option>)}
          </select>
          <select value={fDeg} onChange={e => setFDeg(e.target.value)}>
            <option value="">كل المراحل</option>
            {degs.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={fFile} onChange={e => setFFile(e.target.value)}>
            <option value="">حالة الملف</option>
            <option value="done">مكتمل</option>
            <option value="pending">غير مكتمل</option>
          </select>
          {(q || fNat || fDeg || fFile) && <button className="mini" onClick={() => { setQ(''); setFNat(''); setFDeg(''); setFFile('') }}>مسح الفلاتر</button>}
        </div>
        <div className="result-count">{filtered.length} نتيجة</div>
      </div>

      <div className="cards-view">
        {filtered.map((s) => (
          <div className="student-card clickable" key={s.id} onClick={() => setSel(s.id)}>
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
          <thead><tr><th>#</th><th>الاسم</th><th>الجنسية</th><th>المرحلة</th><th>الإقامة</th><th>الملف</th></tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} className="clickable" onClick={() => setSel(s.id)}>
                <td className="muted">{i+1}</td>
                <td>{s.persons?.full_name || '—'}</td>
                <td>{s.persons?.nationality ? <span className="pill">{s.persons.nationality}</span> : '—'}</td>
                <td>{s.degree_level || '—'}</td>
                <td className="muted">{s.persons?.residency_no || '—'}</td>
                <td>{s.profile_reviewed ? <span className="pill-on">مكتمل</span> : <span className="pill-off">ناقص</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
