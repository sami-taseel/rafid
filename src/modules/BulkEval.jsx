import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'

// تقييم جماعي: يطبّق نفس الدرجات على الطلاب المحدّدين
export default function BulkEval({ studentIds, studentNames, onClose }) {
  const toast = useToast()
  const [criteria, setCriteria] = useState([])
  const [scores, setScores] = useState({})
  const [evalType, setEvalType] = useState('annual')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('eval_criteria').select('*').eq('is_active', true).order('sort_order').then(({ data }) => setCriteria(data || []))
  }, [])

  const total = criteria.reduce((s, c) => s + (Number(scores[c.id]) || 0), 0)
  const maxTotal = criteria.reduce((s, c) => s + (c.max_score || 10), 0)
  const pct = maxTotal ? Math.round(total / maxTotal * 100) : 0

  async function save() {
    if (criteria.length === 0) { toast('لا توجد معايير تقييم', 'error'); return }
    setBusy(true)
    const { data: au } = await supabase.auth.getUser()
    let pid = null
    if (au?.user) { const { data: p } = await supabase.from('persons').select('id').eq('auth_user_id', au.user.id).maybeSingle(); pid = p?.id }

    // ننشئ تقييماً لكل طالب محدّد بنفس الدرجات
    for (const sid of studentIds) {
      const { data: ev } = await supabase.from('evaluations').insert({
        student_id: sid, eval_type: evalType, evaluator: pid, total_score: total, max_total: maxTotal, notes,
      }).select().single()
      if (ev) {
        const rows = criteria.map(c => ({ evaluation_id: ev.id, criteria_id: c.id, score: Number(scores[c.id]) || 0 }))
        await supabase.from('evaluation_scores').insert(rows)
      }
    }
    setBusy(false)
    toast('تم تقييم ' + studentIds.length + ' طالب'); onClose(true)
  }

  return (
    <div className="confirm-overlay" onClick={() => onClose(false)}>
      <div className="confirm-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, textAlign: 'right', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="confirm-title">تقييم جماعي — {studentIds.length} طالب</div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>ستُطبَّق نفس الدرجات على: {studentNames.slice(0, 3).join('، ')}{studentNames.length > 3 ? ` و${studentNames.length - 3} آخرين` : ''}.</p>

        <div className="field"><label>نوع التقييم</label>
          <select value={evalType} onChange={e => setEvalType(e.target.value)}>
            <option value="annual">تقييم سنوي</option>
            <option value="interview">مقابلة</option>
          </select></div>

        {criteria.map(c => (
          <div key={c.id} className="bulk-eval-row">
            <div className="bulk-eval-head">
              <span>{c.name}</span>
              <span className="bulk-eval-score">{scores[c.id] || 0} / {c.max_score || 10}</span>
            </div>
            <input type="range" min="0" max={c.max_score || 10} value={scores[c.id] || 0}
              onChange={e => setScores({ ...scores, [c.id]: e.target.value })} className="bulk-eval-slider" />
          </div>
        ))}

        <div className="bulk-eval-total">
          <span>المجموع: <strong>{total} / {maxTotal}</strong></span>
          <span className="bulk-eval-pct">{pct}%</span>
        </div>

        <div className="field"><label>ملاحظات (تُطبّق على الجميع)</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات اختيارية…" /></div>

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={() => onClose(false)}>إلغاء</button>
          <button className="confirm-ok" onClick={save} disabled={busy}>{busy ? 'جارٍ…' : 'حفظ التقييم للجميع'}</button>
        </div>
      </div>
    </div>
  )
}
