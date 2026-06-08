import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'
import { useToast } from '../Toast'
import { useConfirm } from '../Confirm'

// إدارة الجهات الداعمة: إنشاؤها، ربط حساب لها، وإسناد الطلاب
export default function SponsorsAdmin() {
  const toast = useToast()
  const confirmDialog = useConfirm()
  const [sponsors, setSponsors] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [sel, setSel] = useState(null)
  const [linkEmail, setLinkEmail] = useState({})  // sponsorId -> email

  async function load() {
    const [sp, st] = await Promise.all([
      supabase.from('sponsors').select('*').order('name'),
      supabase.from('students').select('id, sponsor_id, persons(full_name, nationality)'),
    ])
    setSponsors(sp.data || []); setStudents(st.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addSponsor() {
    if (!name.trim()) { toast('اكتب اسم الجهة', 'error'); return }
    await supabase.from('sponsors').insert({ name: name.trim() })
    setName(''); toast('أُضيفت الجهة'); load()
  }
  async function delSponsor(s) {
    const ok = await confirmDialog({ title: 'حذف الجهة', message: 'سيتم حذف الجهة وفكّ ارتباط طلابها.', confirmText: 'احذف', danger: true })
    if (!ok) return
    await supabase.from('students').update({ sponsor_id: null }).eq('sponsor_id', s.id)
    await supabase.from('sponsors').delete().eq('id', s.id)
    toast('تم الحذف'); load()
  }
  async function assignStudent(studentId, sponsorId) {
    await supabase.from('students').update({ sponsor_id: sponsorId || null }).eq('id', studentId)
    load()
  }
  async function linkAccount(sponsorId) {
    const email = (linkEmail[sponsorId] || '').trim()
    if (!email) { toast('اكتب بريد حساب الجهة', 'error'); return }
    const { data } = await supabase.rpc('link_sponsor_account', { p_email: email, p_sponsor: sponsorId })
    toast(data || 'تم')
    setLinkEmail({ ...linkEmail, [sponsorId]: '' })
  }

  if (loading) return <Spinner />

  const countFor = (sid) => students.filter(s => s.sponsor_id === sid).length

  return (
    <div>
      <div className="panel">
        <h3>إضافة جهة داعمة</h3>
        <div className="form-row">
          <input placeholder="اسم الجهة الداعمة" value={name} onChange={e => setName(e.target.value)} />
          <button onClick={addSponsor}>إضافة</button>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          بعد الإضافة: سجّل حساب الجهة ببريدها في الموقع، ثم عيّن له دور «جهة داعمة» من «المستخدمون»، واربطه بالجهة هنا.
        </p>
      </div>

      <div className="panel">
        <h3>الجهات الداعمة ({sponsors.length})</h3>
        {sponsors.map(s => (
          <div key={s.id} className="user-row">
            <div className="user-info">
              <strong>{s.name}</strong>
              <span className="muted"> · {countFor(s.id)} طالب مكفول</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input placeholder="بريد حساب الجهة لربطه" value={linkEmail[s.id] || ''}
                onChange={e => setLinkEmail({ ...linkEmail, [s.id]: e.target.value })}
                dir="ltr" style={{ width: 200, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} />
              <button className="mini" onClick={() => linkAccount(s.id)}>ربط الحساب</button>
              <button className="mini" onClick={() => setSel(sel === s.id ? null : s.id)}>{sel === s.id ? 'إغلاق' : 'إسناد طلاب'}</button>
              <button className="fr-del" onClick={() => delSponsor(s)}>حذف</button>
            </div>
          </div>
        ))}
      </div>

      {sel && (
        <div className="panel">
          <h3>إسناد طلاب لـ {sponsors.find(s => s.id === sel)?.name}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>فعّل الطلاب الذين تكفلهم هذه الجهة.</p>
          <div className="picker-list" style={{ maxHeight: 360 }}>
            {students.map(st => (
              <label key={st.id} className="picker-row">
                <input type="checkbox" checked={st.sponsor_id === sel}
                  onChange={e => assignStudent(st.id, e.target.checked ? sel : null)} />
                {st.persons?.full_name}
                <span className="muted" style={{ fontSize: 12, marginRight: 'auto' }}>
                  {st.sponsor_id && st.sponsor_id !== sel ? '(مكفول لجهة أخرى)' : ''}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
