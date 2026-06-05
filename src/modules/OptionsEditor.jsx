import { useState } from 'react'

// محرّر خيارات مرئي: إضافة/حذف/ترتيب/لصق جماعي/ترتيب أبجدي
// value: مصفوفة نصوص | onChange: (arr) => void
export default function OptionsEditor({ value, onChange }) {
  const opts = Array.isArray(value) ? value : []
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)

  function update(arr) { onChange(arr) }
  function add() { update([...opts, '']) }
  function setAt(i, v) { update(opts.map((o, idx) => idx === i ? v : o)) }
  function removeAt(i) { update(opts.filter((_, idx) => idx !== i)) }
  function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= opts.length) return
    const arr = [...opts];[arr[i], arr[j]] = [arr[j], arr[i]]; update(arr)
  }
  function sortAlpha() { update([...opts].sort((a, b) => a.localeCompare(b, 'ar'))) }
  function applyBulk() {
    const items = bulk.split(/[\n،,]+/).map(s => s.trim()).filter(Boolean)
    if (items.length) update([...opts.filter(Boolean), ...items])
    setBulk(''); setShowBulk(false)
  }

  return (
    <div className="opt-editor">
      <div className="opt-toolbar">
        <button type="button" className="mini" onClick={add}>+ خيار</button>
        <button type="button" className="mini" onClick={() => setShowBulk(!showBulk)}>لصق جماعي</button>
        <button type="button" className="mini" onClick={sortAlpha} disabled={opts.length < 2}>ترتيب أبجدي</button>
      </div>

      {showBulk && (
        <div className="opt-bulk">
          <textarea value={bulk} onChange={e => setBulk(e.target.value)}
            placeholder="الصق كل خيار في سطر، أو افصلها بفاصلة:&#10;إندونيسيا&#10;تونس&#10;المالديف" />
          <div className="opt-bulk-actions">
            <button type="button" className="mini" onClick={applyBulk}>إضافة الكل</button>
            <button type="button" className="mini" onClick={() => { setShowBulk(false); setBulk('') }}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="opt-list">
        {opts.map((o, i) => (
          <div className="opt-row" key={i}>
            <div className="opt-move">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="أعلى">▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === opts.length - 1} aria-label="أسفل">▼</button>
            </div>
            <input value={o} onChange={e => setAt(i, e.target.value)} placeholder={'خيار ' + (i + 1)} />
            <button type="button" className="opt-del" onClick={() => removeAt(i)} aria-label="حذف">✕</button>
          </div>
        ))}
        {opts.length === 0 && <div className="muted" style={{ fontSize: 13, padding: '8px 0' }}>لا خيارات بعد. أضِف خياراً أو الصق قائمة.</div>}
      </div>
    </div>
  )
}
