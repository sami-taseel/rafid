import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [mode, setMode] = useState('login')   // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null); setInfo(null); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('تم إنشاء حسابك بنجاح. يمكنك الآن الدخول وإكمال بياناتك.')
        setMode('login')
      }
    } catch (err) {
      setError(mode === 'login'
        ? 'تعذّر الدخول. تأكد من البريد وكلمة المرور.'
        : 'تعذّر إنشاء الحساب. قد يكون البريد مستخدماً من قبل.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="جمعية تأصيل التعليمية" className="login-logo" />
          <h1>منصة رافد</h1>
        </div>

        <div className="login-tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => { setMode('login'); setError(null); setInfo(null) }}
            type="button">تسجيل الدخول</button>
          <button
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => { setMode('signup'); setError(null); setInfo(null) }}
            type="button">حساب جديد</button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>البريد الإلكتروني</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com" dir="ltr" required />
          <label>كلمة المرور</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required minLength={6} />
          {error && <div className="login-error">{error}</div>}
          {info && <div className="save-ok">{info}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'جارٍ…' : (mode === 'login' ? 'دخول' : 'إنشاء حساب')}
          </button>
        </form>

        <p className="login-hint">
          {mode === 'login' ? 'للطلاب والمشرفين وإدارة المشروع' : 'أنشئ حسابك ثم أكمل بياناتك'}
        </p>
      </div>
    </div>
  )
}
