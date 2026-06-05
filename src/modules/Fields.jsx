import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useConfirm } from '../Confirm'
import OptionsEditor from './OptionsEditor'

export default function Fields() {
  const onClose = null
  const confirmDialog = useConfirm()
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
        ? (Array.isArray(f.options) ? f.options : (typeof f.options === 'string' && f.options.startsWith('[') ? JSON.parse(f.options) : []))
        : null
    }).eq('id', f.id)
    setMsg('تم الحفظ')
    setTimeout(() => setMsg(null), 1500)
  }
  async function delField(id) {
    const ok = await confirmDialog({ title: 'حذف السؤال', message: 'سيتم حذف هذا السؤال من النموذج.', confirmText: 'نعم، احذف', danger: true })
    if (!ok) return
    await supabase.from('profile_fields').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>

  return (
    <div>
      <div>
        <h3 className="section-title">إدارة أسئلة نموذج الطالب</h3>
        {msg && <div className="save-ok">{msg}</div>}
        <div className="fields-list">
          {fields.map(f => (
            <div className="field-row" key={f.id}>
              <input className="fr-label" value={f.label}
                onChange={e => updateField(f.id, { label: e.target.value })} />
              <select value={f.field_type}
                onChange={e => updateField(f.id, { field_type: e.target.value })}>
                <option value="text">نص قصير</option>
                <option value="textarea">نص طويل (فقرة)</option>
                <option value="number">رقم</option>
                <option value="date">تاريخ</option>
                <option value="yesno">نعم / لا</option>
                <option value="select">قائمة اختيار</option>
              </select>
              {f.field_type === 'select' && (
                <OptionsEditor
                  value={Array.isArray(f.options) ? f.options : (typeof f.options === 'string' && f.options.startsWith('[') ? JSON.parse(f.options) : [])}
                  onChange={(arr) => updateField(f.id, { options: arr })} />
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
