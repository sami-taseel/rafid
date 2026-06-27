import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import Icon from '../Icon'

// زر «طلب إذن» احترافي لكل جلسة + مربع حوار إلزامي للسبب
export default function ExcuseButton({ studentId, sessionId, sessionTitle, sessionDate }) {
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

  // قفل تمرير الخلفية عند فتح المربع
  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }
  }, [open])

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

  // إلغاء طلب معلّق (قبل مراجعة المشرف)
  async function cancelRequest() {
    setBusy(true)
    try {
      const { error } = await supabase.from('excuse_requests')
        .delete().eq('student_id', studentId).eq('session_id', sessionId).eq('status', 'pending')
      if (error) throw error
      setStatus(null)
      toast('تم إلغاء الطلب', 'info')
    } catch (e) { toast('تعذّر إلغاء الطلب', 'error') }
    setBusy(false)
  }

  if (!loaded) return null

  // حالة الطلب السابق
  if (status === 'pending') return (
    <span className="exc-status-row">
      <span className="exc-chip exc-chip-pending"><Icon name="clock" size={13} /> قيد المراجعة</span>
      <button className="exc-cancel-link" onClick={cancelRequest} disabled={busy}>إلغاء الطلب</button>
    </span>
  )
  if (status === 'approved') return <span className="exc-chip exc-chip-approved"><Icon name="check" size={13} /> مستأذن</span>
  if (status === 'rejected') return <span className="exc-chip exc-chip-rejected"><Icon name="x" size={13} /> رُفض الطلب</span>

  const reasonOk = reason.trim().length >= 3

  return (
    <>
      <button className="exc-trigger" onClick={() => setOpen(true)}>
        <Icon name="hand" size={15} /> طلب استئذان
      </button>

      {open && (
        <div className="exc-overlay" onClick={() => !busy && setOpen(false)}>
          <div className="exc-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            {/* الترويسة المتدرّجة */}
            <div className="exc-dialog-hero">
              <button className="exc-close" onClick={() => !busy && setOpen(false)} aria-label="إغلاق"><Icon name="x" size={18} /></button>
              <div className="exc-hero-ic"><Icon name="hand" size={26} /></div>
              <h3 className="exc-hero-title">طلب استئذان</h3>
              <p className="exc-hero-sub">{sessionTitle}{sessionDate ? ` · ${sessionDate}` : ''}</p>
            </div>

            {/* الجسم */}
            <div className="exc-dialog-body">
              <label className="exc-label">
                <Icon name="edit" size={14} /> سبب الاستئذان <span className="exc-required">إلزامي</span>
              </label>
              <textarea className="exc-textarea" rows={4} value={reason} maxLength={400}
                onChange={e => setReason(e.target.value)} autoFocus
                placeholder="اكتب سبب طلبك للاستئذان عن هذه الجلسة بوضوح…" />
              <div className="exc-char">{reason.length}/400</div>

              <div className="exc-info-box">
                <Icon name="alert" size={15} />
                <span>سيراجع المشرف طلبك. عند <strong>القبول</strong> تُسجّل مستأذناً، وعند <strong>الرفض</strong> يُسجّل غياب. ستصلك النتيجة بإشعار.</span>
              </div>
            </div>

            {/* الأزرار */}
            <div className="exc-dialog-foot">
              <button className="exc-btn-cancel" onClick={() => !busy && setOpen(false)}>إلغاء</button>
              <button className="exc-btn-send" onClick={submit} disabled={busy || !reasonOk}>
                {busy ? <>جارٍ الإرسال…</> : <><Icon name="send" size={15} /> إرسال الطلب</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
