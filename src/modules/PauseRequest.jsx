import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import Icon from '../Icon'

const DOW = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// تقويم صغير لاختيار تاريخ
function MiniCal({ value, onPick, minDate }) {
  const today = new Date()
  const init = value ? new Date(value + 'T00:00:00') : today
  const [view, setView] = useState(new Date(init.getFullYear(), init.getMonth(), 1))
  const y = view.getFullYear(), m = view.getMonth()
  const firstDow = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const cells = []; for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  return (
    <div className="pr-cal">
      <div className="pr-cal-bar">
        <button type="button" className="pr-nav" onClick={() => setView(new Date(y, m - 1, 1))}><Icon name="chevronRight" size={16} /></button>
        <span className="pr-month">{MON[m]} {y}</span>
        <button type="button" className="pr-nav" onClick={() => setView(new Date(y, m + 1, 1))}><Icon name="chevronLeft" size={16} /></button>
      </div>
      <div className="pr-dow">{DOW.map(d => <span key={d}>{d}</span>)}</div>
      <div className="pr-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={i}></span>
          const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const disabled = minDate && ds < minDate
          const sel = value === ds
          return <button type="button" key={i} className={'pr-day' + (sel ? ' sel' : '') + (disabled ? ' dis' : '')}
            onClick={() => !disabled && onPick(ds)} disabled={disabled}>{d}</button>
        })}
      </div>
    </div>
  )
}

// زر + نافذة طلب التوقّف عن الدراسة (للطالب)
export default function PauseRequest({ studentId }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [existing, setExisting] = useState(null)
  const [reason, setReason] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [wantRec, setWantRec] = useState(true)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(1)  // 1 السبب+الاستعداد، 2 التواريخ
  const todayStr = new Date().toLocaleDateString('en-CA')

  useEffect(() => {
    supabase.from('pause_requests').select('*').eq('student_id', studentId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setExisting(data), () => {})
  }, [studentId, open])

  useEffect(() => { if (open) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } } }, [open])

  async function submit() {
    if (reason.trim().length < 3) { toast('اكتب سبب التوقّف', 'error'); return }
    if (!start || !end) { toast('حدّد تاريخ البداية والنهاية', 'error'); return }
    if (end < start) { toast('تاريخ النهاية يجب أن يكون بعد البداية', 'error'); return }
    setBusy(true)
    try {
      const { error } = await supabase.from('pause_requests').insert({
        student_id: studentId, reason: reason.trim(), start_date: start, end_date: end, want_recordings: wantRec,
      })
      if (error) throw error
      toast('تم إرسال طلب التوقّف', 'success')
      setOpen(false); setReason(''); setStart(''); setEnd(''); setStep(1)
    } catch (e) { toast('تعذّر الإرسال، حاول مجدداً', 'error') }
    setBusy(false)
  }

  const activePause = existing && existing.status === 'approved' && existing.end_date >= todayStr

  return (
    <>
      <button className="pause-trigger" onClick={() => setOpen(true)}>
        <Icon name="clock" size={16} /> طلب توقّف عن الدراسة
      </button>
      {existing && existing.status === 'pending' && <span className="pause-badge pending">طلب التوقّف قيد المراجعة</span>}
      {activePause && <span className="pause-badge active">متوقّف حتى {existing.end_date}</span>}

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
              {step === 1 ? (
                <>
                  <label className="pr-label"><Icon name="edit" size={14} /> سبب التوقّف <span className="pr-req">إلزامي</span></label>
                  <textarea className="pr-textarea" rows={3} value={reason} maxLength={400}
                    onChange={e => setReason(e.target.value)} placeholder="اذكر سبب طلب التوقّف عن الدراسة…" autoFocus />
                  <label className="pr-toggle">
                    <input type="checkbox" checked={wantRec} onChange={e => setWantRec(e.target.checked)} />
                    <span className="pr-toggle-track"><span className="pr-toggle-thumb"></span></span>
                    <span className="pr-toggle-text">
                      <strong>الاستعداد للاستماع للدروس المسجّلة</strong>
                      <small>ستصلك روابط تسجيلات الدروس خلال فترة التوقّف</small>
                    </span>
                  </label>
                  <button className="pr-next" onClick={() => { if (reason.trim().length < 3) { toast('اكتب سبب التوقّف', 'error'); return } setStep(2) }}>
                    التالي: تحديد الفترة <Icon name="chevronLeft" size={16} />
                  </button>
                </>
              ) : (
                <>
                  <div className="pr-dates">
                    <div className="pr-date-col">
                      <label className="pr-label">من تاريخ</label>
                      <div className="pr-date-val">{start || '—'}</div>
                      <MiniCal value={start} onPick={setStart} minDate={todayStr} />
                    </div>
                  </div>
                  <div className="pr-dates">
                    <div className="pr-date-col">
                      <label className="pr-label">إلى تاريخ</label>
                      <div className="pr-date-val">{end || '—'}</div>
                      <MiniCal value={end} onPick={setEnd} minDate={start || todayStr} />
                    </div>
                  </div>
                  <div className="pr-foot">
                    <button className="pr-back" onClick={() => setStep(1)}>رجوع</button>
                    <button className="pr-send" onClick={submit} disabled={busy}>
                      {busy ? 'جارٍ الإرسال…' : <><Icon name="send" size={15} /> إرسال الطلب</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
