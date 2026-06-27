import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import Icon from '../Icon'

// زر «طلب إذن» لكل جلسة + مربع حوار إلزامي للسبب
export default function ExcuseButton({ studentId, sessionId, sessionTitle }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState(null)   // null | pending | approved | rejected
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.from('excuse_requests').select('status').eq('student_id', studentId).eq('session_id', sessionId).maybeSingle()
      .then(({ data }) => { if (alive) { setStatus(data?.status || null); setLoaded(true) } }, () => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [studentId, sessionId])

  async function submit() {
    if (reason.trim().length < 3) { toast('يرجى كتابة سبب واضح', 'error'); return }
    setBusy(true)
    try {
      const { error } = await supabase.from('excuse_requests')
        .insert({ student_id: studentId, session_id: sessionId, reason: reason.trim() })
      if (error) throw error
      setStatus('pending'); setOpen(false); setReason('')
      toast('تم إرسال طلب الاستئذان', 'success')
    } catch (e) {
      const m = (e.message || '').toLowerCase()
      toast(m.includes('duplicate') || m.includes('unique') ? 'سبق إرسال طلب لهذه الجلسة' : 'تعذّر الإرسال، حاول مجدداً', 'error')
    }
    setBusy(false)
  }

  if (!loaded) return null

  // إن وُجد طلب سابق، نعرض حالته بدل الزر
  if (status === 'pending') return <span className="excuse-badge pending"><Icon name="clock" size={12} /> طلب قيد المراجعة</span>
  if (status === 'approved') return <span className="excuse-badge approved"><Icon name="check" size={12} /> مستأذن</span>
  if (status === 'rejected') return <span className="excuse-badge rejected"><Icon name="x" size={12} /> رُفض الطلب</span>

  return (
    <>
      <button className="excuse-btn" onClick={() => setOpen(true)}><Icon name="bell" size={13} /> طلب إذن</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card excuse-modal" onClick={e => e.stopPropagation()}>
            <div className="excuse-modal-head">
              <div className="excuse-modal-ic"><Icon name="bell" size={22} /></div>
              <div>
                <h3>طلب استئذان</h3>
                <p className="muted">{sessionTitle}</p>
              </div>
            </div>
            <div className="field">
              <label>سبب الاستئذان <span className="req-star">*</span></label>
              <textarea rows={4} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="اكتب سبب طلبك للاستئذان عن هذه الجلسة…" autoFocus />
              <p className="excuse-note">سيراجع المشرف طلبك. عند القبول تُسجّل مستأذناً، وعند الرفض يُسجّل غياب.</p>
            </div>
            <div className="excuse-modal-actions">
              <button className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
              <button className="btn-primary" onClick={submit} disabled={busy || reason.trim().length < 3}>
                {busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
