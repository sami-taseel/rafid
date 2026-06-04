import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const ITEMS = ['الأبواب', 'النوافذ', 'الكهرباء', 'السباكة', 'التكييف', 'المطبخ', 'دورة المياه', 'الأثاث', 'الجدران', 'الأرضيات']

export default function UnitInspection({ students }) {
  const [units, setUnits] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ unit_id: '', student_id: '', kind: 'تسليم', notes: '' })
  const [states, setStates] = useState({})
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('units').select('id, unit_no, buildings(name)').then(({ data }) => setUnits(data || []))
  }, [])

  async function save() {
    const items = ITEMS.map(it => ({ item: it, state: states[it] || 'سليم' }))
    await supabase.from('unit_inspections').insert({ ...form, items, student_id: form.student_id || null, unit_id: form.unit_id || null })
    setMsg('تم حفظ المعاينة'); setOpen(false); setStates({})
    setTimeout(() => setMsg(null), 2000)
  }

  return (
    <div className="panel">
      <div className="act-head">
        <h3>معاينة الشقة</h3>
        <button className="mini" onClick={() => setOpen(!open)}>{open ? 'إغلاق' : '+ معاينة جديدة'}</button>
      </div>
      {msg && <div className="save-ok">{msg}</div>}
      {open && (
        <div>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <select value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })}>
              <option value="">اختر الشقة (اختياري)…</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.buildings?.name} - {u.unit_no}</option>)}
            </select>
            <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}>
              <option value="">الطالب (اختياري)…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.persons?.full_name}</option>)}
            </select>
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
              <option>تسليم</option><option>استلام</option>
            </select>
          </div>
          <div className="inspect-list">
            {ITEMS.map(it => (
              <div className="inspect-row" key={it}>
                <span>{it}</span>
                <div className="inspect-btns">
                  {[['سليم','ok'],['يحتاج صيانة','warn'],['غير صالح','bad']].map(([l, cls]) => (
                    <button key={l} className={states[it] === l ? 'ins-btn sel ' + cls : 'ins-btn'}
                      onClick={() => setStates({ ...states, [it]: l })}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <textarea placeholder="ملاحظات إضافية" value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            style={{ width: '100%', marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'inherit', minHeight: 70 }} />
          <button className="save-btn" onClick={save}>حفظ المعاينة</button>
        </div>
      )}
    </div>
  )
}
