import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function CheckIn({ sessionId, mode = 'present', onDone }) {
  const isRec = mode === 'recorded'
  const [msg, setMsg] = useState(isRec ? 'جارٍ تسجيل استماعك…' : 'جارٍ تسجيل حضورك…')
  const [ok, setOk] = useState(false)
  useEffect(() => {
    async function run() {
      const fn = isRec ? 'self_record_listen' : 'self_check_in'
      const { data, error } = await supabase.rpc(fn, { p_session: sessionId })
      if (error) setMsg('تعذّر التسجيل. تأكد أنك مسجّل دخولك كطالب.')
      else { setMsg(data); setOk(true) }
    }
    run()
  }, [sessionId])
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="تأصيل" className="login-logo" />
        <div style={{ fontSize: 44, margin: '16px 0' }}>{ok ? (isRec ? '🎧' : '✅') : '⏳'}</div>
        <p style={{ fontSize: 17, marginBottom: 20 }}>{msg}</p>
        <button className="login-submit" onClick={onDone}>العودة للرئيسية</button>
      </div>
    </div>
  )
}
