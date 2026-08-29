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
  const [sessStudents, setSessStudents] = useState(null)  // [{student_id, full_name, target_type}]
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
    // تصنيف الطلاب: إلزامي (رئيسي) / اختياري (ثانوي)
    const { data: ss } = await supabase.rpc('session_students', { p_session: sess.id })
    setSessStudents(ss || null)
  }
  async function save() {
    const rows = students.map(s => ({ session_id: sel.id, student_id: s.id, status: marks[s.id] || 'not_recorded' }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,student_id' })
    if (error) { setMsg('خطأ: ' + error.message); return }
    // منح النقاط والدرجات لكل حاضر (رئيسي: درجة+نقطتان، ثانوي: نقطة)
    for (const sid of Object.keys(marks)) {
      if (marks[sid] === 'present' || marks[sid] === 'recorded') {
        await supabase.rpc('award_attendance_reward', { p_student: sid, p_session: sel.id }).then(r => r, () => {})
      }
    }
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
    const excused = Object.values(marks).filter(v => v === 'excused').length
    const recorded = Object.values(marks).filter(v => v === 'recorded').length
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
            <span className="cnt excused">مستأذن {excused}</span>
            <span className="cnt recorded">استماع {recorded}</span>
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
          {(() => {
            const todayStr = new Date().toLocaleDateString('en-CA')
            const isPastSession = sel.planned_date && sel.planned_date < todayStr
            function clearMark(sid) {
              if (isPastSession) setMarks({ ...marks, [sid]: 'absent' })
              else { const m = { ...marks }; delete m[sid]; setMarks(m) }
            }
            function Row({ sid, name }) {
              return (
                <div className="att-row" key={sid}>
                  <span className="att-name">{name}</span>
                  <div className="att-btns">
                    {[['present','حاضر'],['absent','غائب'],['excused','مستأذن'],['recorded','استماع']].map(([v, l]) => (
                      <button key={v} className={marks[sid] === v ? 'att-btn sel ' + v : 'att-btn'}
                        onClick={() => marks[sid] === v ? clearMark(sid) : setMarks({ ...marks, [sid]: v })}>{l}</button>
                    ))}
                    {marks[sid] && marks[sid] !== 'not_recorded' && (
                      <button className="att-btn clear" title="إلغاء التحضير" onClick={() => clearMark(sid)}>
                        <Icon name="x" size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            }
            // إن توفّر التصنيف نعرض قسمين، وإلا نعرض الكل كالسابق
            if (sessStudents && sessStudents.length) {
              const prim = sessStudents.filter(x => x.target_type === 'primary')
              const sec = sessStudents.filter(x => x.target_type === 'secondary')
              return (
                <>
                  <div className="att-group">
                    <div className="att-group-head primary">
                      <Icon name="check" size={15} /> حضور إلزامي ({prim.length})
                      <span className="att-group-note">درجة + نقطتان عند الحضور</span>
                    </div>
                    <div className="att-list">
                      {prim.map(x => <Row key={x.student_id} sid={x.student_id} name={x.full_name} />)}
                      {prim.length === 0 && <div className="muted" style={{ padding: 12 }}>لا طلاب في الفئات الرئيسية.</div>}
                    </div>
                  </div>
                  {sec.length > 0 && (
                    <div className="att-group">
                      <div className="att-group-head secondary">
                        <Icon name="star" size={15} /> حضور اختياري ({sec.length})
                        <span className="att-group-note">نقطة واحدة عند الحضور · لا يُرصد غياب</span>
                      </div>
                      <div className="att-list">
                        {sec.map(x => <Row key={x.student_id} sid={x.student_id} name={x.full_name} />)}
                      </div>
                    </div>
                  )}
                </>
              )
            }
            return (
              <div className="att-list">
                {students.map(s => <Row key={s.id} sid={s.id} name={s.persons?.full_name} />)}
              </div>
            )
          })()}
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
      {qrSession && <QRModal session={qrSession} onClose={() => setQrSession(null)} />}
      {reschedule && <RescheduleModal session={reschedule} onConfirm={confirmReschedule} onClose={() => setReschedule(null)} />}
    </div>
  )
}
function statusLabel(s) {
  return { scheduled: 'مجدولة', held: 'منعقدة', postponed: 'مؤجلة', cancelled: 'ملغاة', holiday: 'إجازة' }[s] || s
}
