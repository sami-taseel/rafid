import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// جرس إشعارات الطالب
export default function Notifications({ studentId }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)

  async function load() {
    if (!studentId) return
    const { data } = await supabase.from('notifications').select('*')
      .eq('student_id', studentId).order('created_at', { ascending: false }).limit(20)
    setItems(data || [])
  }
  useEffect(() => { load() }, [studentId])

  const unread = items.filter(i => !i.is_read).length

  async function markAll() {
    await supabase.from('notifications').update({ is_read: true }).eq('student_id', studentId).eq('is_read', false)
    load()
  }

  return (
    <div className="notif-wrap">
      <button className="notif-bell" onClick={() => { setOpen(!open); if (!open && unread) markAll() }}>
        🔔{unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">الإشعارات</div>
          {items.length === 0 && <div className="notif-empty">لا توجد إشعارات</div>}
          {items.map(n => (
            <div key={n.id} className={'notif-item ' + n.kind}>
              <div className="notif-title">{n.title}</div>
              {n.body && <div className="notif-body">{n.body}</div>}
              <div className="notif-date">{new Date(n.created_at).toLocaleDateString('ar')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
