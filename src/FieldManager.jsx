import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function FieldManager({ onClose }) {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  async function load() {
    const { data } = await supabase.from('profile_fields').select('*').order('sort_order')
    setFields(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addField() {
    const max = fields.reduce((m, f) => Math.max(m, f.sort_order), 0)
    await supabase.from('profile_fields').insert({
      label: 'سؤال جديد', field_key: 'field_' + Date.now(),
      field_type: 'text', section: 'شخصية', sort_order: max + 1
    })
    load()
  }
  async function updateField(id, patch) {
    setFields(fields.map(f => f.id === id ? { ...f, ...patch } : f))
  }
  async function saveField(f) {
    await supabase.from('profile_fields').update({
      label: f.label, field_type: f.field_type, section: f.section,
      required: f.required, is_active: f.is_active,
      options: f.field_type === 'select'
        ? (typeof f.options === 'string' ? JSON.parse(f.options || '[]') : f.options)
        : null
    }).eq('id', f.id)
    setMsg('تم الحفظ')
    setTimeout(() => setMsg(null), 1500)
  }
  async function delField(id) {
    if (!confirm('حذف هذا السؤال؟')) return
    await supabase.from('profile_fields').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-head">
          <h2>إدارة أسئلة نموذج الطالب</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {msg && <div className="save-ok">{msg}</div>}
        <div className="fields-list">
          {fields.map(f => (
            <div className="field-row" key={f.id}>
              <input className="fr-label" value={f.label}
                onChange={e => updateField(f.id, { label: e.target.value })} />
              <select value={f.field_type}
                onChange={e => updateField(f.id, { field_type: e.target.value })}>
                <option value="text">نص</option>
                <option value="number">رقم</option>
                <option value="date">تاريخ</option>
                <option value="select">قائمة</option>
              </select>
              {f.field_type === 'select' && (
                <input className="fr-opts" placeholder='خيارات: ["أ","ب"]'
                  value={typeof f.options === 'string' ? f.options : JSON.stringify(f.options || [])}
                  onChange={e => updateField(f.id, { options: e.target.value })} />
              )}
              <label className="fr-check">
                <input type="checkbox" checked={f.required}
                  onChange={e => updateField(f.id, { required: e.target.checked })} /> إلزامي
              </label>
              <label className="fr-check">
                <input type="checkbox" checked={f.is_active}
                  onChange={e => updateField(f.id, { is_active: e.target.checked })} /> ظاهر
              </label>
              <button className="fr-save" onClick={() => saveField(f)}>حفظ</button>
              <button className="fr-del" onClick={() => delField(f.id)}>حذف</button>
            </div>
          ))}
        </div>
        <button className="add-field-btn" onClick={addField}>+ إضافة سؤال</button>
      </div>
    </div>
  )
}
