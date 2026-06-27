import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import QRCode from 'qrcode'
import QRModal, { canGenerateQR } from './QRModal'
import RescheduleModal from './RescheduleModal'
import Icon from '../Icon'

export default function Attendance() {
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [sel, setSel] = useState(null)
  const [marks, setMarks] = useState({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [qrSession, setQrSession] = useState(null)
  const [reschedule, setReschedule] = useState(null)

  // فتح نافذة الباركود (مع حارس التاريخ)
  function openQR(sess) {
    if (!canGenerateQR(sess)) {
      setMsg('لا يمكن توليد رمز الحضور قبل موعد الجلسة.')
      setTimeout(() => setMsg(null), 4000)
      return
    }
    setQrSession(sess)
  }

  // تبديل حالة «منعقدة» (منعقدة ⇄ مجدولة)
  async function toggleHeld(sess) {
    const next = sess.status === 'held' ? 'scheduled' : 'held'
    await supabase.from('sessions').update({ status: next }).eq('id', sess.id)
    setSessions(prev => prev.map(x => x.id === sess.id ? { ...x, status: next } : x))
  }
  // فتح نافذة التأجيل أو إلغاء التأجيل (مؤجلة → مجدولة)
  async function handlePostpone(sess) {
    if (sess.status === 'postponed') {
      // إلغاء التأجيل: نعيدها مجدولة (نُبقي التاريخ كما هو)
      await supabase.from('sessions').update({ status: 'scheduled' }).eq('id', sess.id)
      setSessions(prev => prev.map(x => x.id === sess.id ? { ...x, status: 'scheduled' } : x))
    } else {
      setReschedule(sess)  // نفتح نافذة تحديد الموعد الجديد
    }
  }
  // اعتماد التأجيل بموعد جديد (أو «إلى إشعار آخر»)
  async function confirmReschedule(newDate) {
    const sess = reschedule
    const payload = { status: 'postponed' }
    if (newDate) payload.planned_date = newDate   // null = إلى إشعار آخر (نُبقي التاريخ)
    await supabase.from('sessions').update(payload).eq('id', sess.id)
    setSessions(prev => prev.map(x => x.id === sess.id ? { ...x, ...payload } : x))
    setReschedule(null)
    setMsg(newDate ? 'تم تأجيل الجلسة إلى ' + newDate : 'تم تأجيل الجلسة إلى إشعار آخر')
    setTimeout(() => setMsg(null), 4000)
  }

  async function loadSessions() {
    const { data } = await supabase.from('sessions').select('id, title, planned_date, start_time, status, activities(title, tracks(name_ar))').order('planned_date', { ascending: false })
    setSessions(data || [])
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
            <button className="mini" onClick={() => openQR(sel)}>رمز QR للحضور</button>
          </div>
        </div>
        {msg && <div className="save-ok">{msg}</div>}
        {qrSession && <QRModal session={qrSession} onClose={() => setQrSession(null)} />}
        <div className="panel">
          <div className="bulk-bar">
            <button className="mini" onClick={() => { const m={}; students.forEach(s=>m[s.id]='present'); setMarks(m) }}>تحديد الكل حاضر</button>
            <button className="mini" onClick={() => setMarks({})}>مسح الكل</button>
          </div>
          <div className="att-list">
            {students.map(s => {
              const todayStr = new Date().toLocaleDateString('en-CA')
              const isPastSession = sel.planned_date && sel.planned_date < todayStr
              // إلغاء التحضير: نفس اليوم → بدون تحضير، بعد الموعد → غائب
              function clearMark() {
                if (isPastSession) setMarks({ ...marks, [s.id]: 'absent' })
                else { const m = { ...marks }; delete m[s.id]; setMarks(m) }
              }
              return (
                <div className="att-row" key={s.id}>
                  <span className="att-name">{s.persons?.full_name}</span>
                  <div className="att-btns">
                    {[['present','حاضر'],['absent','غائب'],['excused','مستأذن']].map(([v, l]) => (
                      <button key={v} className={marks[s.id] === v ? 'att-btn sel ' + v : 'att-btn'}
                        onClick={() => marks[s.id] === v ? clearMark() : setMarks({ ...marks, [s.id]: v })}>{l}</button>
                    ))}
                    {marks[s.id] && marks[s.id] !== 'not_recorded' && (
                      <button className="att-btn clear" title="إلغاء التحضير" onClick={clearMark}>
                        <Icon name="x" size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
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
        <button className="mini" style={{ float: 'left', marginInlineEnd: 8 }} onClick={async () => {
          const { data, error } = await supabase.rpc('auto_mark_absent')
          if (error) { setMsg('تعذّر رصد الغياب التلقائي'); }
          else { setMsg('تم رصد الغياب التلقائي للجلسات المنتهية (' + (data || 0) + ' سجل)'); loadSessions() }
          setTimeout(() => setMsg(null), 5000)
        }}>⚡ رصد الغياب للجلسات المنتهية</button>
      </h3>
      {sessions.length === 0 && <div className="panel muted">لا توجد جلسات بعد. أضِفها من وحدة المسارات والأنشطة.</div>}
      <div className="session-cards">
        {sessions.map(s => {
          const sessName = s.title || s.activities?.title || 'جلسة'
          const actTitle = s.activities?.title && s.activities.title !== sessName ? s.activities.title : null
          const todayStr = new Date().toLocaleDateString('en-CA')
          const isFuture = s.planned_date && s.planned_date > todayStr
          return (
            <div className={'session-card' + (isFuture ? ' locked' : '')} key={s.id}>
              <div className="sc-clickable" onClick={() => openSession(s)} role="button" tabIndex={0}>
                <div className="sc-title">{sessName}</div>
                {actTitle && <div className="sc-act-name">{actTitle}</div>}
                <div className="sc-meta">{s.activities?.tracks?.name_ar}</div>
                <div className="sc-date">📅 {s.planned_date || 'بلا تاريخ'}</div>
                {isFuture && <div className="sc-locked-note">🔒 يُتاح التحضير يوم الجلسة</div>}
                <span className={'sc-status status-' + s.status}>{statusLabel(s.status)}</span>
              </div>
              {/* شريط الأيقونات الثلاث */}
              <div className="sc-icons">
                <button className={'sc-ico' + (isFuture ? ' disabled' : '')} title="باركود الحضور" disabled={isFuture}
                  onClick={() => openQR(s)}>
                  <Icon name="image" size={16} /><span>باركود</span>
                </button>
                <button className={'sc-ico' + (s.status === 'held' ? ' active' : '')} title={s.status === 'held' ? 'إلغاء الانعقاد' : 'منعقدة'}
                  onClick={() => toggleHeld(s)}>
                  <Icon name="check" size={16} /><span>{s.status === 'held' ? 'منعقدة ✓' : 'منعقدة'}</span>
                </button>
                <button className={'sc-ico' + (s.status === 'postponed' ? ' active warn' : '')} title={s.status === 'postponed' ? 'إلغاء التأجيل' : 'تأجيل'}
                  onClick={() => handlePostpone(s)}>
                  <Icon name="clock" size={16} /><span>{s.status === 'postponed' ? 'مؤجلة' : 'تأجيل'}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {reschedule && <RescheduleModal session={reschedule} onConfirm={confirmReschedule} onClose={() => setReschedule(null)} />}
    </div>
  )
}
function statusLabel(s) {
  return { scheduled: 'مجدولة', held: 'منعقدة', postponed: 'مؤجلة', cancelled: 'ملغاة', holiday: 'إجازة' }[s] || s
}
