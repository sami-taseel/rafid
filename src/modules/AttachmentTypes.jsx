import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useToast } from '../Toast'
import { useConfirm } from '../Confirm'

const CONDITIONS = [['', 'يظهر للجميع'], ['families_only', 'لساكني عمارة العوائل فقط']]

export default function AttachmentTypes() {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [savedId, setSavedId] = useState(null)

  async function load() {
    const { data } = await supabase.from('attachment_types').select('*').order('sort_order')
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    const max = rows.reduce((m, r) => Math.max(m, r.sort_order), 0)
    const { data } = await supabase.from('attachment_types').insert({ name: 'مرفق جديد', sort_order: max + 1 }).select().single()
    await load(); if (data) setOpenId(data.id)
  }
  function patch(id, p) { setRows(rows.map(r => r.id === id ? { ...r, ...p } : r)) }
  async function save(r) {
    await supabase.from('attachment_types').update({
      name: r.name, owner_type: r.owner_type, required: r.required,
      renew_months: r.renew_months || null, condition: r.condition || null, is_active: r.is_active,
    }).eq('id', r.id)
    setSavedId(r.id); setTimeout(() => setSavedId(null), 1500)
  }
  async function del(id) {
    const ok = await confirmDialog({ title: 'حذف المرفق', message: 'سيُحذف نوع المرفق.', confirmText: 'احذف', danger: true })
    if (!ok) return
    await supabase.from('attachment_types').delete().eq('id', id); load()
  }

  if (loading) return <Spinner />
  return (
    <div>
      <p className="muted" style={{ marginBottom: 14 }}>عرّف المرفقات المطلوبة من الطلاب ومرافقيهم. اضغط أي مرفق لتعديله. التغييرات تُحفظ تلقائياً.</p>
      <div className="acc-list">
        {rows.map(r => {
          const open = openId === r.id
          return (
            <div className={'acc-card' + (open ? ' open' : '')} key={r.id}>
              <div className="acc-head" onClick={() => setOpenId(open ? null : r.id)}>
                <div className="acc-title">
                  <span className="acc-chevron">{open ? '▾' : '▸'}</span>
                  <span>{r.name}</span>
                  {!r.is_active && <span className="pill-off">مخفي</span>}
                </div>
                <div className="acc-sub">
                  <span className="acc-type-badge">{r.owner_type === 'companion' ? 'مرافق' : 'طالب'}</span>
                  {r.required && <span className="req-badge">إلزامي</span>}
                  {r.renew_months && <span className="muted">يتجدّد كل {r.renew_months} شهر</span>}
                  {savedId === r.id && <span className="saved-flag">✓ حُفظ</span>}
                </div>
              </div>
              {open && (
                <div className="acc-body">
                  <div className="field"><label>اسم المرفق</label>
                    <input value={r.name} onChange={e => patch(r.id, { name: e.target.value })} onBlur={() => save(r)} /></div>
                  <div className="form-row">
                    <div className="field" style={{ flex: 1 }}><label>لمن؟</label>
                      <select value={r.owner_type} onChange={e => { patch(r.id, { owner_type: e.target.value }); setTimeout(() => save({ ...r, owner_type: e.target.value }), 0) }}>
                        <option value="student">الطالب</option><option value="companion">المرافق</option>
                      </select></div>
                    <div className="field" style={{ flex: 1 }}><label>التجديد (بالأشهر، اتركه فارغاً لمرفق دائم)</label>
                      <input type="number" value={r.renew_months || ''} onChange={e => patch(r.id, { renew_months: e.target.value })} onBlur={() => save(r)} placeholder="مثال: 6" /></div>
                  </div>
                  <div className="field"><label>شرط الظهور</label>
                    <select value={r.condition || ''} onChange={e => { patch(r.id, { condition: e.target.value }); setTimeout(() => save({ ...r, condition: e.target.value }), 0) }}>
                      {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select></div>
                  <div className="acc-toggles">
                    <label className="chk"><input type="checkbox" checked={r.required} onChange={e => { patch(r.id, { required: e.target.checked }); setTimeout(() => save({ ...r, required: e.target.checked }), 0) }} /> إلزامي</label>
                    <label className="chk"><input type="checkbox" checked={r.is_active} onChange={e => { patch(r.id, { is_active: e.target.checked }); setTimeout(() => save({ ...r, is_active: e.target.checked }), 0) }} /> ظاهر للطلاب</label>
                    <button className="fr-del" onClick={() => del(r.id)}>حذف</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button className="add-field-btn" onClick={add}>+ إضافة مرفق</button>
    </div>
  )
}
