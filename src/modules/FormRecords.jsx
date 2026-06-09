import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

// سجلات النماذج الموقّعة — للمشرف، مع تنزيل PDF يظهر فيه توقيع الطالب
export default function FormRecords() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('approval')

  async function load() {
    const { data } = await supabase.from('form_records')
      .select('*, form_templates(title, category, body), students(persons(full_name, nationality), buildings(name), unit_id)')
      .order('created_at', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function downloadPDF(rec) {
    // نجلب رابط التوقيع
    let sigUrl = ''
    if (rec.signature_path) {
      const { data } = await supabase.storage.from('student-docs').createSignedUrl(rec.signature_path, 3600)
      sigUrl = data?.signedUrl || ''
    }
    const p = rec.students?.persons
    const tpl = rec.form_templates
    const signedDate = new Date(rec.signed_at || rec.created_at).toLocaleDateString('ar')
    // نولّد نافذة طباعة بنص عربي صحيح (RTL)
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${tpl?.title || 'نموذج'}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap');
        body { font-family: 'IBM Plex Sans Arabic', sans-serif; padding: 50px; color: #1a1f2b; line-height: 2; }
        .head { text-align: center; border-bottom: 3px solid #1f3864; padding-bottom: 16px; margin-bottom: 24px; }
        .head h1 { color: #1f3864; margin: 0; font-size: 24px; }
        .head .org { color: #666; font-size: 14px; margin-top: 6px; }
        .meta { background: #f5f7fa; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 14px; }
        .meta div { margin-bottom: 6px; }
        .body-text { font-size: 16px; line-height: 2.2; margin-bottom: 40px; white-space: pre-wrap; }
        .sign-area { margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; }
        .sign-box { text-align: center; }
        .sign-box img { max-width: 200px; max-height: 90px; display: block; margin: 0 auto 6px; }
        .sign-line { border-top: 1px solid #333; padding-top: 6px; font-size: 13px; min-width: 200px; }
        .stamp { font-size: 12px; color: #888; margin-top: 30px; text-align: center; border-top: 1px dashed #ccc; padding-top: 12px; }
        @media print { body { padding: 30px; } }
      </style></head><body>
      <div class="head"><h1>${tpl?.title || 'نموذج'}</h1><div class="org">جمعية تأصيل التعليمية — منصة رافد</div></div>
      <div class="meta">
        <div><strong>اسم الطالب:</strong> ${p?.full_name || ''}</div>
        <div><strong>الجنسية:</strong> ${p?.nationality || ''}</div>
        <div><strong>السكن:</strong> ${rec.students?.buildings?.name || 'غير محدّد'}</div>
      </div>
      <div class="body-text">${(tpl?.body || '').replace(/{اسم_الطالب}/g, p?.full_name || '').replace(/{الجنسية}/g, p?.nationality || '').replace(/{اسم_المبنى}/g, rec.students?.buildings?.name || '')}</div>
      <div class="sign-area">
        <div class="sign-box">
          ${sigUrl ? `<img src="${sigUrl}" alt="توقيع">` : ''}
          <div class="sign-line">توقيع الطالب: ${p?.full_name || ''}</div>
        </div>
        <div class="sign-box"><div class="sign-line">ختم إدارة الإسكان</div></div>
      </div>
      <div class="stamp">وُقّع إلكترونياً عبر منصة رافد بتاريخ ${signedDate} — إصدار النموذج رقم ${rec.signed_version || 1}</div>
      <script>window.onload = () => { setTimeout(() => window.print(), 500) }</script>
      </body></html>`)
    w.document.close()
  }

  if (loading) return <Spinner />
  const filtered = records.filter(r => r.form_templates?.category === filter)

  return (
    <div>
      <div className="metrics-head">
        <p className="muted" style={{ fontSize: 13 }}>سجلات النماذج التي وقّعها أو قدّمها الطلاب. يمكن تنزيلها PDF بتوقيع الطالب.</p>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="approval">الموافقات الموقّعة</option>
          <option value="request">الطلبات المقدّمة</option>
          <option value="notice">الإشعارات الإدارية</option>
        </select>
      </div>
      {filtered.length === 0 && <div className="panel muted">لا سجلات في هذا التصنيف.</div>}
      {filtered.map(r => (
        <div className="panel" key={r.id}>
          <div className="form-tpl-row">
            <div>
              <strong>{r.form_templates?.title}</strong>
              <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
                {r.students?.persons?.full_name} · {new Date(r.signed_at || r.created_at).toLocaleDateString('ar')}
                {r.status === 'approved' && <span className="attach-ok" style={{ marginright: 8 }}>✓ موقّع</span>}
                {r.status === 'pending' && <span className="pending-tag">بانتظار إعادة موافقة</span>}
              </div>
            </div>
            <div className="sess-actions">
              {r.form_templates?.category === 'approval' && r.status === 'approved' && (
                <button className="mini" onClick={() => downloadPDF(r)}>⬇ تنزيل PDF</button>
              )}
            </div>
          </div>
          {/* عرض بيانات الطلبات */}
          {r.form_templates?.category === 'request' && r.data && Object.keys(r.data).length > 0 && (
            <div className="req-data">
              {Object.entries(r.data).map(([k, v]) => v && <div key={k}><strong>{k.replace(/_/g, ' ')}:</strong> {v}</div>)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
