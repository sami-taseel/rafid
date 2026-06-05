import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useConfirm } from '../Confirm'
import { useToast } from '../Toast'
import OptionsEditor from './OptionsEditor'
import { Spinner } from './Students'

const TYPES = [
  { v: 'text', l: 'نص قصير' }, { v: 'textarea', l: 'نص طويل (فقرة)' },
  { v: 'number', l: 'رقم' }, { v: 'date', l: 'تاريخ' },
  { v: 'yesno', l: 'نعم / لا' }, { v: 'select', l: 'قائمة اختيار' },
]
const typeLabel = (v) => (TYPES.find(t => t.v === v) || {}).l || v

export default function Fields() {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const confirmDialog = useConfirm()
  const toast = useToast()

  async function load() {
    const { data } = await supabase.from('profile_fields').select('*').order('sort_order')
    setFields(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addField() {
    const max = fields.reduce((m, f) => Math.max(m, f.sort_order), 0)
    const { data } = await supabase.from('profile_fields').insert({
      label: 'سؤال جديد', field_key: 'field_' + Date.now(),
      field_type: 'text', section: 'شخصية', sort_order: max + 1
    }).select().single()
    await load()
    if (data) setOpenId(data.id)
  }

  function patchLocal(id, p) { setFields(fields.map(f => f.id === id ? { ...f, ...p } : f)) }

  // حفظ تلقائي
  async function autoSave(f) {
    await supabase.from('profile_fields').update({
      label: f.label, field_type: f.field_type, section: f.section,
      required: f.required, is_active: f.is_active,
      options: f.field_type === 'select' ? (Array.isArray(f.options) ? f.options : []) : null,
    }).eq('id', f.id)
    setSavedId(f.id); setTimeout(() => setSavedId(null), 1500)
  }

  async function delField(id) {
    const ok = await confirmDialog({ title: 'حذف السؤال', message: 'سيتم حذف هذا السؤال من النموذج.', confirmText: 'نعم، احذف', danger: true })
    if (!ok) return
    await supabase.from('profile_fields').delete().eq('id', id); load()
  }

  if (loading) return <Spinner />
  return (
    <div>
      <p className="muted" style={{ marginBottom: 14 }}>اضغط على أي سؤال لفتحه وتعديله. التغييرات تُحفظ تلقائياً.</p>

      <div className="acc-list">
        {fields.map(f => {
          const open = openId === f.id
          return (
            <div className={'acc-card' + (open ? ' open' : '')} key={f.id}>
              <div className="acc-head" onClick={() => setOpenId(open ? null : f.id)}>
                <div className="acc-title">
                  <span className="acc-chevron">{open ? '▾' : '▸'}</span>
                  <span>{f.label || 'سؤال بلا اسم'}</span>
                  {!f.is_active && <span className="pill-off">مخفي</span>}
                </div>
                <div className="acc-sub">
                  <span className="acc-type-badge">{typeLabel(f.field_type)}</span>
                  {f.field_type === 'select' && <span className="muted">{(f.options || []).length} خيار</span>}
                  {f.required && <span className="req-badge">إلزامي</span>}
                  {savedId === f.id && <span className="saved-flag">✓ حُفظ</span>}
                </div>
              </div>

              {open && (
                <div className="acc-body">
                  <div className="field">
                    <label>نص السؤال</label>
                    <input value={f.label} onChange={e => patchLocal(f.id, { label: e.target.value })} onBlur={() => autoSave(f)} />
                  </div>
                  <div className="form-row">
                    <div className="field" style={{ flex: 1 }}>
                      <label>القسم</label>
                      <input value={f.section || ''} onChange={e => patchLocal(f.id, { section: e.target.value })} onBlur={() => autoSave(f)} placeholder="شخصية / أكاديمية…" />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>نوع الإجابة</label>
                      <select value={f.field_type} onChange={e => { patchLocal(f.id, { field_type: e.target.value }); setTimeout(() => autoSave({ ...f, field_type: e.target.value }), 0) }}>
                        {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                    </div>
                  </div>

                  {f.field_type === 'select' && (
                    <div className="field">
                      <label>خيارات القائمة</label>
                      <OptionsEditor value={Array.isArray(f.options) ? f.options : []}
                        onChange={(arr) => { patchLocal(f.id, { options: arr }); setTimeout(() => autoSave({ ...f, options: arr }), 0) }} />
                    </div>
                  )}

                  <div className="acc-toggles">
                    <label className="chk"><input type="checkbox" checked={f.required} onChange={e => { patchLocal(f.id, { required: e.target.checked }); setTimeout(() => autoSave({ ...f, required: e.target.checked }), 0) }} /> إلزامي</label>
                    <label className="chk"><input type="checkbox" checked={f.is_active} onChange={e => { patchLocal(f.id, { is_active: e.target.checked }); setTimeout(() => autoSave({ ...f, is_active: e.target.checked }), 0) }} /> ظاهر للطلاب</label>
                    <button className="fr-del" onClick={() => delField(f.id)}>حذف السؤال</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className="add-field-btn" onClick={addField}>+ إضافة سؤال</button>
    </div>
  )
}
