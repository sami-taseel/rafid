import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import StudentDetail from './StudentDetail'
import { Spinner } from './Students'

// طلبات اعتماد الطلاب — للمدير
export default function ApprovalRequests() {
  const toast = useToast()
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('students')
      .select('id, created_at, persons(full_name, nationality, phone), degree_level')
      .eq('account_state', 'pending_approval').order('created_at', { ascending: true })
    setReqs(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function approve(id) {
    const { data } = await supabase.rpc('approve_student', { p_student: id })
    toast(data || 'تم الاعتماد'); load()
  }

  if (loading) return <Spinner />
  if (sel) return <StudentDetail studentId={sel} onBack={() => { setSel(null); load() }} />

  return (
    <div>
      <h2 className="section-title">طلبات الاعتماد</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>طلاب أكملوا بياناتهم ومرفقاتهم وينتظرون اعتمادك.</p>
      {reqs.length === 0 && <div className="panel muted">لا توجد طلبات اعتماد جديدة.</div>}
      {reqs.map(r => (
        <div key={r.id} className="approval-req">
          <div className="approval-req-info" onClick={() => setSel(r.id)}>
            <div className="approval-req-avatar">{(r.persons?.full_name || '؟').charAt(0)}</div>
            <div>
              <div className="approval-req-name">{r.persons?.full_name || 'طالب'}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {[r.persons?.nationality, r.degree_level].filter(Boolean).join(' · ')}
                {r.created_at && ` · قدّم ${new Date(r.created_at).toLocaleDateString('ar')}`}
              </div>
            </div>
          </div>
          <div className="approval-req-actions">
            <button className="mini" onClick={() => setSel(r.id)}>مراجعة الملف</button>
            <button className="save-btn" style={{ width: 'auto', padding: '8px 18px' }} onClick={() => approve(r.id)}>اعتماد</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// عدّاد الطلبات (يُصدَّر لاستخدامه في الشارة)
export async function pendingApprovalCount() {
  const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('account_state', 'pending_approval')
  return count || 0
}
