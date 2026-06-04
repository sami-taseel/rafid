import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('audit_log').select('*, persons(full_name)').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [])
  if (loading) return <Spinner />
  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>سجل بأحدث 100 عملية مهمة في المنصة.</p>
      {logs.length === 0 && <div className="panel muted">لا توجد عمليات مسجّلة بعد. سيبدأ التسجيل مع استخدام المنصة.</div>}
      {logs.map(l => (
        <div key={l.id} className="list-line">
          <strong>{l.action}</strong> {l.entity && '· ' + l.entity}
          {l.details && <span className="muted"> — {l.details}</span>}
          <span className="muted" style={{ float: 'left' }}>{l.persons?.full_name || '—'} · {new Date(l.created_at).toLocaleString('ar')}</span>
        </div>
      ))}
    </div>
  )
}
