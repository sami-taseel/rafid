import { useRef, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'

// لوحة رسم التوقيع: تدعم اللمس والفأرة، تزيل الخلفية، وتحفظ صورة شفافة
export default function SignaturePad({ studentId, currentPath, onSaved }) {
  const toast = useToast()
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(!currentPath)
  const [viewUrl, setViewUrl] = useState(null)

  useEffect(() => {
    if (currentPath) {
      supabase.storage.from('student-docs').createSignedUrl(currentPath, 3600).then(({ data }) => { if (data) setViewUrl(data.signedUrl) })
    }
  }, [currentPath])

  useEffect(() => {
    if (!editing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'

    function pos(e) {
      const r = canvas.getBoundingClientRect()
      const t = e.touches ? e.touches[0] : e
      return { x: (t.clientX - r.left) * (canvas.width / r.width), y: (t.clientY - r.top) * (canvas.height / r.height) }
    }
    function start(e) { e.preventDefault(); drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
    function move(e) { if (!drawing.current) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasDrawn(true) }
    function end() { drawing.current = false }

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end)
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end)
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end)
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', end)
    }
  }, [editing])

  function clear() {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  // إزالة الخلفية: البكسلات الفاتحة → شفافة
  function removeBackground(canvas) {
    const ctx = canvas.getContext('2d')
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const brightness = (r + g + b) / 3
      if (brightness > 200) { d[i + 3] = 0 }          // خلفية فاتحة → شفافة
      else { d[i] = 17; d[i + 1] = 17; d[i + 2] = 17 } // خط التوقيع → أسود داكن
    }
    ctx.putImageData(img, 0, 0)
  }

  async function save() {
    if (!hasDrawn) { toast('ارسم توقيعك أولاً', 'error'); return }
    setBusy(true)
    const src = canvasRef.current
    // ننسخ على لوحة جديدة لإزالة الخلفية دون التأثير على المعروضة
    const tmp = document.createElement('canvas'); tmp.width = src.width; tmp.height = src.height
    tmp.getContext('2d').drawImage(src, 0, 0)
    removeBackground(tmp)
    const blob = await new Promise(res => tmp.toBlob(res, 'image/png'))
    const path = `signatures/${studentId}_${Date.now()}.png`
    const { error } = await supabase.storage.from('student-docs').upload(path, blob, { contentType: 'image/png', upsert: true })
    if (error) { setBusy(false); toast('تعذّر حفظ التوقيع: ' + error.message, 'error'); return }
    await supabase.from('students').update({ signature_path: path }).eq('id', studentId)
    setBusy(false); setEditing(false); toast('تم حفظ توقيعك')
    const { data } = await supabase.storage.from('student-docs').createSignedUrl(path, 3600)
    if (data) setViewUrl(data.signedUrl)
    onSaved && onSaved(path)
  }

  return (
    <div className="sig-pad">
      {!editing && viewUrl ? (
        <div className="sig-view">
          <div className="sig-view-label">توقيعك المحفوظ:</div>
          <img src={viewUrl} alt="التوقيع" className="sig-img" />
          <button className="mini" onClick={() => { setEditing(true); setHasDrawn(false) }}>✎ إعادة رسم التوقيع</button>
        </div>
      ) : (
        <>
          <div className="sig-hint">ارسم توقيعك في المساحة أدناه:</div>
          <canvas ref={canvasRef} width={500} height={180} className="sig-canvas" />
          <div className="sig-actions">
            <button className="save-btn" style={{ width: 'auto', padding: '10px 22px' }} onClick={save} disabled={busy}>{busy ? 'جارٍ…' : 'حفظ التوقيع'}</button>
            <button className="mini" onClick={clear}>مسح</button>
            {currentPath && <button className="mini" onClick={() => setEditing(false)}>إلغاء</button>}
          </div>
        </>
      )}
    </div>
  )
}
