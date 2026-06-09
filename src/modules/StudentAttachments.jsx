import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { uploadTicketFile } from '../ticketUtils'
import Attachment from './Attachment'

// مرفقات الطالب: المطلوب منه ومن مرافقيه، مع دعم "مرفق لكل شخص"
export default function StudentAttachments({ studentId }) {
  const [types, setTypes] = useState([])
  const [mine, setMine] = useState([])
  const [companions, setCompanions] = useState([])
  const [building, setBuilding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [myName, setMyName] = useState('')

  async function load() {
    const [ty, at, comp, st] = await Promise.all([
      supabase.from('attachment_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('student_attachments').select('*, attachment_types(name)').eq('student_id', studentId),
      supabase.from('companions').select('id, persons(full_name)').eq('student_id', studentId),
      supabase.from('students').select('housing_building_id, buildings(building_type), persons(full_name)').eq('id', studentId).maybeSingle(),
    ])
    setTypes(ty.data || []); setMine(at.data || []); setCompanions(comp.data || [])
    setBuilding(st.data?.buildings?.building_type || null)
    setMyName(st.data?.persons?.full_name || 'أنا')
    setLoading(false)
  }
  useEffect(() => { if (studentId) load() }, [studentId])

  async function upload(typeId, file, companionId, renewMonths) {
    if (!file) return
    setBusy(typeId + (companionId || 'self'))
    try {
      const path = await uploadTicketFile('attach_' + studentId, file)
      let expires = null
      if (renewMonths) { const d = new Date(); d.setMonth(d.getMonth() + Number(renewMonths)); expires = d.toISOString().slice(0, 10) }
      await supabase.from('student_attachments').insert({
        student_id: studentId, type_id: typeId, companion_id: companionId || null, file_path: path, expires_at: expires,
      })
      await load()
    } catch {}
    setBusy(null)
  }
  async function remove(id) {
    await supabase.from('student_attachments').delete().eq('id', id); load()
  }

  const firstName = (n) => (n || '').trim().split(' ')[0] || n
  if (loading) return <div className="state"><div className="spinner"></div>…</div>

  const visibleTypes = types.filter(t => {
    if (t.condition === 'families_only') return building === 'families'
    return true
  })
  // مرفقات لكل شخص (الطالب + المرافقون)
  const perPersonTypes = visibleTypes.filter(t => t.per_person)
  // مرفقات الطالب وحده
  const studentTypes = visibleTypes.filter(t => !t.per_person && t.owner_type === 'student')
  // مرفقات المرافق (النوع القديم — يبقى للتوافق)
  const companionTypes = visibleTypes.filter(t => !t.per_person && t.owner_type === 'companion')

  const findUpload = (typeId, companionId) => mine.find(m => m.type_id === typeId && (companionId ? m.companion_id === companionId : !m.companion_id))
  const isExpired = (a) => a?.expires_at && new Date(a.expires_at) < new Date()

  // بطاقة أيقونة رفع لشخص محدّد (ضمن شبكة)
  function UploadTile({ type, label, companionId }) {
    const up = findUpload(type.id, companionId)
    const expired = isExpired(up)
    const key = type.id + (companionId || 'self')
    const loading = busy === key
    return (
      <div className={'upload-tile' + (up && !expired ? ' done' : '') + (expired ? ' expired' : '')}>
        <label className="upload-tile-main">
          <div className="upload-tile-icon">
            {loading ? '⏳' : up && !expired ? '✓' : expired ? '⚠' : '＋'}
          </div>
          <div className="upload-tile-name">{label}</div>
          <div className="upload-tile-status">{loading ? 'جارٍ…' : up && !expired ? 'مرفوع' : expired ? 'منتهٍ' : 'رفع'}</div>
          <input type="file" hidden onChange={e => upload(type.id, e.target.files[0], companionId, type.renew_months)} />
        </label>
        {up && (
          <div className="upload-tile-actions">
            <Attachment path={up.file_path} label="عرض" />
            <button className="tile-del" onClick={() => remove(up.id)} title="حذف">🗑</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="st-attach">
      {/* مرفقات لكل شخص: بطاقة لكل نوع، بداخلها الطالب وكل مرافق */}
      {perPersonTypes.map(t => (
        <div className="sp-card" key={t.id}>
          <div className="sp-card-title">{t.name}{t.required && <span className="req-star">*</span>}</div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>ارفع نسخة لك ولكل مرافق.</p>
          <div className="upload-grid">
            <UploadTile type={t} label={firstName(myName)} companionId={null} />
            {companions.map(c => (
              <UploadTile key={c.id} type={t} label={firstName(c.persons?.full_name)} companionId={c.id} />
            ))}
          </div>
          {companions.length === 0 && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>أضف مرافقيك من تبويب «المرافقون» لرفع مرفقاتهم.</p>}
        </div>
      ))}

      {/* مرفقات الطالب وحده */}
      {studentTypes.length > 0 && (
        <div className="sp-card">
          <div className="sp-card-title">مرفقاتي</div>
          {studentTypes.map(t => (
            <div key={t.id} className="attach-row">
              <div className="attach-info">
                <span className="attach-name">{t.name}{t.required && <span className="req-star">*</span>}</span>
                {t.renew_months && <span className="muted" style={{ fontSize: 12 }}> · يتجدّد كل {t.renew_months} أشهر</span>}
              </div>
              <UploadRowInline type={t} />
            </div>
          ))}
        </div>
      )}

      {/* مرفقات المرافق (النوع القديم) */}
      {companionTypes.length > 0 && companions.length > 0 && (
        <div className="sp-card">
          <div className="sp-card-title">مرفقات المرافقين</div>
          {companions.map(c => (
            <div key={c.id} className="companion-attach">
              <div className="companion-name">{c.persons?.full_name}</div>
              <div className="upload-grid">
                {companionTypes.map(t => <UploadTile key={t.id} type={t} label={t.name} companionId={c.id} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  function UploadRowInline({ type }) {
    const up = findUpload(type.id, null)
    const expired = isExpired(up)
    return (
      <div className="attach-actions">
        {up && !expired && <span className="attach-ok">✓ مرفوع</span>}
        {expired && <span className="attach-expired">⚠ منتهٍ — حدّثه</span>}
        {up && <Attachment path={up.file_path} label="عرض" />}
        {up && <button className="mini-del" onClick={() => remove(up.id)}>حذف</button>}
        <label className="file-btn">{busy === type.id + 'self' ? 'جارٍ…' : up ? 'استبدال' : 'رفع'}
          <input type="file" hidden onChange={e => upload(type.id, e.target.files[0], null, type.renew_months)} /></label>
      </div>
    )
  }
}
