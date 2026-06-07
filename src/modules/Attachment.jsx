import { useState } from 'react'
import { signedUrl, isImage } from '../ticketUtils'

// يعرض المرفق داخل المنصة: صورة في نافذة، أو ملف يُفتح برابط موقّع
export default function Attachment({ path, label = 'عرض المرفق' }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(null)
  const [err, setErr] = useState(false)

  async function show() {
    try {
      const u = await signedUrl(path)
      setUrl(u)
      if (isImage(path)) setOpen(true)
      else window.open(u, '_blank')
    } catch { setErr(true) }
  }

  return (
    <>
      <button type="button" className="att-link" onClick={show}>📎 {label}</button>
      {err && <span className="att-err">تعذّر فتح المرفق</span>}
      {open && url && (
        <div className="att-overlay" onClick={() => setOpen(false)}>
          <div className="att-box" onClick={e => e.stopPropagation()}>
            <button className="att-close" onClick={() => setOpen(false)}>✕</button>
            <img src={url} alt="مرفق" />
            <a className="mini" href={url} target="_blank" rel="noopener" download>تنزيل الصورة</a>
          </div>
        </div>
      )}
    </>
  )
}
