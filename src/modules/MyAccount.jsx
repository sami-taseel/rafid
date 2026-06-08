import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { Spinner } from './Students'

// تعديل البيانات الشخصية لحساب الموظف/المدير
export default function MyAccount() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState(null)
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState({ new: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: au } = await supabase.auth.getUser()
      if (au?.user) {
        setEmail(au.user.email || '')
        const { data: p } = await supabase.from('persons').select('*').eq('auth_user_id', au.user.id).maybeSingle()
        if (p) { setPerson(p); setForm({ full_name: p.full_name || '', phone: p.phone || '' }) }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveProfile() {
    if (!form.full_name.trim()) { toast('اكتب الاسم', 'error'); return }
    setSaving(true)
    await supabase.from('persons').update({ full_name: form.full_name, phone: form.phone }).eq('id', person.id)
    setSaving(false); toast('تم حفظ بياناتك')
  }

  async function changeEmail() {
    if (!email.trim()) { toast('اكتب البريد', 'error'); return }
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    if (error) toast('تعذّر تغيير البريد: ' + error.message, 'error')
    else toast('أُرسل رابط تأكيد للبريد الجديد')
  }

  async function changePassword() {
    if (pw.new.length < 6) { toast('كلمة المرور ٦ أحرف على الأقل', 'error'); return }
    if (pw.new !== pw.confirm) { toast('كلمتا المرور غير متطابقتين', 'error'); return }
    const { error } = await supabase.auth.updateUser({ password: pw.new })
    if (error) toast('تعذّر التغيير: ' + error.message, 'error')
    else { toast('تم تغيير كلمة المرور'); setPw({ new: '', confirm: '' }) }
  }

  if (loading) return <Spinner />

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="panel">
        <h3>البيانات الشخصية</h3>
        <div className="field"><label>الاسم الكامل</label>
          <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="field"><label>رقم الجوال</label>
          <input value={form.phone} dir="ltr" onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        <button className="save-btn" style={{ width: 'auto', padding: '11px 24px' }} onClick={saveProfile} disabled={saving}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ البيانات'}
        </button>
      </div>

      <div className="panel">
        <h3>البريد الإلكتروني</h3>
        <div className="field"><label>البريد</label>
          <input value={email} dir="ltr" onChange={e => setEmail(e.target.value)} /></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>تغيير البريد يتطلب تأكيداً عبر رابط يُرسل للبريد الجديد.</p>
        <button className="mini" onClick={changeEmail}>تحديث البريد</button>
      </div>

      <div className="panel">
        <h3>كلمة المرور</h3>
        <div className="field"><label>كلمة المرور الجديدة</label>
          <input type="password" value={pw.new} onChange={e => setPw({ ...pw, new: e.target.value })} /></div>
        <div className="field"><label>تأكيد كلمة المرور</label>
          <input type="password" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} /></div>
        <button className="mini" onClick={changePassword}>تغيير كلمة المرور</button>
      </div>
    </div>
  )
}
