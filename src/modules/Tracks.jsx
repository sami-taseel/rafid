import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function Tracks() {
  const [tracks, setTracks] = useState([])
  const [activities, setActivities] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selTrack, setSelTrack] = useState(null)
  const [newAct, setNewAct] = useState({ title: '', activity_type: 'درس', provider: '', location: '' })
  const [msg, setMsg] = useState(null)

  async function loadAll() {
    const [t, a, s] = await Promise.all([
      supabase.from('tracks').select('*').order('name_ar'),
      supabase.from('activities').select('*, tracks(name_ar)').order('created_at', { ascending: false }),
      supabase.from('sessions').select('*, activities(title)').order('planned_date', { ascending: false }),
    ])
    setTracks(t.data || []); setActivities(a.data || []); setSessions(s.data || [])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  async function addActivity() {
    if (!selTrack || !newAct.title) { setMsg('اختر المسار واكتب اسم النشاط'); return }
    await supabase.from('activities').insert({ ...newAct, track_id: selTrack })
    setNewAct({ title: '', activity_type: 'درس', provider: '', location: '' })
    setMsg('أُضيف النشاط'); loadAll()
  }
  async function addSession(actId) {
    const d = prompt('تاريخ الجلسة (مثال: 2026-06-10):')
    if (!d) return
    await supabase.from('sessions').insert({ activity_id: actId, planned_date: d, status: 'scheduled' })
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
          <select value={selTrack || ''} onChange={e => setSelTrack(e.target.value)}>
            <option value="">اختر المسار…</option>
            {tracks.map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
          </select>
          <input placeholder="اسم النشاط" value={newAct.title} onChange={e => setNewAct({ ...newAct, title: e.target.value })} />
          <select value={newAct.activity_type} onChange={e => setNewAct({ ...newAct, activity_type: e.target.value })}>
            {['درس','دورة','يوم علمي','مناقشة','رحلة','لقاء'].map(t => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="المقدّم" value={newAct.provider} onChange={e => setNewAct({ ...newAct, provider: e.target.value })} />
          <input placeholder="المكان" value={newAct.location} onChange={e => setNewAct({ ...newAct, location: e.target.value })} />
          <button onClick={addActivity}>إضافة</button>
        </div>
        {msg && <div className="save-ok">{msg}</div>}
      </div>

      <h3 className="section-title">الأنشطة والجلسات</h3>
      {activities.map(a => (
        <div className="panel" key={a.id}>
          <div className="act-head">
            <div>
              <strong>{a.title}</strong>
              <span className="pill" style={{ marginRight: 8 }}>{a.tracks?.name_ar}</span>
              <span className="muted"> {a.activity_type} {a.provider && '· ' + a.provider}</span>
            </div>
            <button className="mini" onClick={() => addSession(a.id)}>+ جلسة</button>
          </div>
          <div className="sessions">
            {sessions.filter(s => s.activity_id === a.id).map(s => (
              <div className="session-row" key={s.id}>
                <span>{s.planned_date}</span>
                <span className={'status-' + s.status}>{statusLabel(s.status)}</span>
                <div className="sess-actions">
                  <button className="mini" onClick={() => setSessionStatus(s.id, 'held')}>منعقدة</button>
                  <button className="mini" onClick={() => setSessionStatus(s.id, 'postponed')}>مؤجلة</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
function statusLabel(s) {
  return { scheduled: 'مجدولة', held: 'منعقدة', postponed: 'مؤجلة', cancelled: 'ملغاة', holiday: 'إجازة' }[s] || s
}
