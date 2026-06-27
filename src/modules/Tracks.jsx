import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { Spinner } from './Students'
import { useConfirm } from '../Confirm'
import ExcelImport from './ExcelImport'
import Icon from '../Icon'
import QRModal, { canGenerateQR } from './QRModal'

const ACT_TYPES = ['درس','دورة','يوم علمي','مناقشة','رحلة','لقاء','محاضرة']

export default function Tracks() {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [tracks, setTracks] = useState([])
  const [activities, setActivities] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [sessFor, setSessFor] = useState(null)
  const [qrSession, setQrSession] = useState(null)
  const [sessForm, setSessForm] = useState({ id: null, title: '', planned_date: '', start_time: '', duration_min: '', status: 'scheduled' })
  const [editAct, setEditAct] = useState(null)
  const [newAct, setNewAct] = useState({ title: '', activity_type: 'درس', provider: '', location: '', track_code: '' })
  const [categories, setCategories] = useState([])
  const [actCats, setActCats] = useState([])  // فئات النشاط قيد التعديل
  const [scope, setScope] = useState('students')  // students | companions | both

  async function loadAll() {
    const [t, a, s] = await Promise.all([
      supabase.from('tracks').select('*').order('name_ar'),
      supabase.from('activities').select('*, tracks(name_ar, code)').order('created_at', { ascending: false }),
      supabase.from('sessions').select('*, activities(title)').order('planned_date', { ascending: false }),
    ])
    setTracks(t.data || []); setActivities(a.data || []); setSessions(s.data || [])
    const { data: cats } = await supabase.from('categories').select('*').order('name')
    setCategories(cats || [])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  function flash(m, type) { toast(m, type) }

  // ===== الأنشطة =====
  async function addActivity() {
    if (!newAct.title || !newAct.track_code) { flash('اكتب اسم النشاط واختر المسار', 'error'); return }
    const track = tracks.find(t => t.code === newAct.track_code)
    await supabase.from('activities').insert({
      title: newAct.title, activity_type: newAct.activity_type,
      provider: newAct.provider, location: newAct.location, track_id: track?.id,
    })
    setNewAct({ title: '', activity_type: 'درس', provider: '', location: '', track_code: '' })
    flash('أُضيف النشاط'); loadAll()
  }
  async function openEditActivity(a) {
    setEditAct({ id: a.id, title: a.title, activity_type: a.activity_type, provider: a.provider || '', location: a.location || '', track_code: a.tracks?.code || '' })
    const { data } = await supabase.from('activity_categories').select('category_id').eq('activity_id', a.id)
    setActCats((data || []).map(x => x.category_id))
    setScope('students')
  }
  function toggleActCat(cid) {
    setActCats(actCats.includes(cid) ? actCats.filter(x => x !== cid) : [...actCats, cid])
  }
  async function saveEditActivity() {
    const track = tracks.find(t => t.code === editAct.track_code)
    await supabase.from('activities').update({
      title: editAct.title, activity_type: editAct.activity_type,
      provider: editAct.provider, location: editAct.location, track_id: track?.id,
    }).eq('id', editAct.id)
    // تحديث الفئات المستهدفة
    await supabase.from('activity_categories').delete().eq('activity_id', editAct.id)
    if (actCats.length) {
      await supabase.from('activity_categories').insert(actCats.map(cid => ({ activity_id: editAct.id, category_id: cid })))
    }
    setEditAct(null); flash('تم تعديل النشاط وفئاته المستهدفة'); loadAll()
  }
  async function deleteActivity(a) {
    const cnt = sessions.filter(s => s.activity_id === a.id).length
    const warn = cnt > 0
      ? `هذا النشاط له ${cnt} جلسة سيتم حذفها مع كل سجلات حضورها.`
      : 'سيتم حذف هذا النشاط نهائياً.'
    const ok = await confirmDialog({ title: 'حذف النشاط', message: warn, confirmText: 'نعم، احذف', danger: true })
    if (!ok) return
    await supabase.from('activities').delete().eq('id', a.id)
    flash('تم حذف النشاط'); loadAll()
  }

  // ===== الجلسات =====
  function openNewSession(actId) {
    setSessFor(actId); setSessForm({ id: null, title: '', planned_date: '', start_time: '', duration_min: '', status: 'scheduled' })
  }
  function openEditSession(s) {
    setSessFor(s.activity_id)
    setSessForm({ id: s.id, title: s.title || '', planned_date: s.planned_date || '',
      start_time: s.start_time ? s.start_time.slice(0,5) : '', duration_min: s.duration_min || '', status: s.status })
  }
  async function saveSession() {
    if (!sessForm.planned_date) { flash('اختر تاريخ الجلسة', 'error'); return }
    let title = sessForm.title
    if (!title) {
      const act = activities.find(a => a.id === sessFor)
      const count = sessions.filter(s => s.activity_id === sessFor && s.id !== sessForm.id).length
      title = (act?.activity_type || 'جلسة') + ' ' + (count + 1)
    }
    const payload = {
      activity_id: sessFor, planned_date: sessForm.planned_date,
      start_time: sessForm.start_time || null,
      duration_min: sessForm.duration_min ? Number(sessForm.duration_min) : null,
      title, status: sessForm.status,
    }
    if (sessForm.id) await supabase.from('sessions').update(payload).eq('id', sessForm.id)
    else await supabase.from('sessions').insert(payload)
    setSessFor(null); loadAll()
  }
  async function deleteSession(s) {
    const ok = await confirmDialog({ title: 'حذف الجلسة', message: 'سيتم حذف هذه الجلسة وكل سجلات حضورها.', confirmText: 'نعم، احذف', danger: true })
    if (!ok) return
    await supabase.from('sessions').delete().eq('id', s.id); flash('تم حذف الجلسة'); loadAll()
  }
  async function setSessionStatus(id, status) {
    await supabase.from('sessions').update({ status }).eq('id', id); loadAll()
  }

  if (loading) return <Spinner />
  return (
    <>
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
            {ACT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="المقدّم" value={newAct.provider} onChange={e => setNewAct({ ...newAct, provider: e.target.value })} />
          <input placeholder="المكان" value={newAct.location} onChange={e => setNewAct({ ...newAct, location: e.target.value })} />
          <button onClick={addActivity}>إضافة</button>
        </div>
      </div>

      <div className="panel">
        <h3>إضافة جلسات دفعة واحدة من Excel</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          ارفع الجلسات، وستُنشأ الأنشطة تلقائياً منها دون تكرار. اترك اسم الجلسة فارغاً ليُسمّى تلقائياً.
        </p>
        <ExcelImport
          title="الجلسات" mode="rpc" rpcName="add_session_smart"
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
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>رموز المسارات: educational, skills, social, care, applied, companions</div>
      </div>

      <h3 className="section-title">الأنشطة والجلسات</h3>
      {activities.length === 0 && <div className="panel muted">لا توجد أنشطة بعد. أضِف نشاطاً أو ارفع جلسات من Excel.</div>}
      {activities.map(a => (
        <div className="panel" key={a.id}>
          <div className="act-head">
            <div>
              <strong>{a.title}</strong>
              <span className="pill" style={{ marginRight: 8 }}>{a.tracks?.name_ar}</span>
              <span className="muted"> {a.activity_type} {a.provider && '· ' + a.provider} {a.location && '· ' + a.location}</span>
            </div>
            <div className="sess-actions">
              <button className="mini" onClick={() => openNewSession(a.id)}>+ جلسة</button>
              <button className="mini" onClick={() => openEditActivity(a)}>تعديل</button>
              <button className="fr-del" onClick={() => deleteActivity(a)}>حذف</button>
            </div>
          </div>
          <div className="sessions">
            {sessions.filter(s => s.activity_id === a.id).map(s => (
              <div className="session-row" key={s.id}>
                <span className="sess-name">{s.title || 'جلسة'}</span>
                <span className="muted">{s.planned_date}{s.start_time ? ' · ' + s.start_time.slice(0,5) : ''}{s.duration_min ? ' · ' + s.duration_min + 'د' : ''}</span>
                <span className={'status-' + s.status}>{statusLabel(s.status)}</span>
                <div className="sess-actions">
                  {canGenerateQR(s) && (
                    <button className="mini sess-qr" onClick={() => setQrSession({ ...s, activities: { title: a.title } })} title="باركود الحضور">
                      <Icon name="image" size={14} /> باركود
                    </button>
                  )}
                  <button className="mini" onClick={() => setSessionStatus(s.id, 'held')}>منعقدة</button>
                  <button className="mini" onClick={() => setSessionStatus(s.id, 'postponed')}>تأجيل</button>
                  <button className="mini" onClick={() => setSessionStatus(s.id, 'cancelled')}>إلغاء</button>
                  <button className="mini" onClick={() => openEditSession(s)}>تعديل</button>
                  <button className="fr-del" onClick={() => deleteSession(s)}>حذف</button>
                </div>
              </div>
            ))}
            {sessions.filter(s => s.activity_id === a.id).length === 0 && <div className="muted" style={{ fontSize: 13 }}>لا جلسات بعد</div>}
          </div>
        </div>
      ))}

      {/* نافذة الجلسة (إضافة/تعديل) */}
      {sessFor && (
        <div className="modal-overlay" onClick={() => setSessFor(null)}>
          <div className="modal session-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{sessForm.id ? 'تعديل جلسة' : 'إضافة جلسة'} — {activities.find(a => a.id === sessFor)?.title}</h2>
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
            {sessForm.id && (
              <div className="field"><label>الحالة</label>
                <select value={sessForm.status} onChange={e => setSessForm({ ...sessForm, status: e.target.value })}>
                  <option value="scheduled">مجدولة</option><option value="held">منعقدة</option>
                  <option value="postponed">مؤجلة</option><option value="cancelled">ملغاة</option>
                </select></div>
            )}
            <button className="save-btn" onClick={saveSession}>{sessForm.id ? 'حفظ التعديل' : 'حفظ الجلسة'}</button>
          </div>
        </div>
      )}

      {/* نافذة تعديل النشاط */}
      {editAct && (
        <div className="modal-overlay" onClick={() => setEditAct(null)}>
          <div className="modal session-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><h2>تعديل النشاط</h2><button className="icon-btn" onClick={() => setEditAct(null)}>✕</button></div>
            <div className="field"><label>المسار</label>
              <select value={editAct.track_code} onChange={e => setEditAct({ ...editAct, track_code: e.target.value })}>
                <option value="">اختر…</option>
                {tracks.map(t => <option key={t.id} value={t.code}>{t.name_ar}</option>)}
              </select></div>
            <div className="field"><label>اسم النشاط</label>
              <input value={editAct.title} onChange={e => setEditAct({ ...editAct, title: e.target.value })} /></div>
            <div className="field"><label>النوع</label>
              <select value={editAct.activity_type} onChange={e => setEditAct({ ...editAct, activity_type: e.target.value })}>
                {ACT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div className="field"><label>المقدّم</label>
              <input value={editAct.provider} onChange={e => setEditAct({ ...editAct, provider: e.target.value })} /></div>
            <div className="field"><label>المكان</label>
              <input value={editAct.location} onChange={e => setEditAct({ ...editAct, location: e.target.value })} /></div>

            <div className="field">
              <label>الفئة المستهدفة (الملزمون بالحضور)</label>
              <div className="seg" style={{ marginBottom: 10 }}>
                <button type="button" className={scope === 'students' ? 'seg-on' : ''} onClick={() => setScope('students')}>الطلاب</button>
                <button type="button" className={scope === 'companions' ? 'seg-on' : ''} onClick={() => setScope('companions')}>المرافقون</button>
                <button type="button" className={scope === 'both' ? 'seg-on' : ''} onClick={() => setScope('both')}>الجميع</button>
              </div>
              <div className="cat-pick-list">
                {categories.filter(c => scope === 'both' ? true : c.member_type === (scope === 'students' ? 'student' : 'companion')).map(c => (
                  <button type="button" key={c.id}
                    className={'val-chip' + (actCats.includes(c.id) ? ' on' : '')}
                    onClick={() => toggleActCat(c.id)}>{c.name}</button>
                ))}
                {categories.filter(c => scope === 'both' ? true : c.member_type === (scope === 'students' ? 'student' : 'companion')).length === 0 &&
                  <span className="muted" style={{ fontSize: 13 }}>لا توجد فئات من هذا النوع. أنشئها من «الفئات والتصنيفات».</span>}
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                اختر فئة أو أكثر. إن لم تختر شيئاً، يكون النشاط عاماً لغير محدّد.
              </p>
            </div>

            <button className="save-btn" onClick={saveEditActivity}>حفظ التعديل</button>
          </div>
        </div>
      )}
    </div>
      {qrSession && <QRModal session={qrSession} onClose={() => setQrSession(null)} />}
    </>
  )
}
function statusLabel(s) {
  return { scheduled: 'مجدولة', held: 'منعقدة', postponed: 'مؤجلة', cancelled: 'ملغاة', holiday: 'إجازة' }[s] || s
}
