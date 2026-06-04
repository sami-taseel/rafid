import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function CheckIn({ sessionId, onDone }) {
  const [msg, setMsg] = useState('جارٍ تسجيل حضورك…')
  const [ok, setOk] = useState(false)
  useEffect(() => {
    async function run() {
      const { data, error } = await supabase.rpc('self_check_in', { p_session: sessionId })
      if (error) setMsg('تعذّر التسجيل. تأكد أنك مسجّل دخولك كطالب.')
      else { setMsg(data); setOk(true) }
    }
    run()
  }, [sessionId])
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="تأصيل" className="login-logo" />
        <div style={{ fontSize: 44, margin: '16px 0' }}>{ok ? '✅' : '⏳'}</div>
        <p style={{ fontSize: 17, marginBottom: 20 }}>{msg}</p>
        <button className="login-submit" onClick={onDone}>العودة للرئيسية</button>
      </div>
    </div>
  )
}
