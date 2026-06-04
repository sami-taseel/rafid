import { useState } from 'react'
import { supabase } from './supabaseClient'

function Eye() {
  return (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>)
}
function EyeOff() {
  return (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-3.36 2.34A9.1 9.1 0 0 1 12 18c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>)
}

export default function Login() {
  const [mode, setMode] = useState('login')   // login | signup | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
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
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('تم إنشاء حسابك بنجاح. يمكنك الآن الدخول وإكمال بياناتك.')
        setMode('login'); setPassword('')
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setInfo('أرسلنا رابط استعادة كلمة المرور إلى بريدك. تفقّد صندوق الوارد.')
      }
    } catch (err) {
      const m = (err.message || '').toLowerCase()
      if (m.includes('invalid login')) setError('البريد أو كلمة المرور غير صحيحة. تأكد منهما أو أنشئ حساباً جديداً.')
      else if (m.includes('already registered') || m.includes('already been')) setError('هذا البريد مسجّل من قبل. جرّب تسجيل الدخول أو استعادة كلمة المرور.')
      else if (m.includes('rate limit')) setError('محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.')
      else setError('حدث خطأ. تأكد من البيانات وحاول مرة أخرى.')
    } finally { setLoading(false) }
  }

  async function googleLogin() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError('تعذّر الدخول عبر Google. قد لا تكون الميزة مفعّلة بعد.')
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="جمعية تأصيل التعليمية" className="login-logo" />
          <h1>منصة رافد</h1>
        </div>

        {mode !== 'reset' && (
          <div className="login-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null); setInfo(null) }} type="button">تسجيل الدخول</button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(null); setInfo(null) }} type="button">حساب جديد</button>
          </div>
        )}

        {mode === 'reset' && <div className="reset-head">استعادة كلمة المرور</div>}

        <form onSubmit={handleSubmit}>
          <label>البريد الإلكتروني</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com" dir="ltr" required />

          {mode !== 'reset' && (
            <>
              <label>كلمة المرور</label>
              <div className="password-field">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} title={showPass ? 'إخفاء' : 'إظهار'}>
                  {showPass ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </>
          )}

          {mode === 'login' && (
            <div className="login-row">
              <label className="remember">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> تذكّرني
              </label>
              <button type="button" className="link-btn" onClick={() => { setMode('reset'); setError(null); setInfo(null) }}>نسيت كلمة المرور؟</button>
            </div>
          )}

          {error && <div className="login-error">{error}</div>}
          {info && <div className="save-ok">{info}</div>}

          <button type="submit" disabled={loading} className="login-submit">
            {loading ? 'جارٍ…' : (mode === 'login' ? 'دخول' : mode === 'signup' ? 'إنشاء حساب' : 'إرسال رابط الاستعادة')}
          </button>
        </form>

        {mode === 'reset' ? (
          <button type="button" className="link-btn center" onClick={() => { setMode('login'); setError(null); setInfo(null) }}>← العودة لتسجيل الدخول</button>
        ) : (
          <>
            <div className="divider"><span>أو</span></div>
            <button type="button" className="google-btn" onClick={googleLogin}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8c-.2 1.1-.8 2-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3C2.4 16.1 5.4 18 9 18z"/><path fill="#FBBC05" d="M3.9 10.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V5H.9C.3 6.2 0 7.5 0 9s.3 2.8.9 4z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6C13.5.9 11.4 0 9 0 5.4 0 2.4 1.9.9 5l3 2.3C4.6 5.1 6.6 3.6 9 3.6z"/></svg>
              المتابعة عبر Google
            </button>
          </>
        )}

        <p className="login-hint">للطلاب والمشرفين وإدارة المشروع</p>
      </div>
    </div>
  )
}
