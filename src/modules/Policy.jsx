import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Spinner } from './Students'

// إدارة اللائحة (للمدير) + متابعة الموافقات
export default function Policy() {
  const [doc, setDoc] = useState(null)
  const [acceptances, setAcceptances] = useState([])
  const [studentsCount, setStudentsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  async function load() {
    const { data: d } = await supabase.from('policy_documents').select('*').eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    setDoc(d)
    const { data: a } = await supabase.from('policy_acceptances').select('accepted_at, students(persons(full_name))')
    setAcceptances(a || [])
    const { count } = await supabase.from('students').select('id', { count: 'exact', head: true })
    setStudentsCount(count || 0)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function save() {
    await supabase.from('policy_documents').update({ title: doc.title, content: doc.content, updated_at: new Date().toISOString() }).eq('id', doc.id)
    setMsg('تم حفظ اللائحة'); setTimeout(() => setMsg(null), 2000)
  }

  if (loading) return <Spinner />
  return (
    <div>
      <div className="stats">
        <div className="stat-card"><div className="num">{acceptances.length}</div><div className="label">وافقوا على اللائحة</div></div>
        <div className="stat-card"><div className="num">{studentsCount - acceptances.length}</div><div className="label">لم يوافقوا بعد</div></div>
      </div>
      <div className="panel">
        <h3>نص اللائحة</h3>
        {doc && (
          <>
            <input style={{ width: '100%', marginBottom: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit' }}
              value={doc.title} onChange={e => setDoc({ ...doc, title: e.target.value })} />
            <textarea style={{ width: '100%', minHeight: 200, padding: 12, border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, lineHeight: 1.8 }}
              value={doc.content} onChange={e => setDoc({ ...doc, content: e.target.value })} />
            <button className="save-btn" style={{ marginTop: 12 }} onClick={save}>حفظ اللائحة</button>
          </>
        )}
        {msg && <div className="save-ok" style={{ marginTop: 10 }}>{msg}</div>}
      </div>
      <div className="panel">
        <h3>سجل الموافقات</h3>
        {acceptances.map((a, i) => (
          <div key={i} className="list-line">✅ {a.students?.persons?.full_name} <span className="muted">{new Date(a.accepted_at).toLocaleDateString('ar')}</span></div>
        ))}
        {acceptances.length === 0 && <div className="muted">لا توجد موافقات بعد</div>}
      </div>
    </div>
  )
}

// مكوّن موافقة الطالب (يُستخدم في صفحة الطالب)
export function PolicyAcceptance({ studentId }) {
  const [doc, setDoc] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: d } = await supabase.from('policy_documents').select('*').eq('is_active', true).limit(1).maybeSingle()
    setDoc(d)
    if (d) {
      const { data: a } = await supabase.from('policy_acceptances').select('id').eq('student_id', studentId).eq('policy_id', d.id).maybeSingle()
      setAccepted(!!a)
    }
    setLoading(false)
  }
  useEffect(() => { if (studentId) load() }, [studentId])

  async function accept() {
    await supabase.from('policy_acceptances').insert({ student_id: studentId, policy_id: doc.id })
    setAccepted(true)
  }

  if (loading) return <Spinner />
  if (!doc) return <div className="muted">لا توجد لائحة منشورة حالياً.</div>
  return (
    <div>
      <div className="sp-card">
        <div className="sp-card-title">{doc.title}</div>
        <div style={{ lineHeight: 2, fontSize: 14, whiteSpace: 'pre-wrap' }}>{doc.content}</div>
      </div>
      {accepted ? (
        <div className="save-ok">✅ لقد وافقت على اللائحة. شكراً لك.</div>
      ) : (
        <button className="sp-save" onClick={accept}>أقرّ بأنني اطّلعت وأوافق على اللائحة</button>
      )}
    </div>
  )
}
