import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import Icon from '../Icon'
import { Spinner } from './Students'
import { formatDate } from '../dateUtils'

// صفحة المدير: طلبات الإذن عن الجلسات
export default function ExcuseRequests() {
  const toast = useToast()
  const [list, setList] = useState(null)
  const [busy, setBusy] = useState(null)

  async function load() {
    const { data } = await supabase.rpc('pending_excuses')
    setList(data || [])
  }
  useEffect(() => { load() }, [])

  async function decide(id, decision) {
    setBusy(id)
    try {
      const { error } = await supabase.rpc('review_excuse', { p_request: id, p_decision: decision })
      if (error) throw error
      toast(decision === 'approved' ? 'تم القبول وإشعار الطالب' : 'تم الرفض وإشعار الطالب', decision === 'approved' ? 'success' : 'info')
      setList(prev => prev.filter(x => x.id !== id))
    } catch (e) { toast('تعذّر تنفيذ القرار', 'error') }
    setBusy(null)
  }

  if (list === null) return <Spinner />

  return (
    <div>
      <h2 className="section-title">طلبات الإذن</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        راجع طلبات إذن الطلاب عن الجلسات. القبول يسجّل الطالب «مستأذناً»، والرفض يسجّله «غائباً»، ويُشعر الطالب في الحالتين.
      </p>

      {list.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Icon name="check" size={34} />
          <div style={{ marginTop: 8 }}>لا طلبات إذن معلّقة</div>
        </div>
      )}

      <div className="excuse-list">
        {list.map(e => (
          <div key={e.id} className="excuse-req-card">
            <div className="excuse-req-top">
              <div className="excuse-req-av">{(e.student_name || '؟').charAt(0)}</div>
              <div className="excuse-req-info">
                <div className="excuse-req-name">{e.student_name}</div>
                <div className="excuse-req-session">
                  {e.session_title}{e.planned_date && <span className="faint"> · {formatDate(e.planned_date)}</span>}
                </div>
              </div>
            </div>
            <div className="excuse-req-reason">
              <span className="excuse-req-label">السبب:</span> {e.reason}
            </div>
            <div className="excuse-req-actions">
              <button className="excuse-approve" disabled={busy === e.id} onClick={() => decide(e.id, 'approved')}>
                <Icon name="check" size={15} /> قبول (مستأذن)
              </button>
              <button className="excuse-reject" disabled={busy === e.id} onClick={() => decide(e.id, 'rejected')}>
                <Icon name="x" size={15} /> رفض (غياب)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export async function pendingExcuseCount() {
  const { data } = await supabase.rpc('pending_excuses')
  return (data || []).length
}
