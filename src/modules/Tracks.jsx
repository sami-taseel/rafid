import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { formatDuration } from '../dateUtils'
import { Spinner } from './Students'
import { useConfirm } from '../Confirm'
import ExcelImport from './ExcelImport'
import Icon from '../Icon'
import QRModal, { canGenerateQR } from './QRModal'
import RescheduleModal from './RescheduleModal'
import BulkSessions from './BulkSessions'

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
  const [reschedule, setReschedule] = useState(null)
  const [bulkFor, setBulkFor] = useState(null)   // النشاط المراد توليد جلساته
  const [sessForm, setSessForm] = useState({ id: null, title: '', planned_date: '', start_time: '', duration_min: '', status: 'scheduled', recording_url: '' })
  const [editAct, setEditAct] = useState(null)
  const [newAct, setNewAct] = useState({ title: '', activity_type: 'درس', provider: '', location: '', track_code: '' })
  const [newActCats, setNewActCats] = useState({})   // {categoryId: 'primary'|'secondary'}
  const [newScope, setNewScope] = useState('students')
  const [categories, setCategories] = useState([])
  const [actCats, setActCats] = useState({})  // {categoryId: 'primary'|'secondary'}
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
  function toggleNewCat(cid) {
    const cur = newActCats[cid]
    const next = { ...newActCats }
    if (!cur) next[cid] = 'primary'
    else if (cur === 'primary') next[cid] = 'secondary'
    else delete next[cid]
    setNewActCats(next)
  }
  async function addActivity() {
    if (!newAct.title || !newAct.track_code) { flash('اكتب اسم النشاط واختر المسار', 'error'); return }
    const track = tracks.find(t => t.code === newAct.track_code)
    const { data: created } = await supabase.from('activities').insert({
      title: newAct.title, activity_type: newAct.activity_type,
      provider: newAct.provider, location: newAct.location, track_id: track?.id,
    }).select('id').single()
    // ربط الفئات المستهدفة (رئيسي/ثانوي)
    const entries = Object.entries(newActCats)
    if (created?.id && entries.length) {
      await supabase.from('activity_categories').insert(
        entries.map(([cid, type]) => ({ activity_id: created.id, category_id: cid, target_type: type })))
    }
    setNewAct({ title: '', activity_type: 'درس', provider: '', location: '', track_code: '' })
    setNewActCats({})
    flash('أُضيف النشاط وفئاته المستهدفة'); loadAll()
  }
  async function openEditActivity(a) {
    setEditAct({ id: a.id, title: a.title, activity_type: a.activity_type, provider: a.provider || '', location: a.location || '', track_code: a.tracks?.code || '' })
    const { data } = await supabase.from('activity_categories').select('category_id, target_type').eq('activity_id', a.id)
    const m = {}; (data || []).forEach(x => { m[x.category_id] = x.target_type || 'primary' })
    setActCats(m)
    setScope('students')
  }
  // دورة الاختيار: غير مختار → رئيسي → ثانوي → غير مختار
  function toggleActCat(cid) {
    const cur = actCats[cid]
    const next = { ...actCats }
    if (!cur) next[cid] = 'primary'
    else if (cur === 'primary') next[cid] = 'secondary'
    else delete next[cid]
    setActCats(next)
  }
  function setCatType(cid, type) { setActCats({ ...actCats, [cid]: type }) }
  async function saveEditActivity() {
    const track = tracks.find(t => t.code === editAct.track_code)
    await supabase.from('activities').update({
      title: editAct.title, activity_type: editAct.activity_type,
      provider: editAct.provider, location: editAct.location, track_id: track?.id,
    }).eq('id', editAct.id)
    // تحديث الفئات المستهدفة
    await supabase.from('activity_categories').delete().eq('activity_id', editAct.id)
    const entries = Object.entries(actCats)
    if (entries.length) {
      await supabase.from('activity_categories').insert(
        entries.map(([cid, type]) => ({ activity_id: editAct.id, category_id: cid, target_type: type })))
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
    setSessFor(actId); setSessForm({ id: null, title: '', planned_date: '', start_time: '', duration_min: '', status: 'scheduled', recording_url: '' })
  }
  function openEditSession(s) {
    setSessFor(s.activity_id)
    setSessForm({ id: s.id, title: s.title || '', planned_date: s.planned_date || '',
      start_time: s.start_time ? s.start_time.slice(0,5) : '', duration_min: s.duration_min || '', status: s.status, recording_url: s.recording_url || '' })
  }
  async function saveSession() {
    if (!sessForm.planned_date) { flash('اختر تاريخ الجلسة', 'error'); return }
    let title = sessForm.title
    if (!title) {
      const act = activities.find(a => a.id === sessFor)
      const count = sessions.filter(s => s.activity_id === sessFor && s.id !== sessForm.id).length
      title = (act?.activity_type || 'جلسة') + ' ' + (count + 1)
    }
    const newUrl = (sessForm.recording_url || '').trim()
    const payload = {
      activity_id: sessFor, planned_date: sessForm.planned_date,
      start_time: sessForm.start_time || null,
      duration_min: sessForm.duration_min ? Number(sessForm.duration_min) : null,
      title, status: sessForm.status, recording_url: newUrl || null,
    }
    let sessId = sessForm.id
    if (sessForm.id) {
      await supabase.from('sessions').update(payload).eq('id', sessForm.id)
    } else {
      const { data: ins } = await supabase.from('sessions').insert(payload).select('id').single()
      sessId = ins?.id
    }
    // إن وُجد رابط، نستدعي الدالة التي تُشعر الطلاب المستأذنين المفعّلين
    if (newUrl && sessId) {
      const { data: n } = await supabase.rpc('set_recording_url', { p_session: sessId, p_url: newUrl })
      if (n > 0) flash('تم حفظ الرابط وإشعار ' + n + ' طالباً مستأذناً', 'success')
    }
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
  // تبديل منعقدة (منعقدة ⇄ مجدولة)
  async function toggleHeld(s) {
    const next = s.status === 'held' ? 'scheduled' : 'held'
    await supabase.from('sessions').update({ status: next }).eq('id', s.id); loadAll()
  }
  // تأجيل أو إلغاء تأجيل (مؤجلة → مجدولة)
  async function handlePostpone(s) {
    if (s.status === 'postponed') {
      await supabase.from('sessions').update({ status: 'scheduled' }).eq('id', s.id); loadAll()
    } else { setReschedule(s) }
  }
  async function confirmReschedule(newDate) {
    const s = reschedule
    // الدالة الخادمية تزحزح الجلسات التالية للجلسات المرقّمة المترابطة
    const { data, error } = await supabase.rpc('postpone_session', { p_session: s.id, p_new_date: newDate || null })
    if (error) {
      // احتياط: التحديث المباشر إن لم تكن الدالة منفّذة بعد
      const payload = { status: 'postponed' }
      if (newDate) payload.planned_date = newDate
      await supabase.from('sessions').update(payload).eq('id', s.id)
      flash(newDate ? 'تم تأجيل الجلسة إلى ' + newDate : 'تم تأجيل الجلسة إلى إشعار آخر')
    } else {
      flash(data || 'تم التأجيل')
    }
    setReschedule(null); loadAll()
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

      <div className="panel na-panel">
        <div className="na-head">
          <div className="na-head-ic"><Icon name="plus" size={20} /></div>
          <div>
            <h3 className="na-title">إضافة نشاط جديد</h3>
            <p className="na-sub">عرّف النشاط وحدّد فئاته المستهدفة في خطوة واحدة</p>
          </div>
        </div>

        {/* بيانات النشاط */}
        <div className="na-section">
          <div className="na-section-label"><span className="na-step">1</span> بيانات النشاط</div>
          <div className="na-grid">
            <div className="na-field na-required">
              <label>المسار</label>
              <select value={newAct.track_code} onChange={e => setNewAct({ ...newAct, track_code: e.target.value })}>
                <option value="">اختر المسار…</option>
                {tracks.map(t => <option key={t.id} value={t.code}>{t.name_ar}</option>)}
              </select>
            </div>
            <div className="na-field na-required">
              <label>اسم النشاط</label>
              <input placeholder="مثال: دورة إعداد الباحثين" value={newAct.title}
                onChange={e => setNewAct({ ...newAct, title: e.target.value })} />
            </div>
            <div className="na-field">
              <label>نوع النشاط</label>
              <select value={newAct.activity_type} onChange={e => setNewAct({ ...newAct, activity_type: e.target.value })}>
                {ACT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="na-field">
              <label>مقدّم النشاط <span className="na-opt">اختياري</span></label>
              <input placeholder="اسم المقدّم" value={newAct.provider}
                onChange={e => setNewAct({ ...newAct, provider: e.target.value })} />
            </div>
            <div className="na-field">
              <label>المكان <span className="na-opt">اختياري</span></label>
              <input placeholder="القاعة أو الموقع" value={newAct.location}
                onChange={e => setNewAct({ ...newAct, location: e.target.value })} />
            </div>
          </div>
        </div>

        {/* الفئات المستهدفة */}
        <div className="na-section">
          <div className="na-section-label"><span className="na-step">2</span> الفئات المستهدفة</div>
          <div className="na-scope">
            <button type="button" className={'na-scope-btn' + (newScope === 'students' ? ' on' : '')} onClick={() => setNewScope('students')}>الطلاب</button>
            <button type="button" className={'na-scope-btn' + (newScope === 'companions' ? ' on' : '')} onClick={() => setNewScope('companions')}>المرافقون</button>
            <button type="button" className={'na-scope-btn' + (newScope === 'both' ? ' on' : '')} onClick={() => setNewScope('both')}>الجميع</button>
          </div>
          <div className="na-cats">
            {categories.filter(c => newScope === 'both' ? true : c.member_type === (newScope === 'students' ? 'student' : 'companion')).map(c => (
              <button type="button" key={c.id}
                className={'na-cat' + (newActCats[c.id] ? ' on ' + newActCats[c.id] : '')}
                onClick={() => toggleNewCat(c.id)}
                title="اضغط للتبديل: رئيسي ← ثانوي ← إلغاء">
                <span className="na-cat-name">{c.name}</span>
                {newActCats[c.id] && (
                  <span className="na-cat-tag">{newActCats[c.id] === 'primary' ? 'إلزامي' : 'اختياري'}</span>
                )}
              </button>
            ))}
            {categories.filter(c => newScope === 'both' ? true : c.member_type === (newScope === 'students' ? 'student' : 'companion')).length === 0 &&
              <span className="muted" style={{ fontSize: 13 }}>لا توجد فئات من هذا النوع. أنشئها من «الفئات والتصنيفات».</span>}
          </div>
          <div className="na-legend">
            <span><b className="na-dot primary"></b> <strong>إلزامي:</strong> درجة لكل جلسة + نقطتان</span>
            <span><b className="na-dot secondary"></b> <strong>اختياري:</strong> نقطة واحدة</span>
            <span className="na-legend-hint">اضغط الفئة مرة للإلزامي، مرتين للاختياري، ثلاثاً للإلغاء</span>
          </div>
        </div>

        {/* شريط الإجراء */}
        <div className="na-actions">
          <div className="na-summary">
            {Object.keys(newActCats).length > 0
              ? <>محدّد: <strong>{Object.values(newActCats).filter(v => v === 'primary').length}</strong> إلزامية · <strong>{Object.values(newActCats).filter(v => v === 'secondary').length}</strong> اختيارية</>
              : 'لم تُحدَّد فئات — سيكون النشاط عاماً'}
          </div>
          <button className="na-submit" onClick={addActivity} disabled={!newAct.title || !newAct.track_code}>
            <Icon name="plus" size={16} /> إضافة النشاط
          </button>
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
              <button className="mini bulk-btn" onClick={() => setBulkFor(a)}>📅 جلسات أسبوعية</button>
              <button className="mini" onClick={() => openEditActivity(a)}>تعديل</button>
              <button className="fr-del" onClick={() => deleteActivity(a)}>حذف</button>
            </div>
          </div>
          <div className="sessions">
            {sessions.filter(s => s.activity_id === a.id).map(s => (
              <div className="session-row" key={s.id}>
                <span className="sess-name">{s.title || 'جلسة'}</span>
                <span className="muted">{s.planned_date}{s.start_time ? ' · ' + s.start_time.slice(0,5) : ''}{s.duration_min ? ' · ' + formatDuration(s.duration_min) : ''}</span>
                <span className={'status-' + s.status}>{statusLabel(s.status)}</span>
                <div className="sess-actions">
                  {canGenerateQR(s) && (
                    <button className="mini sess-qr" onClick={() => setQrSession({ ...s, activities: { title: a.title } })} title="باركود الحضور">
                      <Icon name="image" size={14} /> باركود
                    </button>
                  )}
                  <button className={'mini' + (s.status === 'held' ? ' btn-on' : '')} onClick={() => toggleHeld(s)}>
                    {s.status === 'held' ? '✓ منعقدة' : 'منعقدة'}
                  </button>
                  <button className={'mini' + (s.status === 'postponed' ? ' btn-on-warn' : '')} onClick={() => handlePostpone(s)}>
                    {s.status === 'postponed' ? 'مؤجلة ✕' : 'تأجيل'}
                  </button>
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
              <div className="field" style={{ flex: 1 }}><label>المدة</label>
                <select value={sessForm.duration_min} onChange={e => setSessForm({ ...sessForm, duration_min: e.target.value })}>
                  <option value="">غير محدّدة</option>
                  <option value="30">نصف ساعة</option>
                  <option value="45">٤٥ دقيقة</option>
                  <option value="60">ساعة</option>
                  <option value="90">ساعة ونصف</option>
                  <option value="120">ساعتان</option>
                  <option value="150">ساعتان ونصف</option>
                  <option value="180">٣ ساعات</option>
                  <option value="240">٤ ساعات</option>
                  <option value="300">٥ ساعات</option>
                  <option value="360">٦ ساعات</option>
                </select></div>
            </div>
            {sessForm.id && (
              <div className="field"><label>الحالة</label>
                <select value={sessForm.status} onChange={e => setSessForm({ ...sessForm, status: e.target.value })}>
                  <option value="scheduled">مجدولة</option><option value="held">منعقدة</option>
                  <option value="postponed">مؤجلة</option><option value="cancelled">ملغاة</option>
                </select></div>
            )}
            <div className="field">
              <label>🎧 رابط تسجيل الدرس <span className="field-hint">(يُشعر الطلاب المستأذنين المفعّلين)</span></label>
              <input type="url" dir="ltr" value={sessForm.recording_url}
                onChange={e => setSessForm({ ...sessForm, recording_url: e.target.value })}
                placeholder="https://..." />
            </div>
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
                    className={'val-chip cat-chip' + (actCats[c.id] ? ' on ' + actCats[c.id] : '')}
                    onClick={() => toggleActCat(c.id)}
                    title="اضغط للتبديل: رئيسي ← ثانوي ← إلغاء">
                    {c.name}
                    {actCats[c.id] === 'primary' && <span className="cat-tag primary">رئيسي</span>}
                    {actCats[c.id] === 'secondary' && <span className="cat-tag secondary">ثانوي</span>}
                  </button>
                ))}
                {categories.filter(c => scope === 'both' ? true : c.member_type === (scope === 'students' ? 'student' : 'companion')).length === 0 &&
                  <span className="muted" style={{ fontSize: 13 }}>لا توجد فئات من هذا النوع. أنشئها من «الفئات والتصنيفات».</span>}
              </div>
              <div className="cat-legend">
                <span><b className="cat-dot primary"></b> <strong>رئيسي:</strong> حضور إلزامي ← درجة لكل جلسة + نقطتان</span>
                <span><b className="cat-dot secondary"></b> <strong>ثانوي:</strong> حضور اختياري ← نقطة واحدة</span>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                اضغط الفئة للتبديل بين رئيسي ← ثانوي ← إلغاء. إن لم تختر شيئاً، يكون النشاط عاماً لغير محدّد.
              </p>

            </div>

            <button className="save-btn" onClick={saveEditActivity}>حفظ التعديل</button>
          </div>
        </div>
      )}
    </div>
      {qrSession && <QRModal session={qrSession} onClose={() => setQrSession(null)} />}
      {reschedule && <RescheduleModal session={reschedule} onConfirm={confirmReschedule} onClose={() => setReschedule(null)} />}
      {bulkFor && <BulkSessions activity={bulkFor} onClose={() => setBulkFor(null)} onDone={loadAll} />}
    </>
  )
}
function statusLabel(s) {
  return { scheduled: 'مجدولة', held: 'منعقدة', postponed: 'مؤجلة', cancelled: 'ملغاة', holiday: 'إجازة' }[s] || s
}
