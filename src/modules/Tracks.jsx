import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import ExcelImport from './ExcelImport'

export default function Tracks() {
  const [tracks, setTracks] = useState([])
  const [activities, setActivities] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [sessFor, setSessFor] = useState(null)   // النشاط الذي نضيف له جلسة
  const [sessForm, setSessForm] = useState({ title: '', planned_date: '', start_time: '', duration_min: '' })
  const [newAct, setNewAct] = useState({ title: '', activity_type: 'درس', provider: '', location: '', track_code: '' })
  const [msg, setMsg] = useState(null)

  async function loadAll() {
    const [t, a, s] = await Promise.all([
      supabase.from('tracks').select('*').order('name_ar'),
      supabase.from('activities').select('*, tracks(name_ar, code)').order('created_at', { ascending: false }),
      supabase.from('sessions').select('*, activities(title)').order('planned_date', { ascending: false }),
    ])
    setTracks(t.data || []); setActivities(a.data || []); setSessions(s.data || [])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  async function addActivity() {
    if (!newAct.title || !newAct.track_code) { setMsg('اكتب اسم النشاط واختر المسار'); return }
    const track = tracks.find(t => t.code === newAct.track_code)
    await supabase.from('activities').insert({
      title: newAct.title, activity_type: newAct.activity_type,
      provider: newAct.provider, location: newAct.location, track_id: track?.id,
    })
    setNewAct({ title: '', activity_type: 'درس', provider: '', location: '', track_code: '' })
    setMsg('أُضيف النشاط'); loadAll()
  }

  async function saveSession() {
    if (!sessForm.planned_date) { setMsg('اختر تاريخ الجلسة'); return }
    const act = activities.find(a => a.id === sessFor)
    // اسم تلقائي إن تُرك فارغاً
    let title = sessForm.title
    if (!title) {
      const count = sessions.filter(s => s.activity_id === sessFor).length
      title = (act?.activity_type || 'جلسة') + ' ' + (count + 1)
    }
    await supabase.from('sessions').insert({
      activity_id: sessFor, planned_date: sessForm.planned_date,
      start_time: sessForm.start_time || null, duration_min: sessForm.duration_min ? Number(sessForm.duration_min) : null,
      title, status: 'scheduled',
    })
    setSessFor(null); setSessForm({ title: '', planned_date: '', start_time: '', duration_min: '' })
    loadAll()
  }

  async function setSessionStatus(id, status) {
    await supabase.from('sessions').update({ status }).eq('id', id); loadAll()
  }

  if (loading) return <Spinner />
  return (
    <div>
      <div className="stats">
        <div className="stat-card"><div className="num">{tracks.length}</div><div className="label">المسارات</div></div>
        <div className="stat-card"><div className="num">{activities.length}</div><div className="label">الأنشطة</div></div>
        <div className="stat-card"><div className="num">{sessions.length}</div><div className="label">الجلسات</div></div>
      </div>

      <div className="panel">
        <h3>إضافة نشاط جديد</h3>
        <div className="form-row">
          <select value={newAct.track_code} onChange={e => setNewAct({ ...newAct, track_code: e.target.value })}>
            <option value="">اختر المسار…</option>
            {tracks.map(t => <option key={t.id} value={t.code}>{t.name_ar}</option>)}
          </select>
          <input placeholder="اسم النشاط" value={newAct.title} onChange={e => setNewAct({ ...newAct, title: e.target.value })} />
          <select value={newAct.activity_type} onChange={e => setNewAct({ ...newAct, activity_type: e.target.value })}>
            {['درس','دورة','يوم علمي','مناقشة','رحلة','لقاء','محاضرة'].map(t => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="المقدّم" value={newAct.provider} onChange={e => setNewAct({ ...newAct, provider: e.target.value })} />
          <input placeholder="المكان" value={newAct.location} onChange={e => setNewAct({ ...newAct, location: e.target.value })} />
          <button onClick={addActivity}>إضافة</button>
        </div>
        {msg && <div className="save-ok">{msg}</div>}
      </div>

      <div className="panel">
        <h3>إضافة جلسات دفعة واحدة من Excel</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          ارفع الجلسات، وستُنشأ الأنشطة تلقائياً منها دون تكرار. لو تكرر اسم النشاط والمسار،
          تُضاف الجلسة للنشاط نفسه. اترك اسم الجلسة فارغاً ليُسمّى تلقائياً (مثل: درس ١، درس ٢).
        </p>
        <ExcelImport
          title="الجلسات"
          mode="rpc"
          rpcName="add_session_smart"
          columns={[
            { key: 'p_activity_title', label: 'اسم النشاط', sample: 'شرح كتاب التوحيد' },
            { key: 'p_activity_type', label: 'نوع النشاط', sample: 'درس' },
            { key: 'p_track_code', label: 'رمز المسار', sample: 'educational' },
            { key: 'p_provider', label: 'المقدّم', sample: 'الشيخ فلان' },
            { key: 'p_location', label: 'المكان', sample: 'القاعة الكبرى' },
            { key: 'p_date', label: 'تاريخ الجلسة', sample: '2026-06-10' },
            { key: 'p_start', label: 'وقت البدء', sample: '17:00' },
            { key: 'p_duration', label: 'المدة (دقيقة)', sample: '60' },
            { key: 'p_session_title', label: 'اسم الجلسة (اختياري)', sample: '' },
          ]}
          transform={(r) => ({
            p_activity_title: r.p_activity_title, p_activity_type: r.p_activity_type,
            p_track_code: r.p_track_code, p_provider: r.p_provider, p_location: r.p_location,
            p_date: r.p_date, p_start: r.p_start || null,
            p_duration: r.p_duration ? Number(r.p_duration) : null,
            p_session_title: r.p_session_title || null,
          })}
          onDone={loadAll}
        />
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          رموز المسارات: educational, skills, social, care, applied, companions
        </div>
      </div>

      <h3 className="section-title">الأنشطة والجلسات</h3>
      {activities.map(a => (
        <div className="panel" key={a.id}>
          <div className="act-head">
            <div>
              <strong>{a.title}</strong>
              <span className="pill" style={{ marginRight: 8 }}>{a.tracks?.name_ar}</span>
              <span className="muted"> {a.activity_type} {a.provider && '· ' + a.provider} {a.location && '· ' + a.location}</span>
            </div>
            <button className="mini" onClick={() => { setSessFor(a.id); setSessForm({ title: '', planned_date: '', start_time: '', duration_min: '' }) }}>+ جلسة</button>
          </div>
          <div className="sessions">
            {sessions.filter(s => s.activity_id === a.id).map(s => (
              <div className="session-row" key={s.id}>
                <span className="sess-name">{s.title || 'جلسة'}</span>
                <span className="muted">{s.planned_date}{s.start_time ? ' · ' + s.start_time.slice(0,5) : ''}{s.duration_min ? ' · ' + s.duration_min + 'د' : ''}</span>
                <span className={'status-' + s.status}>{statusLabel(s.status)}</span>
                <div className="sess-actions">
                  <button className="mini" onClick={() => setSessionStatus(s.id, 'held')}>منعقدة</button>
                  <button className="mini" onClick={() => setSessionStatus(s.id, 'postponed')}>مؤجلة</button>
                </div>
              </div>
            ))}
            {sessions.filter(s => s.activity_id === a.id).length === 0 && <div className="muted" style={{ fontSize: 13 }}>لا جلسات بعد</div>}
          </div>
        </div>
      ))}

      {/* نافذة إضافة جلسة احترافية */}
      {sessFor && (
        <div className="modal-overlay" onClick={() => setSessFor(null)}>
          <div className="modal session-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>إضافة جلسة — {activities.find(a => a.id === sessFor)?.title}</h2>
              <button className="icon-btn" onClick={() => setSessFor(null)}>✕</button>
            </div>
            <div className="field"><label>اسم الجلسة (اتركه فارغاً للتسمية التلقائية)</label>
              <input value={sessForm.title} onChange={e => setSessForm({ ...sessForm, title: e.target.value })} placeholder="مثال: الدرس الأول" /></div>
            <div className="field"><label>التاريخ</label>
              <input type="date" value={sessForm.planned_date} onChange={e => setSessForm({ ...sessForm, planned_date: e.target.value })} /></div>
            <div className="form-row">
              <div className="field" style={{ flex: 1 }}><label>وقت البدء</label>
                <input type="time" value={sessForm.start_time} onChange={e => setSessForm({ ...sessForm, start_time: e.target.value })} /></div>
              <div className="field" style={{ flex: 1 }}><label>المدة (دقيقة)</label>
                <input type="number" value={sessForm.duration_min} onChange={e => setSessForm({ ...sessForm, duration_min: e.target.value })} placeholder="60" /></div>
            </div>
            <button className="save-btn" onClick={saveSession}>حفظ الجلسة</button>
          </div>
        </div>
      )}
    </div>
  )
}
function statusLabel(s) {
  return { scheduled: 'مجدولة', held: 'منعقدة', postponed: 'مؤجلة', cancelled: 'ملغاة', holiday: 'إجازة' }[s] || s
}
