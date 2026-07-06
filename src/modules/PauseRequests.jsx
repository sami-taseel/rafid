import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import Icon from '../Icon'
import { Spinner } from './Students'
import { formatDate } from '../dateUtils'

// صفحة المدير: طلبات التوقّف عن الدراسة
export default function PauseRequests() {
  const toast = useToast()
  const [list, setList] = useState(null)
  const [busy, setBusy] = useState(null)
  const [rejectFor, setRejectFor] = useState(null)
  const [reason, setReason] = useState('')

  async function load() {
    const { data } = await supabase.rpc('pending_pauses')
    setList(data || [])
  }
  useEffect(() => { load() }, [])

  async function approve(id) {
    setBusy(id)
    try {
      const { error } = await supabase.rpc('review_pause', { p_request: id, p_decision: 'approved' })
      if (error) throw error
      toast('تمت الموافقة وإشعار الطالب', 'success')
      setList(prev => prev.filter(x => x.id !== id))
    } catch (e) { toast('تعذّر التنفيذ', 'error') }
    setBusy(null)
  }
  async function confirmReject() {
    const id = rejectFor.id; setBusy(id)
    try {
      const { error } = await supabase.rpc('review_pause', { p_request: id, p_decision: 'rejected', p_reject_reason: reason.trim() || null })
      if (error) throw error
      toast('تم الرفض وإشعار الطالب بالسبب', 'info')
      setList(prev => prev.filter(x => x.id !== id)); setRejectFor(null); setReason('')
    } catch (e) { toast('تعذّر التنفيذ', 'error') }
    setBusy(null)
  }

  if (list === null) return <Spinner />
  return (
    <div>
      <h2 className="section-title">طلبات التوقّف عن الدراسة</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        راجع طلبات توقّف الطلاب. الموافقة تسجّل الطالب «مستأذناً» في كل جلسات الفترة، ويُشعر الطالب في الحالتين.
      </p>
      {list.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Icon name="check" size={34} /><div style={{ marginTop: 8 }}>لا طلبات توقّف معلّقة</div>
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
                  <Icon name="calendar" size={13} /> {formatDate(e.start_date)} ← {formatDate(e.end_date)}
                  {e.want_recordings && <span className="pause-rec-tag">🎧 يريد التسجيلات</span>}
                </div>
              </div>
            </div>
            <div className="excuse-req-reason"><span className="excuse-req-label">السبب:</span> {e.reason}</div>
            <div className="excuse-req-actions">
              <button className="excuse-approve" disabled={busy === e.id} onClick={() => approve(e.id)}>
                <Icon name="check" size={15} /> موافقة (مستأذن للفترة)
              </button>
              <button className="excuse-reject" disabled={busy === e.id} onClick={() => { setRejectFor(e); setReason('') }}>
                <Icon name="x" size={15} /> رفض
              </button>
            </div>
          </div>
        ))}
      </div>

      {rejectFor && createPortal(
        <div className="exc-overlay" onClick={() => !busy && setRejectFor(null)}>
          <div className="exc-dialog" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="exc-dialog-hero" style={{ background: 'linear-gradient(135deg, #b32d2d, #d85a5a)' }}>
              <button className="exc-close" onClick={() => !busy && setRejectFor(null)}><Icon name="x" size={18} /></button>
              <div className="exc-hero-ic"><Icon name="x" size={26} /></div>
              <h3 className="exc-hero-title">رفض طلب التوقّف</h3>
              <p className="exc-hero-sub">{rejectFor.student_name}</p>
            </div>
            <div className="exc-dialog-body">
              <label className="exc-label"><Icon name="edit" size={14} /> سبب الرفض <span className="exc-required">يُرسل للطالب</span></label>
              <textarea className="exc-textarea" rows={3} value={reason} maxLength={300}
                onChange={ev => setReason(ev.target.value)} placeholder="وضّح سبب رفض الطلب…" autoFocus />
            </div>
            <div className="exc-dialog-foot">
              <button className="exc-btn-cancel" onClick={() => !busy && setRejectFor(null)}>إلغاء</button>
              <button className="exc-btn-send" style={{ background: 'linear-gradient(135deg, #b32d2d, #d85a5a)' }}
                onClick={confirmReject} disabled={busy === rejectFor.id}>
                {busy === rejectFor.id ? 'جارٍ…' : <><Icon name="x" size={15} /> تأكيد الرفض</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export async function pendingPauseCount() {
  const { data } = await supabase.rpc('pending_pauses')
  return (data || []).length
}
