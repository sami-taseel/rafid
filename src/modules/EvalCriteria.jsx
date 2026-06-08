import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useToast } from '../Toast'
import { useConfirm } from '../Confirm'

// إدارة معايير التقييم (للمدير)
export default function EvalCriteria() {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('eval_criteria').select('*').order('sort_order')
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    const max = rows.reduce((m, r) => Math.max(m, r.sort_order), 0)
    await supabase.from('eval_criteria').insert({ name: 'معيار جديد', max_score: 10, sort_order: max + 1 })
    load()
  }
  function patch(id, p) { setRows(rows.map(r => r.id === id ? { ...r, ...p } : r)) }
  async function save(r) {
    await supabase.from('eval_criteria').update({ name: r.name, max_score: Number(r.max_score) || 10, is_active: r.is_active }).eq('id', r.id)
    toast('تم الحفظ')
  }
  async function del(id) {
    const ok = await confirmDialog({ title: 'حذف المعيار', message: 'سيُحذف معيار التقييم.', confirmText: 'احذف', danger: true })
    if (!ok) return
    await supabase.from('eval_criteria').delete().eq('id', id); load()
  }

  if (loading) return <Spinner />
  return (
    <div>
      <p className="muted" style={{ marginBottom: 14 }}>معايير تقييم الطلاب (للمقابلة والتقييم السنوي). التغييرات تُحفظ عند الخروج من الحقل.</p>
      {rows.map(r => (
        <div className="panel" key={r.id}>
          <div className="form-row">
            <input value={r.name} onChange={e => patch(r.id, { name: e.target.value })} onBlur={() => save(r)} placeholder="اسم المعيار" style={{ flex: 2 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label className="muted" style={{ fontSize: 13 }}>الدرجة القصوى</label>
              <input type="number" value={r.max_score} onChange={e => patch(r.id, { max_score: e.target.value })} onBlur={() => save(r)} style={{ width: 70 }} />
            </div>
            <label className="chk"><input type="checkbox" checked={r.is_active} onChange={e => { patch(r.id, { is_active: e.target.checked }); setTimeout(() => save({ ...r, is_active: e.target.checked }), 0) }} /> مُفعّل</label>
            <button className="fr-del" onClick={() => del(r.id)}>حذف</button>
          </div>
        </div>
      ))}
      <button className="add-field-btn" onClick={add}>+ إضافة معيار</button>
    </div>
  )
}
