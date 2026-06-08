import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// صفحة حالة النظام: تفحص الخدمات الأساسية حيّاً
export default function SystemStatus() {
  const [checks, setChecks] = useState({ db: null, storage: null, auth: null })
  const [running, setRunning] = useState(false)

  async function runChecks() {
    setRunning(true)
    setChecks({ db: null, storage: null, auth: null })
    // قاعدة البيانات
    const t0 = performance.now()
    try {
      const { error } = await supabase.from('app_settings').select('key').limit(1)
      setChecks(c => ({ ...c, db: { ok: !error, ms: Math.round(performance.now() - t0) } }))
    } catch { setChecks(c => ({ ...c, db: { ok: false, ms: 0 } })) }
    // التخزين
    const t1 = performance.now()
    try {
      const { error } = await supabase.storage.from('student-docs').list('', { limit: 1 })
      setChecks(c => ({ ...c, storage: { ok: !error, ms: Math.round(performance.now() - t1) } }))
    } catch { setChecks(c => ({ ...c, storage: { ok: false, ms: 0 } })) }
    // المصادقة
    const t2 = performance.now()
    try {
      const { data } = await supabase.auth.getSession()
      setChecks(c => ({ ...c, auth: { ok: !!data, ms: Math.round(performance.now() - t2) } }))
    } catch { setChecks(c => ({ ...c, auth: { ok: false, ms: 0 } })) }
    setRunning(false)
  }
  useEffect(() => { runChecks() }, [])

  const items = [
    { key: 'db', icon: '🗄️', label: 'قاعدة البيانات' },
    { key: 'storage', icon: '📁', label: 'التخزين (الملفات)' },
    { key: 'auth', icon: '🔑', label: 'المصادقة (الدخول)' },
  ]
  const allOk = Object.values(checks).every(c => c?.ok)
  const anyDone = Object.values(checks).some(c => c !== null)

  return (
    <div>
      <div className="panel">
        <div className="status-head">
          <div>
            <h3>حالة النظام</h3>
            <p className="muted" style={{ fontSize: 13 }}>فحص حيّ لخدمات المنصة الأساسية.</p>
          </div>
          <button className="mini" onClick={runChecks} disabled={running}>{running ? 'جارٍ الفحص…' : 'إعادة الفحص'}</button>
        </div>
        {anyDone && (
          <div className={'status-overall ' + (allOk ? 'ok' : 'warn')}>
            {allOk ? '✓ جميع الخدمات تعمل بشكل طبيعي' : '⚠️ هناك خدمة لا تستجيب'}
          </div>
        )}
      </div>

      <div className="status-grid">
        {items.map(it => {
          const c = checks[it.key]
          return (
            <div key={it.key} className="status-card">
              <div className="status-icon">{it.icon}</div>
              <div className="status-label">{it.label}</div>
              {c === null ? (
                <div className="status-dot checking">جارٍ الفحص…</div>
              ) : c.ok ? (
                <div className="status-dot up">● يعمل · {c.ms}ms</div>
              ) : (
                <div className="status-dot down">● لا يستجيب</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
