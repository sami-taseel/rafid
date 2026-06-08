import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { uploadTicketFile } from '../ticketUtils'
import Attachment from './Attachment'

// مرفقات الطالب: يرفع المطلوب منه ومن مرافقيه
export default function StudentAttachments({ studentId }) {
  const [types, setTypes] = useState([])
  const [mine, setMine] = useState([])
  const [companions, setCompanions] = useState([])
  const [building, setBuilding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  async function load() {
    const [ty, at, comp, st] = await Promise.all([
      supabase.from('attachment_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('student_attachments').select('*, attachment_types(name)').eq('student_id', studentId),
      supabase.from('companions').select('id, persons(full_name)').eq('student_id', studentId),
      supabase.from('students').select('housing_building_id, buildings(building_type)').eq('id', studentId).maybeSingle(),
    ])
    setTypes(ty.data || []); setMine(at.data || []); setCompanions(comp.data || [])
    setBuilding(st.data?.buildings?.building_type || null)
    setLoading(false)
  }
  useEffect(() => { if (studentId) load() }, [studentId])

  async function upload(typeId, file, companionId, renewMonths) {
    if (!file) return
    setBusy(typeId + (companionId || ''))
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

  if (loading) return <div className="state"><div className="spinner"></div>…</div>

  // فلترة الأنواع حسب الشرط
  const visibleTypes = types.filter(t => {
    if (t.condition === 'families_only') return building === 'families'
    return true
  })
  const studentTypes = visibleTypes.filter(t => t.owner_type === 'student')
  const companionTypes = visibleTypes.filter(t => t.owner_type === 'companion')

  const findUpload = (typeId, companionId) => mine.find(m => m.type_id === typeId && (companionId ? m.companion_id === companionId : !m.companion_id))
  const isExpired = (a) => a?.expires_at && new Date(a.expires_at) < new Date()

  return (
    <div className="st-attach">
      <div className="sp-card">
        <div className="sp-card-title">مرفقاتي</div>
        {studentTypes.map(t => {
          const up = findUpload(t.id, null)
          const expired = isExpired(up)
          return (
            <div key={t.id} className="attach-row">
              <div className="attach-info">
                <span className="attach-name">{t.name}{t.required && <span className="req-star">*</span>}</span>
                {t.renew_months && <span className="muted" style={{ fontSize: 12 }}> · يتجدّد كل {t.renew_months} أشهر</span>}
                {up && !expired && <span className="attach-ok">✓ مرفوع</span>}
                {expired && <span className="attach-expired">⚠ منتهي — يرجى التحديث</span>}
              </div>
              <div className="attach-actions">
                {up && <Attachment path={up.file_path} label="عرض" />}
                {up && <button className="mini-del" onClick={() => remove(up.id)}>حذف</button>}
                <label className="file-btn">{busy === t.id ? 'جارٍ…' : up ? 'استبدال' : 'رفع'}
                  <input type="file" hidden onChange={e => upload(t.id, e.target.files[0], null, t.renew_months)} /></label>
              </div>
            </div>
          )
        })}
      </div>

      {companionTypes.length > 0 && companions.length > 0 && (
        <div className="sp-card">
          <div className="sp-card-title">مرفقات المرافقين</div>
          {companions.map(c => (
            <div key={c.id} className="companion-attach">
              <div className="companion-name">{c.persons?.full_name}</div>
              {companionTypes.map(t => {
                const up = findUpload(t.id, c.id)
                return (
                  <div key={t.id} className="attach-row">
                    <div className="attach-info">
                      <span className="attach-name">{t.name}{t.required && <span className="req-star">*</span>}</span>
                      {up && <span className="attach-ok">✓ مرفوع</span>}
                    </div>
                    <div className="attach-actions">
                      {up && <Attachment path={up.file_path} label="عرض" />}
                      {up && <button className="mini-del" onClick={() => remove(up.id)}>حذف</button>}
                      <label className="file-btn">{busy === t.id + c.id ? 'جارٍ…' : up ? 'استبدال' : 'رفع'}
                        <input type="file" hidden onChange={e => upload(t.id, e.target.files[0], c.id, t.renew_months)} /></label>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
