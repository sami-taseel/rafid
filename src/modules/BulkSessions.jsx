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
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('')
  const [count, setCount] = useState(8)
  const [startNum, setStartNum] = useState(1)
  const [titlesText, setTitlesText] = useState('')
  const [busy, setBusy] = useState(false)

  const baseLabel = activity?.activity_type || 'الدرس'
  const titles = titlesText.split('\n').map(t => t.trim()).filter(Boolean)
  const total = mode === 'numbered' ? Number(count) || 0 : titles.length

  // أول موعد يوافق اليوم المختار ابتداءً من startDate
  function firstDate() {
    const d = new Date(startDate + 'T00:00:00')
    const target = Number(dow)
    const diff = (target - d.getDay() + 7) % 7
    d.setDate(d.getDate() + diff)
    return d
  }

  // معاينة التواريخ والعناوين
  function preview() {
    const out = []
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
        seq_no: mode === 'numbered' ? Number(startNum) + i : null,
        chain_shift: mode === 'numbered',   // المرقّمة: التأجيل يزحزح ما بعدها
      }))
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
          </div>

          {/* الإعدادات المشتركة */}
          <div className="bs-grid">
            <div className="bs-field">
              <label>يوم الأسبوع</label>
              <select value={dow} onChange={e => setDow(e.target.value)}>
                {DOW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="bs-field">
              <label>يبدأ من تاريخ</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="bs-field">
              <label>وقت الجلسة</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="bs-field">
              <label>المدة (دقيقة)</label>
              <input type="number" min="0" value={duration} placeholder="اختياري"
                onChange={e => setDuration(e.target.value)} />
            </div>
          </div>

          {/* حقول حسب النوع */}
          {mode === 'numbered' ? (
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

          {/* ملاحظة سلوك التأجيل */}
          <div className={'bs-note ' + mode}>
            <Icon name="alert" size={15} />
            <span>{mode === 'numbered'
              ? 'الجلسات مرقّمة ومترابطة: عند تأجيل جلسة، تُزحزح الجلسات التالية أسبوعاً تلقائياً.'
              : 'الجلسات مستقلة: تأجيل جلسة لا يؤثّر على مواعيد بقية الجلسات.'}</span>
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
