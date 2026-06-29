import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import Icon from '../Icon'
import { useToast } from '../Toast'

// نافذة باركود الحضور — مشتركة بين صفحتي الأنشطة والحضور
// mode: 'present' (حضور) | 'recorded' (استماع مسجّل)
export default function QRModal({ session, onClose, mode = 'present' }) {
  const toast = useToast()
  const [dataUrl, setDataUrl] = useState(null)
  const [tab, setTab] = useState(mode)   // تبويب نشط: حضور أو استماع مسجّل
  const sessName = session.title || session.activities?.title || 'الجلسة'
  const param = tab === 'recorded' ? 'record' : 'checkin'
  const url = window.location.origin + '/#' + param + '=' + session.id

  useEffect(() => {
    QRCode.toDataURL(url, { width: 320, margin: 2 }).then(setDataUrl)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [url])

  const isRec = tab === 'recorded'

  // تحويل dataURL إلى ملف للمشاركة
  async function dataUrlToFile() {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    return new File([blob], `باركود-${sessName}.png`, { type: 'image/png' })
  }

  // مشاركة عبر واجهة الجوال الأصلية (واتساب/بريد/…)
  async function share() {
    try {
      const file = await dataUrlToFile()
      const shareData = {
        title: 'باركود حضور: ' + sessName,
        text: `امسح هذا الرمز لتسجيل حضورك في «${sessName}». أو افتح الرابط: ${url}`,
      }
      // إن كان جهاز يدعم مشاركة الملفات
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ ...shareData, files: [file] })
      } else if (navigator.share) {
        await navigator.share(shareData)   // مشاركة النص والرابط فقط
      } else {
        copyLink()  // بديل: نسخ الرابط
      }
    } catch (e) { /* المستخدم ألغى المشاركة */ }
  }

  function download() {
    const a = document.createElement('a')
    a.href = dataUrl; a.download = `باركود-${sessName}.png`; a.click()
    toast('تم تنزيل الباركود', 'success')
  }

  function copyLink() {
    navigator.clipboard?.writeText(url).then(
      () => toast('تم نسخ رابط الحضور', 'success'),
      () => toast('تعذّر النسخ', 'error')
    )
  }

  return createPortal(
    <div className="qrm-overlay" onClick={onClose}>
      <div className="qrm-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="qrm-close" onClick={onClose} aria-label="إغلاق"><Icon name="x" size={18} /></button>
        <div className="qrm-head">
          <div className="qrm-head-ic" style={isRec ? { background: 'linear-gradient(135deg, #6b3fc0, #9166d8)' } : undefined}>
            <Icon name={isRec ? 'clock' : 'image'} size={20} />
          </div>
          <h3 className="qrm-title">{isRec ? 'باركود الاستماع المسجّل' : 'باركود الحضور'}</h3>
          <p className="qrm-sub">{sessName}{session.planned_date ? ` · ${session.planned_date}` : ''}</p>
        </div>

        {/* تبويبات: حضور / استماع مسجّل */}
        <div className="qrm-tabs">
          <button className={'qrm-tab' + (!isRec ? ' on' : '')} onClick={() => setTab('present')}>
            <Icon name="check" size={14} /> حضور
          </button>
          <button className={'qrm-tab' + (isRec ? ' on rec' : '')} onClick={() => setTab('recorded')}>
            <Icon name="clock" size={14} /> استماع مسجّل
          </button>
        </div>

        <div className="qrm-code">
          {dataUrl ? <img src={dataUrl} alt="باركود" /> : <div className="qrm-loading"><div className="spinner"></div></div>}
        </div>
        <p className="qrm-hint">{isRec
          ? 'رمز خاص لمن استمع للتسجيل لاحقاً — يُسجّل «استماع مسجّل»'
          : 'يَمسح الطالب الرمز بكاميرا الجوال لتسجيل حضوره'}</p>

        <div className="qrm-actions">
          {navigator.share && (
            <button className="qrm-btn qrm-btn-primary" onClick={share}>
              <Icon name="send" size={16} /> مشاركة
            </button>
          )}
          <button className="qrm-btn qrm-btn-ghost" onClick={download}>
            <Icon name="download" size={16} /> تنزيل
          </button>
          <button className="qrm-btn qrm-btn-ghost" onClick={copyLink}>
            <Icon name="paperclip" size={16} /> نسخ الرابط
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// حارس: هل يُسمح بتوليد باركود لهذه الجلسة؟ (لا قبل يوم الجلسة)
export function canGenerateQR(session) {
  const todayStr = new Date().toLocaleDateString('en-CA')
  return !(session.planned_date && session.planned_date > todayStr)
}
