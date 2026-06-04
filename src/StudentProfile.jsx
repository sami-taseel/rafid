import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// واجهة الطالب: يراجع بياناته ويكملها
export default function StudentProfile({ session }) {
  const [person, setPerson] = useState(null)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const uid = session.user.id
        // نبحث عن سجل الشخص المرتبط بهذا الحساب
        let { data: p } = await supabase
          .from('persons').select('*').eq('auth_user_id', uid).maybeSingle()

        // إن لم يوجد، ننشئ سجلاً جديداً للطالب
        if (!p) {
          const { data: newP, error: e1 } = await supabase
            .from('persons')
            .insert({ full_name: '', auth_user_id: uid, email: session.user.email })
            .select().single()
          if (e1) throw e1
          p = newP
          // ننشئ سجل طالب مرتبط
          await supabase.from('students').insert({ person_id: p.id })
        }
        setPerson(p)

        const { data: s } = await supabase
          .from('students').select('*').eq('person_id', p.id).maybeSingle()
        setStudent(s)
      } catch (err) {
        setMsg({ type: 'error', text: 'تعذّر تحميل البيانات: ' + (err.message || err) })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

  function upd(field, value) {
    setPerson(prev => ({ ...prev, [field]: value }))
  }
  function updS(field, value) {
    setStudent(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      await supabase.from('persons').update({
        full_name: person.full_name,
        nationality: person.nationality,
        residency_no: person.residency_no,
        phone: person.phone,
        birth_date: person.birth_date || null,
      }).eq('id', person.id)

      if (student) {
        await supabase.from('students').update({
          university: student.university,
          college: student.college,
          major: student.major,
          degree_level: student.degree_level,
          profile_reviewed: true,
        }).eq('id', student.id)
      }
      setMsg({ type: 'ok', text: 'تم حفظ بياناتك بنجاح. شكراً لك.' })
    } catch (err) {
      setMsg({ type: 'error', text: 'تعذّر الحفظ: ' + (err.message || err) })
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() { await supabase.auth.signOut() }

  if (loading) return <div className="state"><div className="spinner"></div>جارٍ التحميل…</div>

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src="/logo-white.png" alt="تأصيل" className="header-logo" />
          <div className="brand-text">
            <h1>منصة رافد</h1>
            <span>ملف الطالب</span>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>خروج</button>
      </header>

      <div className="container narrow">
        <div className="welcome-box">
          مرحباً بك في منصة رافد. الرجاء مراجعة بياناتك وإكمالها ثم الحفظ.
        </div>

        <form onSubmit={handleSave} className="profile-form">
          <h2 className="section-title">البيانات الشخصية</h2>

          <div className="field">
            <label>الاسم الكامل</label>
            <input value={person?.full_name || ''} onChange={e => upd('full_name', e.target.value)} required />
          </div>
          <div className="field">
            <label>الجنسية</label>
            <input value={person?.nationality || ''} onChange={e => upd('nationality', e.target.value)} />
          </div>
          <div className="field">
            <label>رقم الإقامة</label>
            <input value={person?.residency_no || ''} onChange={e => upd('residency_no', e.target.value)} dir="ltr" />
          </div>
          <div className="field">
            <label>رقم الجوال</label>
            <input value={person?.phone || ''} onChange={e => upd('phone', e.target.value)} dir="ltr" />
          </div>

          <h2 className="section-title">البيانات الأكاديمية</h2>
          <div className="field">
            <label>الجامعة</label>
            <input value={student?.university || ''} onChange={e => updS('university', e.target.value)} />
          </div>
          <div className="field">
            <label>الكلية</label>
            <input value={student?.college || ''} onChange={e => updS('college', e.target.value)} />
          </div>
          <div className="field">
            <label>التخصص</label>
            <input value={student?.major || ''} onChange={e => updS('major', e.target.value)} />
          </div>
          <div className="field">
            <label>المرحلة الدراسية</label>
            <select value={student?.degree_level || ''} onChange={e => updS('degree_level', e.target.value)}>
              <option value="">اختر…</option>
              <option value="بكالوريوس">بكالوريوس</option>
              <option value="ماجستير">ماجستير</option>
              <option value="دكتوراه">دكتوراه</option>
            </select>
          </div>

          {msg && <div className={msg.type === 'ok' ? 'save-ok' : 'login-error'}>{msg.text}</div>}
          <button type="submit" disabled={saving} className="save-btn">
            {saving ? 'جارٍ الحفظ…' : 'حفظ البيانات'}
          </button>
        </form>
      </div>
    </div>
  )
}
