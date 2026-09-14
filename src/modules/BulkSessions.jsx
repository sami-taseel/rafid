import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import Icon from '../Icon'

const DOW = [
  ['0', 'الأحد'], ['1', 'الإثنين'], ['2', 'الثلاثاء'], ['3', 'الأربعاء'],
  ['4', 'الخميس'], ['5', 'الجمعة'], ['6', 'السبت'],
]

// تحويل رقم إلى ترتيب عربي (الأول، الثاني، …)
const ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر',
  'التاسع عشر', 'العشرون', 'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون',
  'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون']
function ordinal(n) { return ORD[n] || String(n) }

// نافذة توليد جلسات أسبوعية دفعة واحدة
export default function BulkSessions({ activity, onClose, onDone }) {
  const toast = useToast()
  const [mode, setMode] = useState('numbered')   // numbered | titled
  const [dow, setDow] = useState('0')
  const [dows, setDows] = useState([0])          // أيام الأسبوع للوضع اليومي
  const [breaks, setBreaks] = useState([])       // فترات التوقّف
  const [brTitle, setBrTitle] = useState('')
  const [brFrom, setBrFrom] = useState('')
  const [brTo, setBrTo] = useState('')
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('')
  const [count, setCount] = useState(8)
  const [startNum, setStartNum] = useState(1)
  const [titlesText, setTitlesText] = useState('')
  const [busy, setBusy] = useState(false)

  const baseLabel = activity?.activity_type || 'الدرس'
  const titles = titlesText.split('\n').map(t => t.trim()).filter(Boolean)
  const total = (mode === 'numbered' || mode === 'daily') ? Number(count) || 0 : titles.length

  // أول موعد يوافق اليوم المختار ابتداءً من startDate
  function firstDate() {
    const d = new Date(startDate + 'T00:00:00')
    const target = Number(dow)
    const diff = (target - d.getDay() + 7) % 7
    d.setDate(d.getDate() + diff)
    return d
  }

  // معاينة التواريخ والعناوين
  // هل هذا اليوم ضمن فترة توقّف؟
  function inBreak(ds) {
    return breaks.some(b => ds >= b.from && ds <= b.to)
  }

  function preview() {
    const out = []
    if (mode === 'daily') {
      if (!dows.length) return out
      let d = new Date(startDate + 'T00:00:00')
      let made = 0, guard = 0, no = Number(startNum) || 1
      while (made < total && guard < 2000) {
        guard++
        const ds = d.toLocaleDateString('en-CA')
        if (dows.includes(d.getDay()) && !inBreak(ds)) {
          out.push({ date: ds, title: `${baseLabel} ${ordinal(no)}` })
          made++; no++
        }
        d.setDate(d.getDate() + 1)
      }
      return out
    }
    const d0 = firstDate()
    for (let i = 0; i < Math.min(total, 60); i++) {
      const d = new Date(d0); d.setDate(d0.getDate() + i * 7)
      const title = mode === 'numbered'
        ? `${baseLabel} ${ordinal(Number(startNum) + i)}`
        : titles[i]
      out.push({ date: d.toLocaleDateString('en-CA'), title })
    }
    return out
  }

  async function generate() {
    const rows = preview()
    if (!rows.length) { toast(mode === 'numbered' ? 'حدّد عدد الجلسات' : 'اكتب عناوين الجلسات', 'error'); return }
    setBusy(true)
    try {
      const payload = rows.map((r, i) => ({
        activity_id: activity.id,
        planned_date: r.date,
        title: r.title,
        start_time: startTime || null,
        duration_min: duration ? Number(duration) : null,
        status: 'scheduled',
        seq_no: (mode === 'numbered' || mode === 'daily') ? Number(startNum) + i : null,
        chain_shift: (mode === 'numbered' || mode === 'daily'),   // المرقّمة: التأجيل يزحزح ما بعدها
      }))
      // نحفظ فترات التوقّف أولاً (للوضع اليومي)
      if (mode === 'daily' && breaks.length) {
        await supabase.from('study_breaks').insert(
          breaks.map(b => ({ title: b.title, start_date: b.from, end_date: b.to, activity_id: activity.id })))
          .then(r => r, () => {})
      }
      const { error } = await supabase.from('sessions').insert(payload)
      if (error) throw error
      toast(`أُضيفت ${rows.length} جلسة بنجاح`, 'success')
      onDone(); onClose()
    } catch (e) {
      toast('تعذّرت الإضافة: ' + (e.message || ''), 'error')
    }
    setBusy(false)
  }

  const rows = preview()

  return createPortal(
    <div className="bs-overlay" onClick={() => !busy && onClose()}>
      <div className="bs-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="bs-hero">
          <button className="bs-close" onClick={() => !busy && onClose()} aria-label="إغلاق"><Icon name="x" size={18} /></button>
          <div className="bs-hero-ic"><Icon name="calendar" size={22} /></div>
          <h3 className="bs-title">إضافة جلسات أسبوعية</h3>
          <p className="bs-sub">{activity?.title}</p>
        </div>

        <div className="bs-body">
          {/* نوع الجلسات */}
          <div className="bs-modes">
            <button className={'bs-mode' + (mode === 'numbered' ? ' on' : '')} onClick={() => setMode('numbered')}>
              <strong>جلسات مرقّمة</strong>
              <small>{baseLabel} الأول، الثاني…</small>
            </button>
            <button className={'bs-mode' + (mode === 'titled' ? ' on' : '')} onClick={() => setMode('titled')}>
              <strong>عناوين مختلفة</strong>
              <small>عنوان لكل أسبوع</small>
            </button>
            <button className={'bs-mode' + (mode === 'daily' ? ' on' : '')} onClick={() => setMode('daily')}>
              <strong>جلسات يومية</strong>
              <small>أيام محدّدة + فترات توقّف</small>
            </button>
          </div>

          {/* الإعدادات المشتركة */}
          <div className="bs-grid">
            {mode === 'daily' ? (
              <div className="bs-field" style={{ gridColumn: '1 / -1' }}>
                <label>أيام الأسبوع <span className="bs-hint">(اختر يوماً أو أكثر)</span></label>
                <div className="bs-dows">
                  {DOW.map(([v, l]) => (
                    <button type="button" key={v}
                      className={'bs-dow' + (dows.includes(Number(v)) ? ' on' : '')}
                      onClick={() => setDows(p => p.includes(Number(v)) ? p.filter(x => x !== Number(v)) : [...p, Number(v)])}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bs-field">
                <label>يوم الأسبوع</label>
                <select value={dow} onChange={e => setDow(e.target.value)}>
                  {DOW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
            <div className="bs-field">
              <label>يبدأ من تاريخ</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="bs-field">
              <label>وقت الجلسة</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="bs-field">
              <label>المدة</label>
              <select value={duration} onChange={e => setDuration(e.target.value)}>
                <option value="">غير محدّدة</option>
                <option value="30">نصف ساعة</option>
                <option value="45">٤٥ دقيقة</option>
                <option value="60">ساعة</option>
                <option value="90">ساعة ونصف</option>
                <option value="120">ساعتان</option>
                <option value="150">ساعتان ونصف</option>
                <option value="180">٣ ساعات</option>
              </select>
            </div>
          </div>

          {/* حقول حسب النوع */}
          {(mode === 'numbered' || mode === 'daily') ? (
            <div className="bs-grid">
              <div className="bs-field">
                <label>عدد الجلسات</label>
                <input type="number" min="1" max="60" value={count} onChange={e => setCount(e.target.value)} />
              </div>
              <div className="bs-field">
                <label>يبدأ الترقيم من <span className="bs-hint">(لو سبق تدريس جلسات)</span></label>
                <input type="number" min="1" value={startNum} onChange={e => setStartNum(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="bs-field">
              <label>عناوين الجلسات <span className="bs-hint">(عنوان في كل سطر، بالترتيب)</span></label>
              <textarea rows={6} value={titlesText} onChange={e => setTitlesText(e.target.value)}
                placeholder={'مقدمة في المنهج\nأدوات البحث\nتحليل النتائج'} />
              <div className="bs-count">{titles.length} عنوان</div>
            </div>
          )}

          {mode === 'daily' && (
            <div className="bs-breaks">
              <div className="bs-breaks-head">
                <Icon name="calendar" size={14} /> فترات التوقّف
                <span className="bs-hint">(إجازات أو اختبارات تُتخطّى عند التوليد)</span>
              </div>
              {breaks.map((b, i) => (
                <div className="bs-break" key={i}>
                  <span className="bs-break-t">{b.title}</span>
                  <span className="bs-break-d">{b.from} ← {b.to}</span>
                  <button onClick={() => setBreaks(breaks.filter((_, j) => j !== i))} aria-label="حذف">✕</button>
                </div>
              ))}
              <div className="bs-break-add">
                <input placeholder="عنوان الفترة" value={brTitle} onChange={e => setBrTitle(e.target.value)} />
                <input type="date" value={brFrom} onChange={e => setBrFrom(e.target.value)} />
                <input type="date" value={brTo} onChange={e => setBrTo(e.target.value)} />
                <button onClick={() => {
                  if (!brTitle.trim() || !brFrom || !brTo) return
                  setBreaks([...breaks, { title: brTitle.trim(), from: brFrom, to: brTo }])
                  setBrTitle(''); setBrFrom(''); setBrTo('')
                }} disabled={!brTitle.trim() || !brFrom || !brTo}>＋</button>
              </div>
            </div>
          )}

          {/* ملاحظة سلوك التأجيل */}
          <div className={'bs-note ' + (mode === 'titled' ? 'titled' : 'numbered')}>
            <Icon name="alert" size={15} />
            <span>{mode === 'titled'
              ? 'الجلسات مستقلة: تأجيل جلسة لا يؤثّر على مواعيد بقية الجلسات.'
              : 'الجلسات مرقّمة ومترابطة: عند تأجيل جلسة، تُزحزح الجلسات التالية تلقائياً.'}</span>
          </div>

          {/* المعاينة */}
          {rows.length > 0 && (
            <div className="bs-preview">
              <div className="bs-preview-head">معاينة ({rows.length} جلسة)</div>
              <div className="bs-preview-list">
                {rows.slice(0, 8).map((r, i) => (
                  <div className="bs-preview-row" key={i}>
                    <span className="bs-pv-num">{i + 1}</span>
                    <span className="bs-pv-title">{r.title}</span>
                    <span className="bs-pv-date">{r.date}</span>
                  </div>
                ))}
                {rows.length > 8 && <div className="bs-preview-more">…و{rows.length - 8} جلسة أخرى</div>}
              </div>
            </div>
          )}

          <button className="bs-generate" onClick={generate} disabled={busy || !rows.length}>
            {busy ? 'جارٍ الإضافة…' : <><Icon name="plus" size={16} /> إضافة {rows.length} جلسة</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
