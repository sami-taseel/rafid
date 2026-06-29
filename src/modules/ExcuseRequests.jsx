import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [rejectFor, setRejectFor] = useState(null)  // الطلب الجاري رفضه
  const [rejectReason, setRejectReason] = useState('')

  async function load() {
    const { data } = await supabase.rpc('pending_excuses')
    setList(data || [])
  }
  useEffect(() => { load() }, [])

  async function approve(id) {
    setBusy(id)
    try {
      const { error } = await supabase.rpc('review_excuse', { p_request: id, p_decision: 'approved' })
      if (error) throw error
      toast('تم القبول وإشعار الطالب', 'success')
      setList(prev => prev.filter(x => x.id !== id))
    } catch (e) { toast('تعذّر تنفيذ القرار', 'error') }
    setBusy(null)
  }

  async function confirmReject() {
    const id = rejectFor.id
    setBusy(id)
    try {
      const { error } = await supabase.rpc('review_excuse', {
        p_request: id, p_decision: 'rejected', p_reject_reason: rejectReason.trim() || null,
      })
      if (error) throw error
      toast('تم الرفض وإشعار الطالب بالسبب', 'info')
      setList(prev => prev.filter(x => x.id !== id))
      setRejectFor(null); setRejectReason('')
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
              <button className="excuse-approve" disabled={busy === e.id} onClick={() => approve(e.id)}>
                <Icon name="check" size={15} /> قبول (مستأذن)
              </button>
              <button className="excuse-reject" disabled={busy === e.id} onClick={() => { setRejectFor(e); setRejectReason('') }}>
                <Icon name="x" size={15} /> رفض (غياب)
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* مربع سبب الرفض */}
      {rejectFor && createPortal(
        <div className="exc-overlay" onClick={() => !busy && setRejectFor(null)}>
          <div className="exc-dialog" onClick={ev => ev.stopPropagation()} role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
            <div className="exc-dialog-hero" style={{ background: 'linear-gradient(135deg, #b32d2d, #d85a5a)' }}>
              <button className="exc-close" onClick={() => !busy && setRejectFor(null)} aria-label="إغلاق"><Icon name="x" size={18} /></button>
              <div className="exc-hero-ic"><Icon name="x" size={26} /></div>
              <h3 className="exc-hero-title">رفض طلب الإذن</h3>
              <p className="exc-hero-sub">{rejectFor.student_name} · {rejectFor.session_title}</p>
            </div>
            <div className="exc-dialog-body">
              <label className="exc-label"><Icon name="edit" size={14} /> سبب الرفض <span className="exc-required">يُرسل للطالب</span></label>
              <textarea className="exc-textarea" rows={3} value={rejectReason} maxLength={300}
                onChange={ev => setRejectReason(ev.target.value)} autoFocus
                placeholder="وضّح سبب رفض الطلب ليصل الطالب في الإشعار…" />
              <div className="exc-char">{rejectReason.length}/300</div>
              <div className="exc-info-box" style={{ background: '#fce8e8', color: '#8a2020' }}>
                <Icon name="alert" size={15} />
                <span>سيُسجّل الطالب <strong>غائباً</strong>، وسيصله الإشعار مع سبب الرفض.</span>
              </div>
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

export async function pendingExcuseCount() {
  const { data } = await supabase.rpc('pending_excuses')
  return (data || []).length
}
