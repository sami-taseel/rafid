import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import QRCode from 'qrcode'

export default function Attendance() {
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [sel, setSel] = useState(null)
  const [marks, setMarks] = useState({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [qr, setQr] = useState(null)

  async function showQR(sessionId) {
    // حارس إضافي: لا QR قبل يوم الجلسة (الخادم يمنع التحضير أيضاً)
    const todayStr = new Date().toLocaleDateString('en-CA')
    if (sel?.planned_date && sel.planned_date > todayStr) {
      setMsg('لا يمكن توليد رمز الحضور قبل موعد الجلسة.')
      setTimeout(() => setMsg(null), 4000)
      return
    }
    const url = window.location.origin + '/#checkin=' + sessionId
    const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2 })
    setQr(dataUrl)
  }

  useEffect(() => {
    Promise.all([
      supabase.from('sessions').select('id, title, planned_date, start_time, status, activities(title, tracks(name_ar))').order('planned_date', { ascending: false }),
      supabase.from('students').select('id, persons(full_name)'),
    ]).then(([s, st]) => { setSessions(s.data || []); setStudents(st.data || []); setLoading(false) })
  }, [])

  async function openSession(sess) {
    // منع التحضير قبل يوم الجلسة (يُتاح في يوم الجلسة فأحدث)
    const todayStr = new Date().toLocaleDateString('en-CA')
    if (sess.planned_date && sess.planned_date > todayStr) {
      setMsg('لا يمكن رصد الحضور قبل موعد الجلسة. يُتاح التحضير في يوم الجلسة (' + sess.planned_date + ').')
      setTimeout(() => setMsg(null), 5000)
      return
    }
    setSel(sess)
    const { data } = await supabase.from('attendance').select('student_id, status').eq('session_id', sess.id)
    const m = {}; (data || []).forEach(r => m[r.student_id] = r.status); setMarks(m)
  }
  async function save() {
    const rows = students.map(s => ({ session_id: sel.id, student_id: s.id, status: marks[s.id] || 'not_recorded' }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,student_id' })
    if (error) { setMsg('خطأ: ' + error.message); return }
    // فحص آلي للإنذار لكل طالب غائب
    let warnings = []
    for (const s of students) {
      if (marks[s.id] === 'absent') {
        const { data } = await supabase.rpc('check_and_generate_sanction', { p_student: s.id })
        if (data && !data.includes('لا يوجد')) warnings.push(s.persons?.full_name + ': ' + data)
      }
    }
    setMsg('تم حفظ الحضور بنجاح' + (warnings.length ? ' — تنبيهات: ' + warnings.join(' | ') : ''))
    setTimeout(() => setMsg(null), 5000)
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
            <h3>{sel.title || sel.activities?.title || 'جلسة'}</h3>
            <span className="muted">{sel.activities?.title && sel.activities.title !== (sel.title || sel.activities?.title) ? sel.activities.title + ' · ' : ''}{sel.activities?.tracks?.name_ar} · {sel.planned_date}</span>
          </div>
          <div className="att-counters">
            <span className="cnt present">حاضر {present}</span>
            <span className="cnt absent">غائب {absent}</span>
            <button className="mini" onClick={() => showQR(sel.id)}>رمز QR للحضور</button>
          </div>
        </div>
        {msg && <div className="save-ok">{msg}</div>}
        {qr && (
          <div className="qr-overlay" onClick={() => setQr(null)}>
            <div className="qr-box" onClick={e => e.stopPropagation()}>
              <h3>رمز حضور الجلسة</h3>
              <p className="muted">يمسحه الطلاب بكاميرا الجوال لتسجيل حضورهم</p>
              <img src={qr} alt="QR" />
              <button className="mini" onClick={() => setQr(null)}>إغلاق</button>
            </div>
          </div>
        )}
        <div className="panel">
          <div className="bulk-bar">
            <button className="mini" onClick={() => { const m={}; students.forEach(s=>m[s.id]='present'); setMarks(m) }}>تحديد الكل حاضر</button>
            <button className="mini" onClick={() => setMarks({})}>مسح الكل</button>
          </div>
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
      <h3 className="section-title">اختر جلسة لرصد حضورها
        <button className="mini" style={{ float: 'left' }} onClick={async () => {
          const XLSX = await import('xlsx')
          const { data } = await supabase.from('attendance').select('status, students(persons(full_name)), sessions(planned_date, activities(title))')
          const rows = (data || []).map(a => ({ 'الطالب': a.students?.persons?.full_name || '', 'النشاط': a.sessions?.activities?.title || '', 'التاريخ': a.sessions?.planned_date || '', 'الحالة': a.status === 'present' ? 'حاضر' : a.status === 'absent' ? 'غائب' : a.status }))
          const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'الحضور'); XLSX.writeFile(wb, 'سجل_الحضور.xlsx')
        }}>⬇ تصدير سجل الحضور</button>
      </h3>
      {sessions.length === 0 && <div className="panel muted">لا توجد جلسات بعد. أضِفها من وحدة المسارات والأنشطة.</div>}
      <div className="session-cards">
        {sessions.map(s => {
          const sessName = s.title || s.activities?.title || 'جلسة'
          const actTitle = s.activities?.title && s.activities.title !== sessName ? s.activities.title : null
          const todayStr = new Date().toLocaleDateString('en-CA')  // YYYY-MM-DD محلي
          const isFuture = s.planned_date && s.planned_date > todayStr
          return (
            <button className={'session-card' + (isFuture ? ' locked' : '')} key={s.id} onClick={() => openSession(s)}>
              <div className="sc-title">{sessName}</div>
              {actTitle && <div className="sc-act-name">{actTitle}</div>}
              <div className="sc-meta">{s.activities?.tracks?.name_ar}</div>
              <div className="sc-date">📅 {s.planned_date || 'بلا تاريخ'}</div>
              {isFuture && <div className="sc-locked-note">🔒 يُتاح التحضير يوم الجلسة</div>}
              <span className={'sc-status status-' + s.status}>{statusLabel(s.status)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
function statusLabel(s) {
  return { scheduled: 'مجدولة', held: 'منعقدة', postponed: 'مؤجلة', cancelled: 'ملغاة', holiday: 'إجازة' }[s] || s
}
