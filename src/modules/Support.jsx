import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import ExcelImport from './ExcelImport'

export default function Support() {
  const [records, setRecords] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [nr, setNr] = useState({ student_id: '', kind: 'in_kind', description: '', source: '', received_at: '' })
  const [msg, setMsg] = useState(null)

  async function loadAll() {
    const [r, s] = await Promise.all([
      supabase.from('support_records').select('*, students(persons(full_name))').order('created_at', { ascending: false }),
      supabase.from('students').select('id, persons(full_name, residency_no)'),
    ])
    setRecords(r.data || []); setStudents((s.data || []).map(x => ({ ...x, _res: x.persons?.residency_no }))); setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  async function add() {
    if (!nr.student_id || !nr.description) { setMsg('اختر الطالب واكتب الوصف'); return }
    await supabase.from('support_records').insert(nr)
    setNr({ student_id: '', kind: 'in_kind', description: '', source: '', received_at: '' }); setMsg('سُجّل الدعم'); loadAll()
  }

  if (loading) return <Spinner />
  return (
    <div>
      <div className="panel">
        <h3>تسجيل دعم لطالب</h3>
        <div className="form-row">
          <select value={nr.student_id} onChange={e => setNr({ ...nr, student_id: e.target.value })}>
            <option value="">اختر الطالب…</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.persons?.full_name}</option>)}
          </select>
          <select value={nr.kind} onChange={e => setNr({ ...nr, kind: e.target.value })}>
            <option value="in_kind">عيني</option><option value="cash">نقدي</option>
          </select>
          <input placeholder="الوصف (بطاقة، مبلغ…)" value={nr.description} onChange={e => setNr({ ...nr, description: e.target.value })} />
          <input placeholder="المصدر" value={nr.source} onChange={e => setNr({ ...nr, source: e.target.value })} />
          <input type="date" value={nr.received_at} onChange={e => setNr({ ...nr, received_at: e.target.value })} />
          <button onClick={add}>تسجيل</button>
        </div>
        {msg && <div className="save-ok">{msg}</div>}
      </div>
      <div className="panel">
        <h3>إضافة دعم دفعة واحدة من Excel</h3>
        <ExcelImport
          title="الدعم"
          table="support_records"
          columns={[
            { key: 'residency_no', label: 'رقم إقامة الطالب', sample: '2412345678' },
            { key: 'kind', label: 'النوع (عيني/نقدي)', sample: 'عيني' },
            { key: 'description', label: 'الوصف', sample: 'كيس دقيق' },
            { key: 'source', label: 'المصدر', sample: 'تبرع' },
            { key: 'received_at', label: 'التاريخ', sample: '2026-06-01' },
          ]}
          transform={(r) => {
            const st = students.find(s => s._res === r.residency_no)
            return {
              student_id: st ? st.id : null,
              kind: r.kind === 'نقدي' ? 'cash' : 'in_kind',
              description: r.description, source: r.source, received_at: r.received_at || null,
            }
          }}
          onDone={loadAll}
        />
      </div>
      <div className="panel">
        <h3>سجل الدعم</h3>
        {records.map(r => (
          <div key={r.id} className="list-line">
            {r.kind === 'cash' ? '💵' : '🎁'} {r.students?.persons?.full_name} — {r.description}
            <span className="muted"> {r.source} · {r.received_at}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
