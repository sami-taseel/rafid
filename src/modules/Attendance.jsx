import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function Attendance() {
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [sel, setSel] = useState(null)
  const [marks, setMarks] = useState({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('sessions').select('id, planned_date, status, activities(title, tracks(name_ar))').order('planned_date', { ascending: false }),
      supabase.from('students').select('id, persons(full_name)'),
    ]).then(([s, st]) => { setSessions(s.data || []); setStudents(st.data || []); setLoading(false) })
  }, [])

  async function openSession(sess) {
    setSel(sess)
    const { data } = await supabase.from('attendance').select('student_id, status').eq('session_id', sess.id)
    const m = {}; (data || []).forEach(r => m[r.student_id] = r.status); setMarks(m)
  }
  async function save() {
    const rows = students.map(s => ({ session_id: sel.id, student_id: s.id, status: marks[s.id] || 'not_recorded' }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,student_id' })
    setMsg(error ? 'خطأ: ' + error.message : 'تم حفظ الحضور بنجاح')
    setTimeout(() => setMsg(null), 2000)
  }

  if (loading) return <Spinner />

  if (sel) {
    const present = Object.values(marks).filter(v => v === 'present').length
    const absent = Object.values(marks).filter(v => v === 'absent').length
    return (
      <div>
        <button className="mini" onClick={() => setSel(null)}>→ رجوع للجلسات</button>
        <div className="att-header">
          <div>
            <h3>{sel.activities?.title}</h3>
            <span className="muted">{sel.activities?.tracks?.name_ar} · {sel.planned_date}</span>
          </div>
          <div className="att-counters">
            <span className="cnt present">حاضر {present}</span>
            <span className="cnt absent">غائب {absent}</span>
          </div>
        </div>
        {msg && <div className="save-ok">{msg}</div>}
        <div className="panel">
          <div className="att-list">
            {students.map(s => (
              <div className="att-row" key={s.id}>
                <span className="att-name">{s.persons?.full_name}</span>
                <div className="att-btns">
                  {[['present','حاضر'],['absent','غائب'],['excused','مستأذن']].map(([v, l]) => (
                    <button key={v} className={marks[s.id] === v ? 'att-btn sel ' + v : 'att-btn'}
                      onClick={() => setMarks({ ...marks, [s.id]: v })}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button className="save-btn" onClick={save}>حفظ الحضور</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="section-title">اختر جلسة لرصد حضورها</h3>
      {sessions.length === 0 && <div className="panel muted">لا توجد جلسات بعد. أضِفها من وحدة المسارات والأنشطة.</div>}
      <div className="session-cards">
        {sessions.map(s => (
          <button className="session-card" key={s.id} onClick={() => openSession(s)}>
            <div className="sc-title">{s.activities?.title || 'نشاط'}</div>
            <div className="sc-meta">{s.activities?.tracks?.name_ar}</div>
            <div className="sc-date">📅 {s.planned_date || 'بلا تاريخ'}</div>
            <span className={'sc-status status-' + s.status}>{statusLabel(s.status)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
function statusLabel(s) {
  return { scheduled: 'مجدولة', held: 'منعقدة', postponed: 'مؤجلة', cancelled: 'ملغاة', holiday: 'إجازة' }[s] || s
}
