import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useToast } from '../Toast'
import { useConfirm } from '../Confirm'

const CATEGORIES = [
  ['approval', 'موافقة (يقرأ الطالب ويوافق)'],
  ['request', 'طلب (الطالب يملأ ويرسل)'],
  ['notice', 'إشعار إداري (من المشرف للطالب)'],
]
const catLabel = (c) => (CATEGORIES.find(x => x[0] === c) || [c, c])[1]

export default function FormsAdmin() {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)

  async function load() {
    const { data } = await supabase.from('form_templates').select('*').order('sort_order')
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    const max = rows.reduce((m, r) => Math.max(m, r.sort_order), 0)
    const { data } = await supabase.from('form_templates').insert({ title: 'نموذج جديد', category: 'approval', sort_order: max + 1, body: '', fields: [] }).select().single()
    await load(); if (data) setEdit(data)
  }
  async function toggleActive(r) {
    await supabase.from('form_templates').update({ is_active: !r.is_active }).eq('id', r.id); load()
  }
  async function del(id) {
    const ok = await confirmDialog({ title: 'حذف النموذج', message: 'سيُحذف النموذج وكل سجلّاته.', confirmText: 'احذف', danger: true })
    if (!ok) return
    await supabase.from('form_templates').delete().eq('id', id); load()
  }

  if (loading) return <Spinner />
  if (edit) return <FormEditor form={edit} onBack={() => { setEdit(null); load() }} />

  return (
    <div>
      <p className="muted" style={{ marginBottom: 14 }}>أنشئ وعدّل نماذج المنصة: الموافقات التي يوقّعها الطالب، والطلبات التي يرسلها، والإشعارات الإدارية. تحكّم كامل في الإضافة والتعديل والإخفاء.</p>
      <button className="save-btn" style={{ width: 'auto', padding: '11px 22px', marginBottom: 16 }} onClick={add}>+ إنشاء نموذج</button>
      {rows.map(r => (
        <div className="panel" key={r.id}>
          <div className="form-tpl-row">
            <div>
              <strong>{r.title}</strong>
              {!r.is_active && <span className="pill-off">مخفي</span>}
              {r.required && <span className="req-badge" style={{ marginRight: 6 }}>إلزامي</span>}
              <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{catLabel(r.category)}</div>
            </div>
            <div className="sess-actions">
              <button className="mini" onClick={() => setEdit(r)}>تحرير</button>
              <button className="mini" onClick={() => toggleActive(r)}>{r.is_active ? 'إخفاء' : 'إظهار'}</button>
              <button className="fr-del" onClick={() => del(r.id)}>حذف</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function FormEditor({ form, onBack }) {
  const toast = useToast()
  const [f, setF] = useState({ ...form, fields: form.fields || [] })

  function set(p) { setF({ ...f, ...p }) }
  async function save() {
    await supabase.from('form_templates').update({
      title: f.title, category: f.category, body: f.body, fields: f.fields,
      direction: f.category === 'request' ? 'from_student' : 'to_student',
      required: f.required, is_active: f.is_active,
    }).eq('id', f.id)
    toast('تم حفظ النموذج'); onBack()
  }
  function addField() { set({ fields: [...f.fields, { key: 'field_' + Date.now(), label: 'حقل جديد', type: 'text' }] }) }
  function patchField(i, p) { const fl = [...f.fields]; fl[i] = { ...fl[i], ...p }; set({ fields: fl }) }
  function delField(i) { set({ fields: f.fields.filter((_, idx) => idx !== i) }) }

  return (
    <div style={{ maxWidth: 640 }}>
      <button className="mini" onClick={onBack}>→ رجوع</button>
      <div className="panel" style={{ marginTop: 12 }}>
        <h3>تحرير النموذج</h3>
        <div className="field"><label>عنوان النموذج</label>
          <input value={f.title} onChange={e => set({ title: e.target.value })} /></div>
        <div className="field"><label>نوع النموذج</label>
          <select value={f.category} onChange={e => set({ category: e.target.value })}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>

        {f.category !== 'request' && (
          <div className="field"><label>نص النموذج (يظهر للطالب)</label>
            <textarea rows={5} value={f.body || ''} onChange={e => set({ body: e.target.value })}
              placeholder="نص الموافقة أو الإشعار. يمكن استخدام متغيّرات مثل {اسم_الطالب} و {رقم_الشقة}" /></div>
        )}

        {f.category === 'request' && (
          <div className="field">
            <label>حقول الطلب</label>
            {f.fields.map((fld, i) => (
              <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                <input value={fld.label} onChange={e => patchField(i, { label: e.target.value })} placeholder="اسم الحقل" style={{ flex: 2 }} />
                <select value={fld.type} onChange={e => patchField(i, { type: e.target.value })}>
                  <option value="text">نص</option><option value="textarea">نص طويل</option>
                  <option value="date">تاريخ</option><option value="number">رقم</option>
                </select>
                <button className="mini-del" onClick={() => delField(i)}>✕</button>
              </div>
            ))}
            <button className="mini" onClick={addField}>+ إضافة حقل</button>
          </div>
        )}

        <div className="acc-toggles" style={{ marginTop: 14 }}>
          <label className="chk"><input type="checkbox" checked={f.required} onChange={e => set({ required: e.target.checked })} /> إلزامي على الطالب</label>
          <label className="chk"><input type="checkbox" checked={f.is_active} onChange={e => set({ is_active: e.target.checked })} /> ظاهر</label>
        </div>
        <button className="save-btn" style={{ width: 'auto', padding: '11px 24px', marginTop: 14 }} onClick={save}>حفظ النموذج</button>
      </div>
    </div>
  )
}
