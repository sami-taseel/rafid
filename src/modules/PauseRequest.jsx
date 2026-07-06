import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { useConfirm } from '../Confirm'
import Icon from '../Icon'

const DOW = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// تقويم مدى (نمط حجز الطيران): نقرة أولى = البداية، ثانية = النهاية
function RangeCal({ start, end, onChange, minDate }) {
  const today = new Date()
  const base = start ? new Date(start + 'T00:00:00') : today
  const [view, setView] = useState(new Date(base.getFullYear(), base.getMonth(), 1))
  const y = view.getFullYear(), m = view.getMonth()
  const firstDow = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const cells = []; for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)

  function pick(ds) {
    // لا بداية بعد، أو مدى مكتمل → نبدأ من جديد
    if (!start || (start && end)) { onChange(ds, null); return }
    // توجد بداية فقط
    if (ds < start) { onChange(ds, null); return }   // اختار أبكر → يصبح البداية
    onChange(start, ds)                               // اختار أحدث → يصبح النهاية
  }

  return (
    <div className="rc-cal">
      <div className="rc-bar">
        <button type="button" className="rc-nav" onClick={() => setView(new Date(y, m - 1, 1))}><Icon name="chevronRight" size={18} /></button>
        <span className="rc-month">{MON[m]} {y}</span>
        <button type="button" className="rc-nav" onClick={() => setView(new Date(y, m + 1, 1))}><Icon name="chevronLeft" size={18} /></button>
      </div>
      <div className="rc-dow">{DOW.map(d => <span key={d}>{d}</span>)}</div>
      <div className="rc-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={i} className="rc-empty"></span>
          const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const disabled = minDate && ds < minDate
          const isStart = ds === start, isEnd = ds === end
          const inRange = start && end && ds > start && ds < end
          let cls = 'rc-day'
          if (disabled) cls += ' dis'
          if (isStart) cls += ' start'
          if (isEnd) cls += ' end'
          if (inRange) cls += ' in'
          return <button type="button" key={i} className={cls} onClick={() => !disabled && pick(ds)} disabled={disabled}>{d}</button>
        })}
      </div>
      <div className="rc-hint">اختر يوم البداية ثم يوم النهاية</div>
    </div>
  )
}

export default function PauseRequest({ studentId }) {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [open, setOpen] = useState(false)
  const [existing, setExisting] = useState(null)
  const [reason, setReason] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [wantRec, setWantRec] = useState(true)
  const [busy, setBusy] = useState(false)
  const todayStr = new Date().toLocaleDateString('en-CA')

  async function loadExisting() {
    const { data } = await supabase.from('pause_requests').select('*').eq('student_id', studentId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle().then(r => r, () => ({ data: null }))
    setExisting(data)
  }
  useEffect(() => { loadExisting() }, [studentId])
  useEffect(() => { if (open) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } } }, [open])

  async function submit() {
    if (reason.trim().length < 3) { toast('اكتب سبب التوقّف', 'error'); return }
    if (!start || !end) { toast('حدّد فترة التوقّف (البداية والنهاية)', 'error'); return }
    setBusy(true)
    try {
      const { error } = await supabase.from('pause_requests').insert({
        student_id: studentId, reason: reason.trim(), start_date: start, end_date: end, want_recordings: wantRec,
      })
      if (error) throw error
      toast('تم إرسال طلب التوقّف', 'success')
      setOpen(false); setReason(''); setStart(''); setEnd('')
      loadExisting()
    } catch (e) { toast('تعذّر الإرسال، حاول مجدداً', 'error') }
    setBusy(false)
  }

  async function cancelRequestSafe() {
    const ok = await confirmDialog({
      title: 'إلغاء طلب التوقّف',
      message: isPending ? 'سيُلغى طلب التوقّف المعلّق. هل أنت متأكد؟'
        : 'سيُلغى توقّفك المعتمد وتعود جلسات الفترة القادمة لحالتها. هل أنت متأكد؟',
      confirmText: 'نعم، إلغاء الطلب', danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      // نلغي الطلب؛ وإن كان معتمداً نُعيد جلسات الفترة القادمة (المستأذنة) إلى غير مرصودة
      if (isApproved) {
        await supabase.rpc('cancel_pause', { p_request: existing.id }).then(r => r, () => {})
      }
      await supabase.from('pause_requests').delete().eq('id', existing.id)
      toast('تم إلغاء طلب التوقّف', 'info')
      setExisting(null); loadExisting()
    } catch (e) { toast('تعذّر الإلغاء', 'error') }
    setBusy(false)
  }

  const isPending = existing && existing.status === 'pending'
  const isApproved = existing && existing.status === 'approved' && existing.end_date >= todayStr
  const blocked = isPending || isApproved   // لا يُسمح بطلب جديد

  return (
    <>
      {blocked ? (
        <div className="pause-active-row">
          <span className={'pause-badge ' + (isPending ? 'pending' : 'active')}>
            <Icon name={isPending ? 'clock' : 'check'} size={14} />
            {isPending ? ' طلب التوقّف قيد المراجعة' : ` متوقّف حتى ${existing.end_date}`}
          </span>
          <button className="pause-cancel" onClick={cancelRequestSafe} disabled={busy}>
            <Icon name="x" size={14} /> إلغاء الطلب
          </button>
        </div>
      ) : (
        <button className="pause-trigger" onClick={() => setOpen(true)}>
          <Icon name="clock" size={16} /> طلب توقّف عن الدراسة
        </button>
      )}

      {open && createPortal(
        <div className="pr-overlay" onClick={() => !busy && setOpen(false)}>
          <div className="pr-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="pr-hero">
              <button className="pr-close" onClick={() => !busy && setOpen(false)} aria-label="إغلاق"><Icon name="x" size={18} /></button>
              <div className="pr-hero-ic"><Icon name="clock" size={24} /></div>
              <h3 className="pr-title">طلب توقّف عن الدراسة</h3>
              <p className="pr-sub">تُسجّل مستأذناً خلال الفترة بعد موافقة الإدارة</p>
            </div>

            <div className="pr-body">
              <label className="pr-label"><Icon name="edit" size={14} /> سبب التوقّف <span className="pr-req">إلزامي</span></label>
              <textarea className="pr-textarea" rows={2} value={reason} maxLength={400}
                onChange={e => setReason(e.target.value)} placeholder="اذكر سبب طلب التوقّف عن الدراسة…" autoFocus />

              <label className="pr-label" style={{ marginTop: 16 }}><Icon name="calendar" size={14} /> فترة التوقّف</label>
              <div className="pr-range-summary">
                <div className={'pr-range-chip' + (start ? ' filled' : '')}>
                  <span className="pr-range-lbl">من</span>
                  <span className="pr-range-val">{start || 'اختر'}</span>
                </div>
                <Icon name="chevronLeft" size={16} />
                <div className={'pr-range-chip' + (end ? ' filled' : '')}>
                  <span className="pr-range-lbl">إلى</span>
                  <span className="pr-range-val">{end || 'اختر'}</span>
                </div>
              </div>
              <RangeCal start={start} end={end} minDate={todayStr}
                onChange={(s, e) => { setStart(s); setEnd(e) }} />

              <label className="pr-toggle">
                <input type="checkbox" checked={wantRec} onChange={e => setWantRec(e.target.checked)} />
                <span className="pr-toggle-track"><span className="pr-toggle-thumb"></span></span>
                <span className="pr-toggle-text">
                  <strong>الاستعداد للاستماع للدروس المسجّلة</strong>
                  <small>ستصلك روابط تسجيلات الدروس خلال فترة التوقّف</small>
                </span>
              </label>

              <button className="pr-send" onClick={submit} disabled={busy}>
                {busy ? 'جارٍ الإرسال…' : <><Icon name="send" size={15} /> إرسال الطلب</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
