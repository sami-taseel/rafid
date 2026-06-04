import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault(); setError(null); setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => { onDone && onDone() }, 1800)
    } catch (err) {
      setError('تعذّر تعيين كلمة المرور. قد يكون الرابط منتهياً، أعد طلب الاستعادة.')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="تأصيل" className="login-logo" />
          <h1>كلمة مرور جديدة</h1>
        </div>
        {done ? (
          <div className="save-ok">تم تعيين كلمة المرور بنجاح. جارٍ تحويلك…</div>
        ) : (
          <form onSubmit={submit}>
            <label>كلمة المرور الجديدة</label>
            <div className="pass-wrap">
              <input type={show ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
              <button type="button" className="pass-toggle" onClick={() => setShow(!show)}>
                {show ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" disabled={loading} className="login-submit">
              {loading ? 'جارٍ…' : 'حفظ كلمة المرور'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
