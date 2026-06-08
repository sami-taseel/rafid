import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { Spinner } from './Students'

export default function Languages() {
  const toast = useToast()
  const [langs, setLangs] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('app_languages').select('*').order('sort_order')
    setLangs(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function toggle(code, current) {
    if (code === 'ar') { toast('العربية هي اللغة الأساسية ولا يمكن تعطيلها'); setTimeout(()=>toast(null),2000); return }
    await supabase.from('app_languages').update({ is_active: !current }).eq('code', code)
    load()
  }

  if (loading) return <Spinner />
  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>
        فعّل اللغات التي تريد إتاحتها للطلاب في واجهتهم. لوحة الإدارة تبقى بالعربية.
      </p>
      <div className="panel">
        {langs.map(l => (
          <div key={l.code} className="lang-row">
            <span className="lang-name">{l.name_native} <span className="muted">({l.code})</span></span>
            <label className="switch">
              <input type="checkbox" checked={l.is_active} onChange={() => toggle(l.code, l.is_active)} />
              <span className="slider"></span>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
