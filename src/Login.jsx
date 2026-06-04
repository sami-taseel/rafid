import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // عند النجاح، يتكفّل App بإعادة العرض تلقائياً
    } catch (err) {
      setError('تعذّر تسجيل الدخول. تأكد من البريد وكلمة المرور.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <h1>منصة رافد</h1>
          <p>جمعية تأصيل التعليمية</p>
        </div>
        <form onSubmit={handleLogin}>
          <label>البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com"
            dir="ltr"
            required
          />
          <label>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
          </button>
        </form>
        <p className="login-hint">الدخول مخصّص للمشرفين وإدارة المشروع</p>
      </div>
    </div>
  )
}
