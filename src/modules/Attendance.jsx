import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function Attendance() {
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [selSession, setSelSession] = useState('')
  const [marks, setMarks] = useState({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('sessions').select('id, planned_date, activities(title)').order('planned_date', { ascending: false }),
      supabase.from('students').select('id, persons(full_name)'),
    ]).then(([s, st]) => { setSessions(s.data || []); setStudents(st.data || []); setLoading(false) })
  }, [])

  async function loadMarks(sid) {
    setSelSession(sid)
    const { data } = await supabase.from('attendance').select('student_id, status').eq('session_id', sid)
    const m = {}; (data || []).forEach(r => m[r.student_id] = r.status); setMarks(m)
  }
  function setMark(sid, status) { setMarks({ ...marks, [sid]: status }) }

  async function save() {
    const rows = students.map(s => ({ session_id: selSession, student_id: s.id, status: marks[s.id] || 'not_recorded' }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,student_id' })
    setMsg(error ? 'خطأ: ' + error.message : 'تم حفظ الحضور')
    setTimeout(() => setMsg(null), 2000)
  }

  if (loading) return <Spinner />
  return (
    <div>
      <div className="panel">
        <h3>اختر الجلسة لرصد الحضور</h3>
        <select value={selSession} onChange={e => loadMarks(e.target.value)} style={{ width: '100%' }}>
          <option value="">اختر…</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.activities?.title} — {s.planned_date}</option>)}
        </select>
      </div>
      {selSession && (
        <div className="panel">
          {msg && <div className="save-ok">{msg}</div>}
          <div className="att-list">
            {students.map(s => (
              <div className="att-row" key={s.id}>
                <span>{s.persons?.full_name}</span>
                <div className="att-btns">
                  {[['present','حاضر'],['absent','غائب'],['excused','مستأذن']].map(([v, l]) => (
                    <button key={v} className={marks[s.id] === v ? 'att-btn sel ' + v : 'att-btn'}
                      onClick={() => setMark(s.id, v)}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button className="save-btn" onClick={save}>حفظ الحضور</button>
        </div>
      )}
    </div>
  )
}
