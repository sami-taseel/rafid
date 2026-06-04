import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'

// مكوّن استيراد عام قابل لإعادة الاستخدام لأي وحدة
// columns: [{ key, label, sample }]  | table: اسم الجدول | transform: دالة تحويل صف (اختياري)
export default function ExcelImport({ title, columns, table, transform, onDone }) {
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  function downloadTemplate() {
    const header = {}; columns.forEach(c => { header[c.label] = c.sample || '' })
    const ws = XLSX.utils.json_to_sheet([header])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'البيانات')
    XLSX.writeFile(wb, `نموذج_${title}.xlsx`)
  }

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      // نحوّل أسماء الأعمدة العربية إلى مفاتيح الحقول
      const mapped = json.map(r => {
        const obj = {}
        columns.forEach(c => { obj[c.key] = r[c.label] ?? '' })
        return transform ? transform(obj) : obj
      }).filter(r => Object.values(r).some(v => v !== '' && v != null))
      setRows(mapped)
      setMsg(`تم قراءة ${mapped.length} صف. راجعها ثم احفظ.`)
    }
    reader.readAsBinaryString(file)
  }

  async function save() {
    if (!rows.length) return
    setBusy(true)
    const { error } = await supabase.from(table).insert(rows)
    setBusy(false)
    if (error) { setMsg('خطأ: ' + error.message); return }
    setMsg(`تم حفظ ${rows.length} سجل بنجاح.`)
    setRows([]); onDone && onDone()
  }

  return (
    <div className="import-box">
      <div className="import-actions">
        <button className="mini" onClick={downloadTemplate}>⬇ تحميل النموذج</button>
        <label className="mini upload-label">
          ⬆ رفع ملف Excel
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} hidden />
        </label>
      </div>
      {msg && <div className="save-ok" style={{ marginTop: 10 }}>{msg}</div>}
      {rows.length > 0 && (
        <>
          <div className="import-preview">
            <table>
              <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>{columns.map(c => <td key={c.key}>{String(r[c.key] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && <div className="muted" style={{ padding: 8 }}>… و{rows.length - 5} صف آخر</div>}
          </div>
          <button className="save-btn" onClick={save} disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : `حفظ ${rows.length} سجل`}
          </button>
        </>
      )}
    </div>
  )
}
